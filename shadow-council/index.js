import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { withTimeout, retry, isTransient } from '../lib/ops.mjs';
import { isReasoningClaim } from '../lib/claims.mjs';

// Load .env from shadow-council/ first, fall back to project root
dotenv.config();
dotenv.config({ path: '../.env' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let SHADOW_MODEL = process.env.SHADOW_MODEL || 'claude-sonnet-4-6';

const shadowUsage = {
  calls: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  reset() { this.calls.length = 0; this.totalInputTokens = 0; this.totalOutputTokens = 0; },
};

function trackShadowUsage(model, input, output) {
  shadowUsage.calls.push({ provider: 'anthropic', model, input, output, timestamp: Date.now() });
  shadowUsage.totalInputTokens += input;
  shadowUsage.totalOutputTokens += output;
}

// ── In-Memory Store ─────────────────────────────────────────

const store = {
  questions: {},    // { [question_number]: QuestionState }
  sseClients: [],   // Active SSE response objects
};

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  store.sseClients = store.sseClients.filter(client => {
    try { client.write(data); return true; }
    catch { return false; }
  });
}

// TTL cleanup — delete questions older than 1 hour to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  Object.entries(store.questions).forEach(([num, q]) => {
    if (q.startedAt && q.startedAt < cutoff) {
      delete store.questions[num];
      console.log(`[SHADOW] Cleaned up Q${num} (older than 1 hour)`);
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

// ── JSON Parsing Helper ─────────────────────────────────────

function parseJSON(text) {
  if (!text) return null;
  try {
    let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

// ── Timeout + Retry Helper ──────────────────────────────────
// Env-configurable timeout + retry with backoff/jitter (see lib/ops.mjs).

const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 60000);
const API_SEARCH_TIMEOUT_MS = Number(process.env.API_SEARCH_TIMEOUT_MS || 90000);
const API_RETRIES = Number(process.env.API_RETRIES || 2);

function resilientCall(thunk, { timeoutMs = API_TIMEOUT_MS, label = 'shadow' } = {}) {
  return retry(() => withTimeout(thunk(), timeoutMs, label), {
    retries: API_RETRIES,
    retryOn: isTransient,
    honorRetryAfter: true,
    onRetry: ({ attempt, retries, delay }) => console.warn(`[SHADOW] ${label} transient failure — retry ${attempt}/${retries} in ${delay}ms`),
  });
}

// ── Claude API Helpers ──────────────────────────────────────

async function callClaude(systemPrompt, userMessage) {
  try {
    const response = await resilientCall(() => anthropic.messages.create({
      model: SHADOW_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }), { label: 'claude' });
    const usage = response.usage || {};
    trackShadowUsage(SHADOW_MODEL, usage.input_tokens || 0, usage.output_tokens || 0);
    return response.content[0]?.text || null;
  } catch (err) {
    console.error('[CLAUDE] Call failed:', err.message);
    return null;
  }
}

async function callClaudeWithWebSearch(prompt, maxUses = 3) {
  try {
    const response = await resilientCall(() => anthropic.messages.create({
      model: SHADOW_MODEL,
      max_tokens: 1024,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: maxUses,
      }],
      messages: [{ role: 'user', content: prompt }],
    }), { timeoutMs: API_SEARCH_TIMEOUT_MS, label: 'claude-search' }); // Extra time for web search

    // Extract text from all text blocks
    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    const text = textBlocks.map(b => b.text).join('\n');

    // Extract citations from text blocks
    const citations = textBlocks
      .flatMap(b => b.citations || [])
      .filter(c => c.type === 'web_search_result_location')
      .map(c => ({ url: c.url, title: c.title, cited_text: c.cited_text }));

    // Extract search result URLs from web_search_tool_result blocks
    const searchResults = (response.content || [])
      .filter(b => b.type === 'web_search_tool_result')
      .flatMap(b => Array.isArray(b.content) ? b.content : [])
      .filter(r => r.type === 'web_search_result')
      .map(r => ({ url: r.url, title: r.title }));

    const wsUsage = response.usage || {};
    trackShadowUsage(SHADOW_MODEL, wsUsage.input_tokens || 0, wsUsage.output_tokens || 0);
    return { text, citations, searchResults };
  } catch (err) {
    console.error('[CLAUDE+WEB] Call failed:', err.message);
    return { text: '', citations: [], searchResults: [], error: err.message };
  }
}

// ── Stage 1: Claim Extractor ────────────────────────────────

async function extractClaims(questionNum, modelId, modelName, answer) {
  const prompt = `You are a fact-checking analyst. Decompose the following answer into atomic, verifiable claims.
Each claim should be a single factual assertion that can be independently verified.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

Answer from ${modelName}:
"${answer}"

Respond in this exact JSON format:
{
  "claims": [
    {
      "id": "${modelId}-1",
      "text": "the exact claim as a standalone sentence",
      "category": "statistic|attribution|causal|definition|comparison|temporal|computation|logical_deduction|derivation|other",
      "verifiable": true
    }
  ]
}

Use "computation", "logical_deduction", or "derivation" for claims whose correctness is a matter of math or logical reasoning rather than external fact. Number the IDs sequentially: ${modelId}-1, ${modelId}-2, etc. Include factual claims AND any load-bearing reasoning/derivation steps; skip pure opinions or hedging. Aim for 4-8 claims.`;

  const text = await callClaude(
    'You are a precise fact-checking analyst. Respond ONLY with valid JSON.',
    prompt
  );

  const parsed = parseJSON(text);
  const claims = parsed?.claims || [];

  // Fallback: sentence splitting if claim extraction fails
  if (claims.length === 0 && answer) {
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const hasFactualContent = s => /\d|[A-Z][a-z]+ [A-Z]/.test(s);
    sentences.filter(hasFactualContent).slice(0, 6).forEach((s, i) => {
      claims.push({
        id: `${modelId}-${i + 1}`,
        text: s.trim(),
        category: 'other',
        verifiable: true,
      });
    });
  }

  broadcast({
    type: 'claims_extracted',
    question_number: questionNum,
    model_id: modelId,
    model_name: modelName,
    claims,
    claim_count: claims.length,
  });

  return claims;
}

// ── Stage 2: Investigator Swarm ─────────────────────────────

// Reasoning-validity check (no web). Shadow is Claude-only, so this is a separate pass by the
// same model rather than a different model — still better than evidence lookup for logic claims.
// Calibrated: never returns raw "unverifiable" for a well-formed reasoning claim.
async function investigateByReasoning(claim) {
  const prompt = `You are a reasoning checker. This claim is a logical or mathematical deduction, NOT an empirical fact. Do not search the web — independently re-derive or check whether it follows logically.

CLAIM: "${claim.text}"

Respond ONLY with JSON (no markdown fences):
{
  "verdict": "supported|partially_supported|refuted",
  "confidence": 0.0 to 1.0,
  "reasoning": "1-2 sentence re-derivation"
}
Use "supported" only if you independently re-derived it; "partially_supported" if plausible but not fully verified; "refuted" if wrong. Never answer "unverifiable".`;

  const text = await callClaude('You are a precise reasoning checker. Respond ONLY with valid JSON.', prompt);
  const parsed = parseJSON(text);
  const source = [{ title: 'Independent reasoning re-derivation', url: null }];
  if (!parsed) {
    return { verdict: 'partially_supported', confidence: 0.3, reasoning: 'Reasoning verifier unparseable; provisionally partial.', key_finding: null, sources: source, reasoning_mode: true };
  }
  let verdict = parsed.verdict;
  if (verdict !== 'supported' && verdict !== 'refuted') verdict = 'partially_supported';
  let confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.3;
  if (verdict === 'partially_supported') confidence = Math.min(confidence, 0.7);
  return { verdict, confidence, reasoning: parsed.reasoning || 'Reasoning re-derivation.', key_finding: parsed.key_finding || null, sources: source, reasoning_mode: true };
}

async function investigateClaim(questionNum, claim) {
  broadcast({
    type: 'investigation_started',
    question_number: questionNum,
    claim_id: claim.id,
    claim_text: claim.text,
  });

  // Reasoning/logic/math claims: check by re-derivation, not web search (web can't confirm logic).
  if (isReasoningClaim(claim)) {
    const verification = await investigateByReasoning(claim);
    broadcast({
      type: 'investigation_complete',
      question_number: questionNum,
      claim_id: claim.id,
      verdict: verification.verdict,
      confidence: verification.confidence,
      reasoning: verification.reasoning,
      source_count: verification.sources.length,
    });
    return { claimId: claim.id, ...verification };
  }

  const prompt = `You are a fact-checking investigator. Your job is to verify whether this claim is true.

CLAIM: "${claim.text}"

Please search the web for evidence about this claim, then provide your assessment.

After searching, provide your verdict as JSON (no markdown fences):
{
  "verdict": "supported" or "refuted" or "partially_supported" or "unverifiable",
  "confidence": 0.0 to 1.0,
  "reasoning": "2-3 sentence summary of what you found",
  "key_finding": "the single most important piece of evidence"
}`;

  const result = await callClaudeWithWebSearch(prompt, 3);

  const parsed = parseJSON(result.text);
  const verification = {
    verdict: parsed?.verdict || 'unverifiable',
    confidence: parsed?.confidence || 0,
    reasoning: parsed?.reasoning || result.error || 'Investigation failed',
    key_finding: parsed?.key_finding || null,
    sources: result.citations.length > 0
      ? result.citations.map(c => ({ url: c.url, title: c.title }))
      : result.searchResults,
  };

  broadcast({
    type: 'investigation_complete',
    question_number: questionNum,
    claim_id: claim.id,
    verdict: verification.verdict,
    confidence: verification.confidence,
    reasoning: verification.reasoning,
    source_count: verification.sources.length,
  });

  return { claimId: claim.id, ...verification };
}

async function runInvestigatorSwarm(questionNum, claims, concurrency = 10) {
  const results = {};
  let index = 0;

  async function worker() {
    while (index < claims.length) {
      const i = index++;
      const claim = claims[i];
      if (!claim) break;
      try {
        const result = await investigateClaim(questionNum, claim);
        results[result.claimId] = result;
      } catch (err) {
        console.error(`[INVESTIGATOR] Error for ${claim.id}:`, err.message);
        results[claim.id] = {
          claimId: claim.id,
          verdict: 'unverifiable',
          confidence: 0,
          reasoning: `Investigation error: ${err.message}`,
          key_finding: null,
          sources: [],
        };
        broadcast({
          type: 'investigation_complete',
          question_number: questionNum,
          claim_id: claim.id,
          verdict: 'unverifiable',
          confidence: 0,
          reasoning: `Error: ${err.message}`,
          source_count: 0,
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, claims.length) },
    () => worker()
  );
  await Promise.allSettled(workers);
  return results;
}

// ── Stage 3: Consensus Analyst ──────────────────────────────

async function analyzeConsensus(questionNum, allClaims, modelNames) {
  const claimsBlock = Object.entries(allClaims)
    .map(([id, claims]) =>
      `### ${modelNames[id] || id}:\n${claims.map(c => `- [${c.id}] ${c.text}`).join('\n')}`
    )
    .join('\n\n');

  const prompt = `You are a consensus analyst. Compare claims from different AI models.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

${claimsBlock}

Identify:
1. Claims where multiple models AGREE (same assertion, possibly worded differently)
2. Claims where models CONTRADICT each other
3. Claims UNIQUE to a single model

Respond in this exact JSON format:
{
  "agreed": [
    { "claim_text": "summary of shared claim", "claim_ids": ["claude-1", "gpt-2"], "models": ["claude", "gpt"] }
  ],
  "disagreed": [
    { "topic": "what they disagree about", "positions": { "claude": "position", "gpt": "position" }, "claim_ids": ["claude-3", "gpt-4"], "severity": "minor|moderate|major" }
  ],
  "unique": [
    { "claim_id": "gpt-3", "claim_text": "the unique claim", "model": "gpt" }
  ]
}`;

  const text = await callClaude(
    'You are a precise analytical judge. Respond ONLY with valid JSON.',
    prompt
  );
  const parsed = parseJSON(text) || { agreed: [], disagreed: [], unique: [] };

  broadcast({
    type: 'consensus_result',
    question_number: questionNum,
    agreed_count: parsed.agreed?.length || 0,
    disagreed_count: parsed.disagreed?.length || 0,
    unique_count: parsed.unique?.length || 0,
  });

  return parsed;
}

// ── Stage 4: Cross-Checker ──────────────────────────────────

async function crossCheck(questionNum, consensus, verifications, allClaims) {
  broadcast({ type: 'status_change', question_number: questionNum, status: 'cross_checking' });

  const allClaimsList = Object.values(allClaims).flat();

  const investigationSummary = Object.entries(verifications).map(([claimId, v]) => {
    const claim = allClaimsList.find(c => c.id === claimId);
    return `- [${claimId}] "${claim?.text || 'unknown'}": ${v.verdict} (conf: ${v.confidence}) — ${v.reasoning}`;
  }).join('\n');

  const disagreementsSummary = (consensus.disagreed || []).map(d =>
    `- ${d.topic}: ${Object.entries(d.positions || {}).map(([m, p]) => `${m}: "${p}"`).join(' vs ')}`
  ).join('\n');

  const uniqueSummary = (consensus.unique || []).map(u =>
    `- [${u.claim_id}] ${u.claim_text} (${u.model} only) — verdict: ${verifications[u.claim_id]?.verdict || 'unknown'}`
  ).join('\n');

  const prompt = `You are the cross-checker for a fact-verification system. Based on investigator findings and consensus analysis, produce a summary.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

Investigation results:
${investigationSummary || 'No investigations completed'}

Disagreements between models:
${disagreementsSummary || 'No disagreements found'}

Unique claims (only one model made these):
${uniqueSummary || 'No unique claims'}

Respond in this exact JSON format:
{
  "biggest_catch": "the single most significant finding — a major refutation, surprising confirmation, or critical disagreement. Be specific.",
  "strongest_consensus": "the claim all or most models agreed on that was verified as true",
  "hallucination_watch": "any unique claims that were refuted or unverifiable — potential hallucinations",
  "contradictions": [
    { "topic": "what was contradicted", "finding": "what the evidence actually shows", "affected_models": ["model_id"] }
  ],
  "confidence_assessment": "high|medium|low"
}`;

  const text = await callClaude(
    'You are a precise cross-checking analyst. Respond ONLY with valid JSON.',
    prompt
  );

  const parsed = parseJSON(text) || {
    biggest_catch: 'Cross-check inconclusive',
    strongest_consensus: 'Unable to determine',
    hallucination_watch: 'Unable to determine',
    contradictions: [],
    confidence_assessment: 'low',
  };

  broadcast({ type: 'cross_check_complete', question_number: questionNum, ...parsed });

  return parsed;
}

// ── Stage 5: Reporter (Pure Code) ───────────────────────────

function computeScores(allClaims, verifications) {
  const scores = {};
  for (const [modelId, claims] of Object.entries(allClaims)) {
    const verifiable = claims.filter(c => c.verifiable !== false);
    const total = verifiable.length;
    const verified = verifiable.filter(c => verifications[c.id]?.verdict === 'supported').length;
    const partial = verifiable.filter(c => verifications[c.id]?.verdict === 'partially_supported').length;
    const refuted = verifiable.filter(c => verifications[c.id]?.verdict === 'refuted').length;
    const unverifiable = verifiable.filter(c =>
      !verifications[c.id] || verifications[c.id]?.verdict === 'unverifiable'
    ).length;
    scores[modelId] = {
      total_claims: total,
      verified,
      partially_supported: partial,
      refuted,
      unverifiable,
      score: total > 0 ? Math.round(((verified + partial * 0.5) / total) * 1000) / 10 : 0,
    };
  }
  return scores;
}

// ── Stage 6: Improvement Loop ───────────────────────────────

async function improvementLoop(questionNum, allClaims, verifications) {
  broadcast({ type: 'status_change', question_number: questionNum, status: 'improving' });

  const weakClaims = Object.values(allClaims).flat().filter(c => {
    // Reasoning claims are checked by re-derivation; web re-search can never confirm them, so
    // don't burn paid search retries on them.
    if (isReasoningClaim(c)) return false;
    const v = verifications[c.id];
    return v && (v.verdict === 'unverifiable' || (v.confidence < 0.5 && v.verdict !== 'refuted'));
  });

  if (weakClaims.length === 0) return [];

  // Cap at 5 re-investigations, run in parallel
  const toRetry = weakClaims.slice(0, 5);
  const improvements = [];

  await Promise.allSettled(toRetry.map(async (claim) => {
    const old = verifications[claim.id];

    const prompt = `You are a thorough fact-checking investigator doing a DEEP re-investigation. A previous attempt to verify this claim was inconclusive. Try different search strategies — broader terms, specific names, or alternative phrasings.

Claim: "${claim.text}"

Previous result: ${old.verdict} (confidence: ${old.confidence})
Previous reasoning: ${old.reasoning}

Search the web using different terms than before. Respond in this exact JSON format (no markdown fences):
{
  "verdict": "supported" or "refuted" or "partially_supported" or "unverifiable",
  "confidence": 0.0 to 1.0,
  "reasoning": "1-2 sentence explanation",
  "key_finding": "most important evidence found"
}`;

    try {
      const result = await callClaudeWithWebSearch(prompt, 5);
      const parsed = parseJSON(result.text);

      if (parsed && parsed.verdict !== 'unverifiable' && (parsed.confidence || 0) > (old.confidence || 0)) {
        verifications[claim.id] = {
          verdict: parsed.verdict,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
          key_finding: parsed.key_finding,
          sources: result.citations.length > 0
            ? result.citations.map(c => ({ url: c.url, title: c.title }))
            : result.searchResults,
        };
        improvements.push({
          claim_id: claim.id,
          old_verdict: old.verdict,
          new_verdict: parsed.verdict,
          new_confidence: parsed.confidence,
        });
        broadcast({
          type: 'improvement_result',
          question_number: questionNum,
          claim_id: claim.id,
          old_verdict: old.verdict,
          new_verdict: parsed.verdict,
          new_confidence: parsed.confidence,
        });
      }
    } catch (err) {
      console.error(`[IMPROVEMENT] Error for ${claim.id}:`, err.message);
    }
  }));

  return improvements;
}

// ── Stage 7: Synthesize Verified Answer ─────────────────────

async function synthesizeVerifiedAnswer(questionNum, question, allClaims, verifications) {
  broadcast({ type: 'status_change', question_number: questionNum, status: 'synthesizing' });

  const allClaimsList = Object.values(allClaims).flat().filter(c => c.verifiable !== false);

  const verifiedClaims = allClaimsList.filter(c => {
    const v = verifications[c.id];
    return v && (v.verdict === 'supported' || v.verdict === 'partially_supported');
  });

  const refutedClaims = allClaimsList.filter(c => {
    const v = verifications[c.id];
    return v && v.verdict === 'refuted';
  });

  if (verifiedClaims.length === 0) {
    console.log(`[SHADOW] Q${questionNum}: No verified claims to synthesize`);
    return null;
  }

  const verifiedBlock = verifiedClaims.map((c, i) => {
    const v = verifications[c.id];
    const source = v?.sources?.[0];
    return `[${i + 1}] ${c.text} (Source: ${source?.title || 'N/A'} - ${source?.url || 'N/A'})`;
  }).join('\n');

  const refutedBlock = refutedClaims.map(c => {
    const v = verifications[c.id];
    return `- ${c.text} (Reason: ${v?.reasoning || 'Refuted'})`;
  }).join('\n');

  const prompt = `You are producing the final, authoritative verified answer for "The Shadow Council" verification system.
Using ONLY the verified claims below, write a comprehensive answer to the original question.
Include inline citations like [1], [2] referencing the numbered sources.

Original question: "${question}"

Verified claims with sources:
${verifiedBlock}

Claims to EXCLUDE (refuted):
${refutedBlock || 'None'}

Write a clear, accurate, well-structured answer using only verified information. Include [N] citations inline. Aim for 2-4 paragraphs.`;

  const text = await callClaude(
    'You are an authoritative synthesizer producing verified, cited answers.',
    prompt
  );

  if (!text) return null;

  const citations = verifiedClaims.map((c, i) => ({
    index: i + 1,
    claim: c.text,
    source: verifications[c.id]?.sources?.[0] || null,
  }));

  return { answer: text, citations };
}

// ── Pipeline Orchestrator ───────────────────────────────────

async function runPipeline(questionNum) {
  const q = store.questions[questionNum];
  if (!q) return;

  q.status = 'extracting_claims';
  q.startedAt = Date.now();
  broadcast({ type: 'status_change', question_number: questionNum, status: 'extracting_claims' });

  try {
    // Build model name lookup
    const modelNames = {};
    q.answers.forEach(a => { modelNames[a.model_id] = a.model_name; });

    // STAGE 1: Extract claims from all answers in parallel
    console.log(`[SHADOW] Q${questionNum}: Stage 1 — Extracting claims...`);
    await Promise.allSettled(
      q.answers.filter(a => a.answer).map(a =>
        extractClaims(questionNum, a.model_id, a.model_name, a.answer)
          .then(claims => { q.claims[a.model_id] = claims; })
      )
    );

    const allClaimsList = Object.values(q.claims).flat().filter(c => c.verifiable !== false);
    const totalClaims = allClaimsList.length;
    console.log(`[SHADOW] Q${questionNum}: Extracted ${totalClaims} verifiable claims`);

    if (totalClaims === 0) {
      q.status = 'complete';
      q.completedAt = Date.now();
      broadcast({ type: 'pipeline_complete', question_number: questionNum, duration_ms: q.completedAt - q.startedAt });
      return;
    }

    // STAGES 2+3: Investigators and Consensus run IN PARALLEL
    q.status = 'investigating';
    broadcast({ type: 'status_change', question_number: questionNum, status: 'investigating' });
    console.log(`[SHADOW] Q${questionNum}: Stage 2+3 — Investigators (${totalClaims} claims) + Consensus in parallel...`);

    const [investigatorResults, consensusResult] = await Promise.all([
      runInvestigatorSwarm(questionNum, allClaimsList, 15),
      analyzeConsensus(questionNum, q.claims, modelNames),
    ]);

    q.verifications = investigatorResults;
    q.consensus = consensusResult;

    // STAGES 4+5: Cross-Checker and Synthesis run in parallel
    console.log(`[SHADOW] Q${questionNum}: Stages 4+5 — Cross-checking + Synthesizing in parallel...`);
    const [crossCheckResult, synthesisResult] = await Promise.all([
      crossCheck(questionNum, q.consensus, q.verifications, q.claims),
      synthesizeVerifiedAnswer(questionNum, q.question, q.claims, q.verifications),
    ]);

    q.crossCheck = crossCheckResult;
    q.synthesis = synthesisResult;
    if (q.synthesis) {
      broadcast({ type: 'synthesis', question_number: questionNum, answer: q.synthesis.answer, citations: q.synthesis.citations });
      console.log(`[SHADOW] Q${questionNum}: Synthesis complete (${q.synthesis.citations.length} citations)`);
    }

    // STAGE 6: Reporter
    q.status = 'reporting';
    broadcast({ type: 'status_change', question_number: questionNum, status: 'reporting' });
    console.log(`[SHADOW] Q${questionNum}: Stage 6 — Computing scores...`);
    q.scores = computeScores(q.claims, q.verifications);
    broadcast({ type: 'scores', question_number: questionNum, scores: q.scores });

    // STAGE 7: Improvement Loop
    console.log(`[SHADOW] Q${questionNum}: Stage 7 — Improvement loop...`);
    q.improvement = await improvementLoop(questionNum, q.claims, q.verifications);

    // Recompute scores if improvements were made
    if (q.improvement.length > 0) {
      q.scores = computeScores(q.claims, q.verifications);
      broadcast({ type: 'scores', question_number: questionNum, scores: q.scores });
      console.log(`[SHADOW] Q${questionNum}: ${q.improvement.length} claims improved`);
    }

    // Done
    q.status = 'complete';
    q.completedAt = Date.now();
    const duration = q.completedAt - q.startedAt;
    console.log(`[SHADOW] Q${questionNum}: Pipeline complete in ${(duration / 1000).toFixed(1)}s`);
    broadcast({ type: 'pipeline_complete', question_number: questionNum, duration_ms: duration });

  } catch (err) {
    console.error(`[PIPELINE Q${questionNum}] Error:`, err);
    q.status = 'error';
    q.error = err.message;
    broadcast({ type: 'status_change', question_number: questionNum, status: 'error', error: err.message });
  }
}

// ── Routes ──────────────────────────────────────────────────

// POST /api/verify — Receives answers from The Council server
app.post('/api/verify', (req, res) => {
  const { question_number, question, answers } = req.body;

  if (!question_number || !question || !answers) {
    return res.status(400).json({ error: 'question_number, question, and answers required' });
  }

  console.log(`[SHADOW] Received Q${question_number}: "${question.slice(0, 80)}..." (${answers.length} models)`);

  // Store and immediately respond 202 (Accepted)
  store.questions[question_number] = {
    question_number,
    question,
    answers,
    status: 'queued',
    claims: {},
    consensus: null,
    verifications: {},
    crossCheck: null,
    synthesis: null,
    scores: null,
    improvement: [],
    startedAt: null,
    completedAt: null,
  };

  broadcast({
    type: 'question_received',
    question_number,
    question,
    model_count: answers.length,
  });

  // Fire pipeline async — don't await
  runPipeline(question_number).catch(err => {
    console.error(`[SHADOW] Pipeline failed for Q${question_number}:`, err);
  });

  res.status(202).json({ status: 'accepted', question_number });
});

// GET /api/stream — SSE endpoint for dashboard real-time updates
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send current state as init event
  const initData = Object.values(store.questions).map(q => ({
    question_number: q.question_number,
    question: q.question,
    status: q.status,
    model_count: q.answers.length,
    claims: q.claims,
    consensus: q.consensus ? {
      agreed: q.consensus.agreed || [],
      disagreed: q.consensus.disagreed || [],
      unique: q.consensus.unique || [],
    } : null,
    verifications: Object.fromEntries(
      Object.entries(q.verifications).map(([id, v]) => [id, {
        verdict: v.verdict,
        confidence: v.confidence,
        reasoning: v.reasoning,
        sources: v.sources,
      }])
    ),
    crossCheck: q.crossCheck,
    synthesis: q.synthesis || null,
    scores: q.scores,
    improvement: q.improvement,
    duration_ms: q.completedAt ? q.completedAt - q.startedAt : null,
  }));

  res.write(`data: ${JSON.stringify({ type: 'init', questions: initData })}\n\n`);

  store.sseClients.push(res);

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    try { res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`); }
    catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    store.sseClients = store.sseClients.filter(c => c !== res);
  });
});

// GET / — Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
});

// POST /api/config — Accept model override from Council server
app.post('/api/config', (req, res) => {
  if (req.body.model) {
    SHADOW_MODEL = req.body.model;
    console.log(`[SHADOW] Model switched to: ${SHADOW_MODEL}`);
  }
  res.json({ status: 'ok', model: SHADOW_MODEL });
});

// GET /api/usage — Session usage stats
app.get('/api/usage', (req, res) => {
  res.json(shadowUsage);
});

// POST /api/usage/reset — Reset usage counters
app.post('/api/usage/reset', (req, res) => {
  shadowUsage.reset();
  res.json({ status: 'ok' });
});

// GET /api/health — Status check
app.get('/api/health', (req, res) => {
  const questionCount = Object.keys(store.questions).length;
  const activeCount = Object.values(store.questions).filter(q =>
    !['complete', 'error'].includes(q.status)
  ).length;
  res.json({
    status: 'ok',
    name: 'Shadow Council',
    model: SHADOW_MODEL,
    anthropic_key_configured: !!process.env.ANTHROPIC_API_KEY,
    questions_received: questionCount,
    active_pipelines: activeCount,
    connected_dashboards: store.sseClients.length,
  });
});

// ── Start ───────────────────────────────────────────────────

const PORT = process.env.SHADOW_PORT || 3002;
app.listen(PORT, () => {
  console.log(`\n  SHADOW COUNCIL server running on port ${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   SSE stream: http://localhost:${PORT}/api/stream`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('   WARNING: ANTHROPIC_API_KEY not set — verification will fail');
  }
  console.log();
});
