// Workstream K — Shadow multi-provider quality experiment
//
// For each claim in research/K-data/claims.json, run an investigateClaim-equivalent
// prompt against Claude (web_search_20250305), Gemini Flash (googleSearch), and
// Grok 4.1 Fast (web_search + x_search). Capture verdict, confidence, reasoning,
// sources, cost, latency. Save to research/K-data/results.json.
//
// Usage:
//   node scripts/research-K-investigator-comparison.mjs --dry      # 1 claim only (~$0.08)
//   node scripts/research-K-investigator-comparison.mjs            # all 36 claims (~$3)

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load env from project root and server/
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, 'server', '.env') });

const DATA_DIR = join(ROOT, 'research', 'K-data');
const CLAIMS_FILE = join(DATA_DIR, 'claims.json');

const DRY = process.argv.includes('--dry');

// ── Clients ─────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Grok uses raw fetch for /v1/responses

// ── Pricing ─────────────────────────────────────────────────
const PRICING = {
  'claude-sonnet-4-6':       { input: 3.00, output: 15.00 },
  'gemini-3-flash-preview':  { input: 0.50, output: 3.00 },
  'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50 },
};
const computeCost = (model, inputTokens, outputTokens) => {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
};

// ── Prompt ──────────────────────────────────────────────────
const PROMPT = (claim) => `You are a fact-checking investigator. Your job is to verify whether this claim is true.

CLAIM: "${claim}"

Please search the web for evidence about this claim, then provide your assessment.

After searching, provide your verdict as JSON (no markdown fences):
{
  "verdict": "supported" or "refuted" or "partially_supported" or "unverifiable",
  "confidence": 0.0 to 1.0,
  "reasoning": "2-3 sentence summary of what you found",
  "key_finding": "the single most important piece of evidence"
}`;

// ── JSON extraction ─────────────────────────────────────────
function parseVerdict(text) {
  if (!text) return { verdict: 'unverifiable', confidence: 0, reasoning: 'empty response', key_finding: null, parseError: true };
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      verdict: parsed.verdict || 'unverifiable',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reasoning: parsed.reasoning || '',
      key_finding: parsed.key_finding || null,
      parseError: false,
    };
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        return {
          verdict: parsed.verdict || 'unverifiable',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
          reasoning: parsed.reasoning || '',
          key_finding: parsed.key_finding || null,
          parseError: false,
        };
      } catch {}
    }
    return { verdict: 'unverifiable', confidence: 0, reasoning: 'parse failed', key_finding: null, parseError: true, rawText: text };
  }
}

// ── Per-provider investigators ──────────────────────────────

async function investigateClaude(claim) {
  const t0 = Date.now();
  const model = 'claude-sonnet-4-6';
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: PROMPT(claim.text) }],
    });

    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    const text = textBlocks.map(b => b.text).join('\n');

    // Cited sources from text-block citations
    const citations = textBlocks
      .flatMap(b => b.citations || [])
      .filter(c => c.type === 'web_search_result_location')
      .map(c => ({ url: c.url, title: c.title, cited_text: c.cited_text }));

    // All search results from web_search_tool_result blocks
    const searchResults = (response.content || [])
      .filter(b => b.type === 'web_search_tool_result')
      .flatMap(b => Array.isArray(b.content) ? b.content : [])
      .filter(r => r.type === 'web_search_result')
      .map(r => ({ url: r.url, title: r.title }));

    const usage = response.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const verdict = parseVerdict(text);

    return {
      provider: 'claude',
      model,
      ...verdict,
      citedSources: citations,
      searchedSources: searchResults,
      sources: citations.length ? citations : searchResults,
      cost: computeCost(model, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - t0,
      rawText: text,
    };
  } catch (err) {
    return { provider: 'claude', model, error: err.message, latencyMs: Date.now() - t0 };
  }
}

async function investigateGemini(claim) {
  const t0 = Date.now();
  const model = 'gemini-3-flash-preview';
  try {
    const m = genAI.getGenerativeModel({ model, tools: [{ googleSearch: {} }] });
    const result = await m.generateContent(PROMPT(claim.text));

    const text = result?.response?.text?.() || '';
    const meta = result?.response?.usageMetadata || {};
    const grounding = result?.response?.candidates?.[0]?.groundingMetadata || {};
    const groundingChunks = grounding.groundingChunks || grounding.grounding_chunks || [];
    const searchQueries = grounding.webSearchQueries || grounding.web_search_queries || [];

    const sources = groundingChunks
      .map(c => ({ url: c.web?.uri || c.web?.url, title: c.web?.title }))
      .filter(s => s.url);

    const inputTokens = meta.promptTokenCount || 0;
    const outputTokens = meta.candidatesTokenCount || 0;
    const verdict = parseVerdict(text);

    return {
      provider: 'gemini',
      model,
      ...verdict,
      citedSources: sources,
      searchedSources: sources,
      sources,
      searchQueries,
      cost: computeCost(model, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - t0,
      rawText: text,
    };
  } catch (err) {
    return { provider: 'gemini', model, error: err.message, latencyMs: Date.now() - t0 };
  }
}

async function investigateGrok(claim) {
  const t0 = Date.now();
  const model = 'grok-4-1-fast-reasoning';
  try {
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: 'You are a fact-checking investigator. Respond ONLY with valid JSON.',
        input: [{ role: 'user', content: PROMPT(claim.text) }],
        tools: [{ type: 'web_search' }, { type: 'x_search' }],
        tool_choice: 'required',
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Grok ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();

    let text = data.output_text || '';
    if (!text && Array.isArray(data.output)) {
      text = data.output
        .filter(b => b.type === 'message')
        .flatMap(m => Array.isArray(m.content) ? m.content : [])
        .filter(c => c.type === 'output_text')
        .map(c => c.text)
        .join('\n');
    }

    // Grok's responses API places URL citations as annotations on output_text content
    // blocks: data.output[].content[].annotations[] where type === 'url_citation'.
    const sources = [];
    if (Array.isArray(data.output)) {
      for (const block of data.output) {
        const contents = Array.isArray(block.content) ? block.content : [];
        for (const c of contents) {
          const annotations = Array.isArray(c.annotations) ? c.annotations : [];
          for (const a of annotations) {
            if (a.type === 'url_citation' && typeof a.url === 'string') {
              sources.push({ url: a.url, title: a.title || null });
            }
          }
        }
      }
    }
    const dedupeKey = new Set();
    const uniqueSources = sources.filter(s => {
      if (dedupeKey.has(s.url)) return false;
      dedupeKey.add(s.url);
      return true;
    });

    // Also capture the search queries Grok issued
    const searchQueries = (Array.isArray(data.output) ? data.output : [])
      .filter(b => b.type === 'web_search_call' || b.type === 'x_search_call')
      .map(b => b.action?.query)
      .filter(Boolean);

    const usage = data.usage || {};
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
    const verdict = parseVerdict(text);

    return {
      provider: 'grok',
      model,
      ...verdict,
      citedSources: uniqueSources,
      searchedSources: uniqueSources,
      sources: uniqueSources,
      searchQueries,
      cost: computeCost(model, inputTokens, outputTokens),
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - t0,
      rawText: text,
    };
  } catch (err) {
    return { provider: 'grok', model, error: err.message, latencyMs: Date.now() - t0 };
  }
}

// ── Per-claim orchestrator ──────────────────────────────────

async function investigateClaim(claim) {
  const t0 = Date.now();
  // Run all 3 providers in parallel
  const [claude, gemini, grok] = await Promise.all([
    investigateClaude(claim),
    investigateGemini(claim),
    investigateGrok(claim),
  ]);
  return {
    claimId: claim.id,
    questionId: claim.questionId,
    claimText: claim.text,
    durationMs: Date.now() - t0,
    providers: { claude, gemini, grok },
  };
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const claimsFile = JSON.parse(readFileSync(CLAIMS_FILE, 'utf8'));
  const allClaims = claimsFile.questions.flatMap(q =>
    q.claims.map(c => ({ ...c, questionId: q.id }))
  );

  const claims = DRY ? [allClaims[0]] : allClaims;
  console.log(`[K] Mode: ${DRY ? 'DRY (1 claim)' : 'FULL'} — ${claims.length} claim(s) × 3 providers = ${claims.length * 3} calls`);
  console.log(`[K] Cost projection: ~$${(claims.length * 0.075).toFixed(2)} (Claude dominates; Gemini + Grok pennies)`);

  const results = [];
  let runningCost = 0;
  const t0 = Date.now();

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const r = await investigateClaim(claim);
    results.push(r);

    const claimCost = Object.values(r.providers).reduce((a, p) => a + (p.cost || 0), 0);
    runningCost += claimCost;
    console.log(`[K] [${i + 1}/${claims.length}] ${claim.id}`);
    for (const [name, p] of Object.entries(r.providers)) {
      if (p.error) {
        console.log(`     ${name.padEnd(7)} ERROR: ${p.error}`);
      } else {
        const conf = p.confidence?.toFixed(2) ?? 'n/a';
        console.log(`     ${name.padEnd(7)} ${p.verdict?.padEnd(20) || 'no-verdict'.padEnd(20)} conf=${conf}  $${(p.cost || 0).toFixed(4)}  src=${p.sources?.length || 0}  ${p.latencyMs}ms`);
      }
    }
    console.log(`     claim total: $${claimCost.toFixed(4)}  running: $${runningCost.toFixed(4)}`);
  }

  const wallSec = ((Date.now() - t0) / 1000).toFixed(1);

  // Save results
  const outFile = join(DATA_DIR, DRY ? 'results-dry.json' : 'results.json');
  writeFileSync(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    wallTimeSec: parseFloat(wallSec),
    totalClaims: claims.length,
    totalCost: runningCost,
    results,
  }, null, 2));

  console.log(`\n[K] Wall time: ${wallSec}s`);
  console.log(`[K] Total cost: $${runningCost.toFixed(4)}`);
  console.log(`[K] Wrote ${outFile}`);
}

main().catch(err => { console.error('[K] fatal:', err); process.exit(1); });
