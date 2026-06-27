import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { listDemoQuestions, runFixtureCouncil, writeReport } from '../lib/fixtureCouncil.mjs';
import { withTimeout, retry, isTransient } from '../lib/ops.mjs';
import { isReasoningClaim, claimAuthorId } from '../lib/claims.mjs';

// Load .env from server/ first, fall back to project root
dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let questionCounter = 0;

// ── API Clients ─────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const SHADOW_COUNCIL_URL = process.env.SHADOW_COUNCIL_URL || 'http://localhost:3002';

// ── Startup Validation ───────────────────────────────────────
const KEY_NAMES = {
  ANTHROPIC_API_KEY: 'Claude', OPENAI_API_KEY: 'GPT',
  GOOGLE_API_KEY: 'Gemini', XAI_API_KEY: 'Grok',
};
const missingKeys = Object.entries(KEY_NAMES).filter(([envVar]) => !process.env[envVar]);
missingKeys.forEach(([envVar, model]) => console.warn(`⚠ ${envVar} not set — ${model} will be unavailable`));
const configuredProviderCount = Object.keys(KEY_NAMES).length - missingKeys.length;
if (configuredProviderCount < 2) {
  console.warn(`⚠ Live Council is degraded: ${configuredProviderCount} provider key(s) configured, needs 2+. Fixture endpoints still work without keys.`);
}

const VALID_MODEL_IDS = new Set(['claude', 'gpt', 'gemini', 'grok']);

function publicFixtureReport(report) {
  const summary = report.final.confidenceSummary;
  return {
    ...report,
    stats: {
      agents: report.agents.length,
      claims: report.verifiedClaims.length,
      supported: summary.supportedClaims,
      partial: summary.partiallySupportedClaims,
      unresolved: summary.unresolvedClaims,
      confidence: summary.averageConfidence,
    },
    reportPaths: {
      json: 'sample_outputs/latest_fixture_report.json',
      markdown: 'sample_outputs/latest_fixture_report.md',
    },
  };
}

// ── Model Configs ───────────────────────────────────────────

const MODELS = {
  claude: { name: 'Claude', provider: 'Anthropic', model: 'claude-sonnet-4-6', color: '#D97706' },
  gpt: { name: 'GPT-5.2', provider: 'OpenAI', model: 'gpt-5.2', color: '#10B981' },
  gemini: { name: 'Gemini', provider: 'Google', model: 'gemini-3-flash-preview', color: '#3B82F6' },
  grok: { name: 'Grok', provider: 'xAI', model: 'grok-4-1-fast-reasoning', color: '#EF4444' },
};

const MODEL_OPTIONS = {
  claude: [
    { model: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'flagship', input: 3.00, output: 15.00 },
    { model: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'budget', input: 1.00, output: 5.00 },
  ],
  gpt: [
    { model: 'gpt-5.2', label: 'GPT-5.2', tier: 'flagship', input: 1.75, output: 14.00 },
    { model: 'gpt-4.1', label: 'GPT-4.1', tier: 'balanced', input: 2.00, output: 8.00 },
    { model: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', tier: 'budget', input: 0.40, output: 1.60 },
  ],
  gemini: [
    { model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', tier: 'flagship', input: 0.50, output: 3.00 },
    { model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'balanced', input: 0.15, output: 0.60 },
    { model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', tier: 'budget', input: 0.10, output: 0.40 },
  ],
  grok: [
    { model: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast', tier: 'flagship', input: 0.20, output: 0.50 },
    { model: 'grok-3-mini', label: 'Grok 3 Mini', tier: 'budget', input: 0.30, output: 0.50 },
  ],
};

// ── Session Usage Tracking ─────────────────────────────────

const COUNCIL_ROLES = {
  claude: {
    name: 'Operations and feasibility analyst',
    instructions: 'Identify the user\'s actual goal and the physical/logistical steps required to accomplish it. Do not optimize for convenience until you have confirmed that the recommendation can complete the stated task.'
  },
  gpt: {
    name: 'Practical tradeoff analyst',
    instructions: 'Compare the practical costs, safety issues, and effort of each option, but treat goal feasibility as a hard constraint. If an option is efficient but does not accomplish the stated goal, say so explicitly.'
  },
  gemini: {
    name: 'Assumption and edge-case analyst',
    instructions: 'Challenge hidden assumptions and separate the main task from adjacent tasks like scouting, checking prices, or preparing supplies. State the primary recommendation first, then caveats.'
  },
  grok: {
    name: 'Contrarian verifier',
    instructions: 'Look for the common-sense trap in the question. Prefer the answer that actually satisfies the user\'s stated intent, and call out when a superficially attractive option fails that intent.'
  },
};

function buildCouncilSystemPrompt(modelId, baseSystemPrompt) {
  const role = COUNCIL_ROLES[modelId] || {
    name: 'General Council analyst',
    instructions: 'Answer directly, verify that the recommendation accomplishes the stated goal, and put caveats after the primary recommendation.'
  };
  return `${baseSystemPrompt}

Your Council role: ${role.name}.
Role instructions: ${role.instructions}

Decision discipline:
1. Restate the user's actual goal in your own reasoning.
2. Check whether each option can physically/logistically accomplish that goal.
3. Give the primary recommendation first.
4. Put caveats and alternate interpretations after the primary recommendation.
5. Do not let generic heuristics, such as "short distances are walkable," override whether the option completes the user's stated task.`;
}

const sessionUsage = {
  calls: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  reset() { this.calls.length = 0; this.totalInputTokens = 0; this.totalOutputTokens = 0; },
};

function trackUsage(provider, model, input, output, round = 'unknown') {
  sessionUsage.calls.push({ provider, model, input, output, round, timestamp: Date.now() });
  sessionUsage.totalInputTokens += input;
  sessionUsage.totalOutputTokens += output;
}

// ── Timeout + Retry Helper ──────────────────────────────────
// Timeouts and retry policy are env-configurable so operators can tune them
// without editing code. Retries honor Retry-After and back off with jitter
// (see lib/ops.mjs); only transient failures (429/5xx/network) are retried.

const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 60000);
const API_SEARCH_TIMEOUT_MS = Number(process.env.API_SEARCH_TIMEOUT_MS || 90000);
const API_RETRIES = Number(process.env.API_RETRIES || 2);

// Wrap a lazy provider call (a thunk so it can be re-invoked) in timeout + retry.
function resilientCall(thunk, { timeoutMs = API_TIMEOUT_MS, label = 'provider' } = {}) {
  return retry(() => withTimeout(thunk(), timeoutMs, label), {
    retries: API_RETRIES,
    retryOn: isTransient,
    honorRetryAfter: true,
    onRetry: ({ attempt, retries, delay }) => console.warn(`[COUNCIL] ${label} transient failure — retry ${attempt}/${retries} in ${delay}ms`),
  });
}

// ── API Call Functions ──────────────────────────────────────

async function callClaude(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const response = await resilientCall(() => anthropic.messages.create({
      model: MODELS.claude.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }), { label: 'claude' });
    const usage = response.usage || {};
    trackUsage('anthropic', MODELS.claude.model, usage.input_tokens || 0, usage.output_tokens || 0);
    return {
      id: 'claude',
      ...MODELS.claude,
      answer: response.content?.[0]?.text ?? null,
      latency: Date.now() - start,
      status: 'success',
      usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0 },
    };
  } catch (err) {
    console.error(`[COUNCIL] Claude failed: ${err.message}`);
    return { id: 'claude', ...MODELS.claude, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGPT(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const response = await resilientCall(() => openai.chat.completions.create({
      model: MODELS.gpt.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 2048,
    }), { label: 'gpt' });
    const usage = response.usage || {};
    trackUsage('openai', MODELS.gpt.model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    return {
      id: 'gpt',
      ...MODELS.gpt,
      answer: response.choices?.[0]?.message?.content ?? null,
      latency: Date.now() - start,
      status: 'success',
      usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 },
    };
  } catch (err) {
    console.error(`[COUNCIL] GPT failed: ${err.message}`);
    return { id: 'gpt', ...MODELS.gpt, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGemini(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({
      model: MODELS.gemini.model,
      systemInstruction: systemPrompt,
    });
    const result = await resilientCall(() => model.generateContent(userMessage), { label: 'gemini' });
    const meta = result?.response?.usageMetadata || {};
    trackUsage('google', MODELS.gemini.model, meta.promptTokenCount || 0, meta.candidatesTokenCount || 0);
    return {
      id: 'gemini',
      ...MODELS.gemini,
      answer: result?.response?.text?.() ?? null,
      latency: Date.now() - start,
      status: 'success',
      usage: { input: meta.promptTokenCount || 0, output: meta.candidatesTokenCount || 0 },
    };
  } catch (err) {
    console.error(`[COUNCIL] Gemini failed: ${err.message}`);
    return { id: 'gemini', ...MODELS.gemini, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGrok(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const response = await resilientCall(() => grokClient.chat.completions.create({
      model: MODELS.grok.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 2048,
    }), { label: 'grok' });
    const usage = response.usage || {};
    trackUsage('xai', MODELS.grok.model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    return {
      id: 'grok',
      ...MODELS.grok,
      answer: response.choices?.[0]?.message?.content ?? null,
      latency: Date.now() - start,
      status: 'success',
      usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 },
    };
  } catch (err) {
    console.error(`[COUNCIL] Grok failed: ${err.message}`);
    return { id: 'grok', ...MODELS.grok, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

const callers = { claude: callClaude, gpt: callGPT, gemini: callGemini, grok: callGrok };

// ── Search-Enabled Call Functions (Round 1 only) ────────────

async function callClaudeWithSearch(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const response = await resilientCall(() => anthropic.messages.create({
      model: MODELS.claude.model,
      max_tokens: 2048,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: userMessage }],
    }), { timeoutMs: API_SEARCH_TIMEOUT_MS, label: 'claude-search' }); // Extra time for web search
    const usageData = response.usage || {};
    trackUsage('anthropic', MODELS.claude.model, usageData.input_tokens || 0, usageData.output_tokens || 0);
    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    const answer = textBlocks.map(b => b.text).join('\n') || null;
    return { id: 'claude', ...MODELS.claude, answer, latency: Date.now() - start, status: 'success', usage: { input: usageData.input_tokens || 0, output: usageData.output_tokens || 0 } };
  } catch (err) {
    console.error(`[COUNCIL] Claude (search) failed: ${err.message}`);
    return { id: 'claude', ...MODELS.claude, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGPTWithSearch(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const response = await resilientCall(() => openai.chat.completions.create({
      model: 'gpt-5-search-api',
      web_search_options: {},
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 2048,
    }), { timeoutMs: API_SEARCH_TIMEOUT_MS, label: 'gpt-search' });
    const usageGpt = response.usage || {};
    trackUsage('openai', 'gpt-5-search-api', usageGpt.prompt_tokens || 0, usageGpt.completion_tokens || 0);
    return { id: 'gpt', ...MODELS.gpt, answer: response.choices?.[0]?.message?.content ?? null, latency: Date.now() - start, status: 'success', usage: { input: usageGpt.prompt_tokens || 0, output: usageGpt.completion_tokens || 0 } };
  } catch (err) {
    console.error(`[COUNCIL] GPT (search) failed: ${err.message}`);
    return { id: 'gpt', ...MODELS.gpt, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGeminiWithSearch(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({
      model: MODELS.gemini.model,
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
    });
    const result = await resilientCall(() => model.generateContent(userMessage), { timeoutMs: API_SEARCH_TIMEOUT_MS, label: 'gemini-search' });
    const gemMeta = result?.response?.usageMetadata || {};
    trackUsage('google', MODELS.gemini.model, gemMeta.promptTokenCount || 0, gemMeta.candidatesTokenCount || 0);
    return { id: 'gemini', ...MODELS.gemini, answer: result?.response?.text?.() ?? null, latency: Date.now() - start, status: 'success', usage: { input: gemMeta.promptTokenCount || 0, output: gemMeta.candidatesTokenCount || 0 } };
  } catch (err) {
    console.error(`[COUNCIL] Gemini (search) failed: ${err.message}`);
    return { id: 'gemini', ...MODELS.gemini, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

async function callGrokWithSearch(systemPrompt, userMessage) {
  const start = Date.now();
  try {
    const data = await resilientCall(async () => {
      const response = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.XAI_API_KEY}` },
        body: JSON.stringify({
          model: 'grok-4-1-fast-reasoning', // Only grok-4 family supports server-side tools
          instructions: systemPrompt,
          input: [{ role: 'user', content: userMessage }],
          tools: [
            { type: 'web_search' },
            { type: 'x_search' },
          ],
          tool_choice: 'required',
        }),
      });
      if (!response.ok) {
        const err = new Error(`Grok API ${response.status}: ${await response.text()}`);
        err.status = response.status;
        err.headers = response.headers;
        throw err;
      }
      return response.json();
    }, { timeoutMs: API_SEARCH_TIMEOUT_MS, label: 'grok-search' });
    let text = data.output_text || '';
    if (!text && Array.isArray(data.output)) {
      text = data.output.filter(b => b.type === 'message')
        .flatMap(m => Array.isArray(m.content) ? m.content : [])
        .filter(c => c.type === 'output_text').map(c => c.text).join('\n');
    }
    const grokUsage = data.usage || {};
    trackUsage('xai', 'grok-4-1-fast-reasoning', grokUsage.input_tokens || grokUsage.prompt_tokens || 0, grokUsage.output_tokens || grokUsage.completion_tokens || 0);
    return { id: 'grok', ...MODELS.grok, answer: text, latency: Date.now() - start, status: 'success', usage: { input: grokUsage.input_tokens || grokUsage.prompt_tokens || 0, output: grokUsage.output_tokens || grokUsage.completion_tokens || 0 } };
  } catch (err) {
    console.error(`[COUNCIL] Grok (search) failed: ${err.message}`);
    return { id: 'grok', ...MODELS.grok, answer: null, error: err.message, latency: Date.now() - start, status: 'error' };
  }
}

const searchCallers = { claude: callClaudeWithSearch, gpt: callGPTWithSearch, gemini: callGeminiWithSearch, grok: callGrokWithSearch };

// ── Verification Swarm Helpers ──────────────────────────────

const VERIFIER_ORDER = ['claude', 'gpt', 'gemini', 'grok'];
const VERIFIER_KEY_ENV = {
  claude: 'ANTHROPIC_API_KEY',
  gpt: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  grok: 'XAI_API_KEY',
};
let verifierCursor = 0;

function pickVerifier(excludeId = null) {
  const available = VERIFIER_ORDER.filter(id => id !== excludeId && !!process.env[VERIFIER_KEY_ENV[id]]);
  const pool = available.length > 0 ? available : VERIFIER_ORDER.filter(id => !!process.env[VERIFIER_KEY_ENV[id]]);
  // No configured provider — return null rather than a keyless Claude that would
  // fail on the next call. Callers must handle this (degraded verification).
  if (pool.length === 0) return null;
  const id = pool[verifierCursor % pool.length];
  verifierCursor++;
  return { id, caller: callers[id] };
}

// Use where a verifier is mandatory: fail with one clear, classified error
// instead of crashing on a null destructure. Only triggers when NO provider key
// is configured at all (a state in which verification cannot run regardless).
function requireVerifier(excludeId = null) {
  const verifier = pickVerifier(excludeId);
  if (!verifier) {
    const err = new Error('Verification unavailable: no provider API key is configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, XAI_API_KEY.');
    err.code = 'NO_VERIFIER';
    throw err;
  }
  return verifier;
}

async function searchBrave(query) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' } }
    );
    if (!response.ok) {
      console.error(`Brave search failed: ${response.status} ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    return (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  } catch (err) {
    console.error('Brave search error:', err.message);
    return [];
  }
}

function generateSearchQuery(claimText) {
  const stopWords = new Set([
    'is','was','are','were','the','a','an','of','as','in','on','at','to','for',
    'and','or','but','that','which','who','whom','this','these','those','it','its',
    'has','had','have','been','be','being','do','does','did','will','would','could',
    'should','may','might','shall','can','than','from','by','with','about','into',
    'through','during','before','after','above','below','between','under','served',
    'holds','held','represents','began','serving','individual','hold','office',
    'approximately','roughly','around','currently','according','stated','claimed',
  ]);
  const words = claimText.replace(/[.!?,;:'"()[\]]/g, '').split(/\s+/)
    .filter(w => !stopWords.has(w.toLowerCase()) && w.length > 1);
  return words.slice(0, 10).join(' ');
}

async function extractClaimsFromAnswer(modelId, modelName, answer) {
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

Use "computation", "logical_deduction", or "derivation" for claims whose correctness is a matter of math or logical reasoning (e.g. arithmetic results, constraint-satisfaction assignments, deduced conclusions) rather than external fact. Number the IDs sequentially: ${modelId}-1, ${modelId}-2, etc. Include factual claims AND any load-bearing reasoning/derivation steps; skip pure opinions or hedging. Aim for 4-8 claims.`;

  const { id: verifierId, caller } = requireVerifier(modelId);
  console.log(`[COUNCIL] Extract claims for ${modelName} → verifier: ${verifierId}`);
  const result = await caller(
    'You are a precise fact-checking analyst. Respond ONLY with valid JSON.',
    prompt
  );

  if (result.status !== 'success' || !result.answer) return [];
  try {
    let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.claims || [];
  } catch {
    const match = result.answer.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]).claims || []; } catch { return []; }
    }
    return [];
  }
}

async function crossReferenceClaims(allClaims, models) {
  const claimsBlock = Object.entries(allClaims)
    .map(([id, claims]) => `### ${models[id]?.name || id}:\n${claims.map(c => `- [${c.id}] ${c.text}`).join('\n')}`)
    .join('\n\n');

  const prompt = `You are a fact-checking analyst. Compare these claims from different AI models.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

${claimsBlock}

Identify:
1. Claims where multiple models AGREE (same assertion, possibly worded differently)
2. Claims where models CONTRADICT each other
3. Claims UNIQUE to a single model

Respond in this exact JSON format:
{
  "agreed": [
    { "claimText": "summary of the shared claim", "claimIds": ["claude-1", "gpt-2"], "models": ["claude", "gpt"] }
  ],
  "disagreed": [
    { "topic": "what they disagree about", "positions": { "claude": "claude's position", "gpt": "gpt's position" }, "claimIds": ["claude-3", "gpt-4"], "severity": "minor|moderate|major" }
  ],
  "unique": [
    { "claimId": "gpt-3", "claimText": "the unique claim", "model": "gpt" }
  ]
}`;

  const { id: verifierId, caller } = requireVerifier();
  console.log(`[COUNCIL] Cross-reference claims → verifier: ${verifierId}`);
  const result = await caller(
    'You are a precise analytical judge. Respond ONLY with valid JSON.',
    prompt
  );

  if (result.status !== 'success' || !result.answer) return { agreed: [], disagreed: [], unique: [] };
  try {
    let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = result.answer.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return { agreed: [], disagreed: [], unique: [] }; }
    }
    return { agreed: [], disagreed: [], unique: [] };
  }
}

// Reasoning-validity verification for logic/math/derivation claims. These have no external
// corroborant, so an evidence-based check marks them "unverifiable" (confidence 0) even when
// correct. Here an INDEPENDENT verifier re-derives / checks logical validity. Calibrated to
// avoid false positives: only "supported" when it can actually re-derive; "partially_supported"
// (capped confidence) when plausible-but-unchecked; never raw "unverifiable" for a well-formed
// reasoning claim, so a correct answer is neither dropped by synthesis nor zeroed by the scorer.
async function verifyByReasoning(claim) {
  const prompt = `You are a reasoning checker. The following claim is a logical or mathematical deduction, NOT an empirical fact. Do not search for external evidence — independently re-derive or check whether it follows logically.

Claim: "${claim.text}"

Respond ONLY with valid JSON:
{
  "verdict": "supported|partially_supported|refuted",
  "confidence": <0.0 to 1.0>,
  "reasoning": "1-2 sentence explanation of your re-derivation"
}
Rules: use "supported" only if you independently re-derived/confirmed it; "partially_supported" if it is plausible but you could not fully verify it; "refuted" if the reasoning is wrong. Never answer "unverifiable" — a logical claim is checkable by reasoning.`;

  const author = claimAuthorId(claim);
  const { id: verifierId, caller } = requireVerifier(author);
  console.log(`[COUNCIL] Verify claim ${claim.id} (reasoning) → verifier: ${verifierId}`);
  const result = await caller('You are a precise reasoning checker. Respond ONLY with valid JSON.', prompt);

  const source = [{ title: 'Independent reasoning re-derivation', url: null }];
  if (result.status !== 'success' || !result.answer) {
    return { verdict: 'partially_supported', confidence: 0.3, reasoning: 'Reasoning verifier call failed; provisionally partial.', sources: source, reasoning_mode: true };
  }
  const coerce = (parsed) => {
    let verdict = parsed.verdict;
    if (verdict !== 'supported' && verdict !== 'refuted') verdict = 'partially_supported';
    let confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.3;
    if (verdict === 'partially_supported') confidence = Math.min(confidence, 0.7); // cap unchecked
    return { verdict, confidence, reasoning: parsed.reasoning || 'Reasoning re-derivation.', sources: source, reasoning_mode: true };
  };
  try {
    const cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return coerce(JSON.parse(cleaned));
  } catch {
    const match = result.answer.match(/\{[\s\S]*\}/);
    if (match) {
      try { return coerce(JSON.parse(match[0])); } catch {}
    }
    console.warn(`[COUNCIL] Verify claim ${claim.id} (reasoning): could not parse — provisionally partial`);
    return { verdict: 'partially_supported', confidence: 0.3, reasoning: 'Reasoning verifier output unparseable; provisionally partial.', sources: source, reasoning_mode: true, parser_fallback: true };
  }
}

async function verifyClaim(claim, searchResults) {
  // Reasoning/logic/math claims are checked by re-derivation, not evidence lookup.
  if (isReasoningClaim(claim)) {
    return verifyByReasoning(claim);
  }
  // Web-evidence verification when search results exist
  if (searchResults.length > 0) {
    const evidenceBlock = searchResults.map(r => `- "${r.title}": ${r.snippet}`).join('\n');
    const prompt = `You are a fact-checker. Determine whether the following claim is supported by the search evidence.

IMPORTANT: Respond ONLY with valid JSON.

Claim: "${claim.text}"

Search evidence:
${evidenceBlock}

Respond in this exact JSON format:
{
  "verdict": "supported|refuted|partially_supported|unverifiable",
  "confidence": <0.0 to 1.0>,
  "reasoning": "1-2 sentence explanation"
}`;

    const { id: verifierId, caller } = requireVerifier();
    console.log(`[COUNCIL] Verify claim ${claim.id} (web) → verifier: ${verifierId}`);
    const result = await caller(
      'You are a precise fact-checker. Respond ONLY with valid JSON.',
      prompt
    );

    if (result.status !== 'success' || !result.answer) {
      return { verdict: 'unverifiable', confidence: 0, reasoning: 'Verification call failed', sources: searchResults };
    }
    try {
      let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return { ...parsed, sources: searchResults };
    } catch {
      const match = result.answer.match(/\{[\s\S]*\}/);
      if (match) {
        try { return { ...JSON.parse(match[0]), sources: searchResults }; } catch {}
      }
      console.warn(`[COUNCIL] Verify claim ${claim.id} (web): could not parse verifier JSON — marking unverifiable`);
      return { verdict: 'unverifiable', confidence: 0, reasoning: 'Failed to parse verdict', sources: searchResults, parser_fallback: true };
    }
  }

  // Fallback: LLM knowledge-based verification (no web sources available)
  const fallbackPrompt = `You are a fact-checker assessing a claim using your training knowledge.

IMPORTANT: Respond ONLY with valid JSON. Be conservative — only mark as "supported" if this is a well-established, widely accepted fact.

Claim: "${claim.text}"

Respond in this exact JSON format:
{
  "verdict": "supported|refuted|partially_supported|unverifiable",
  "confidence": <0.0 to 1.0>,
  "reasoning": "1-2 sentence explanation"
}`;

  const { id: verifierId, caller } = requireVerifier();
  console.log(`[COUNCIL] Verify claim ${claim.id} (knowledge) → verifier: ${verifierId}`);
  const result = await caller(
    'You are a precise fact-checker. Respond ONLY with valid JSON. Be conservative.',
    fallbackPrompt
  );

  if (result.status !== 'success' || !result.answer) {
    return { verdict: 'unverifiable', confidence: 0, reasoning: 'Verification call failed', sources: [] };
  }
  try {
    let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    // Cap confidence at 0.7 for knowledge-based verification (no web source backing)
    parsed.confidence = Math.min(parsed.confidence || 0, 0.7);
    return { ...parsed, sources: [{ title: 'LLM Knowledge Assessment', url: null }] };
  } catch {
    const match = result.answer.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        parsed.confidence = Math.min(parsed.confidence || 0, 0.7);
        return { ...parsed, sources: [{ title: 'LLM Knowledge Assessment', url: null }] };
      } catch {}
    }
    console.warn(`[COUNCIL] Verify claim ${claim.id} (knowledge): could not parse verifier JSON — marking unverifiable`);
    return { verdict: 'unverifiable', confidence: 0, reasoning: 'Failed to parse verdict', sources: [], parser_fallback: true };
  }
}

async function resolveDisagreement(disagreement) {
  const searchResults = await searchBrave(generateSearchQuery(disagreement.topic));
  const evidenceBlock = searchResults.map(r => `- "${r.title}": ${r.snippet}`).join('\n');
  const positionsBlock = Object.entries(disagreement.positions)
    .map(([m, pos]) => `${MODELS[m]?.name || m}: ${pos}`)
    .join('\n');

  const prompt = `You are resolving a factual disagreement between AI models.

IMPORTANT: Respond ONLY with valid JSON.

Topic: ${disagreement.topic}

Positions:
${positionsBlock}

Search evidence:
${evidenceBlock || 'No evidence found'}

Which position is better supported by evidence? Respond in this exact JSON format:
{
  "verdict": "brief summary of the correct position",
  "winning_position": "<model_id of the most accurate model, or 'inconclusive'>",
  "reasoning": "1-2 sentence explanation",
  "sources": [{ "title": "...", "url": "..." }]
}`;

  const { id: verifierId, caller } = requireVerifier();
  console.log(`[COUNCIL] Resolve disagreement "${disagreement.topic?.slice(0, 60)}" → verifier: ${verifierId}`);
  const result = await caller(
    'You are a precise fact-checker resolving disagreements. Respond ONLY with valid JSON.',
    prompt
  );

  if (result.status !== 'success' || !result.answer) {
    return { verdict: 'Inconclusive', winning_position: 'inconclusive', reasoning: 'Resolution failed', sources: searchResults };
  }
  try {
    let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = result.answer.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    console.warn(`[COUNCIL] Resolve disagreement: could not parse verifier JSON — marking inconclusive`);
    return { verdict: 'Inconclusive', winning_position: 'inconclusive', reasoning: 'Failed to parse', sources: searchResults, parser_fallback: true };
  }
}

async function synthesizeVerifiedAnswer(question, verifiedClaims, refutedClaims) {
  const verifiedBlock = verifiedClaims.map((vc, i) =>
    `[${i + 1}] ${vc.text} (Source: ${vc.sources?.[0]?.title || 'N/A'} - ${vc.sources?.[0]?.url || 'N/A'})`
  ).join('\n');
  const refutedBlock = refutedClaims.map(rc => `- ${rc.text} (Reason: ${rc.reasoning})`).join('\n');

  const prompt = `You are producing the final, authoritative answer for "The Council" verification system.
Using ONLY the verified claims below, write a comprehensive answer to the original question.
Include inline citations like [1], [2] referencing the numbered sources.

Original question: "${question}"

Verified claims with sources:
${verifiedBlock || 'No verified claims available'}

Claims to EXCLUDE (refuted):
${refutedBlock || 'None'}

Decision rule:
1. Answer the original choice/question first.
2. Prefer the option that directly accomplishes the user's stated goal.
3. Do not lead with a secondary action, such as scouting, checking prices, or saving effort, unless the user specifically asked for that secondary action.
4. Use efficiency, cost, health, safety, and environmental considerations as caveats after the primary recommendation.
5. If verified claims show an option cannot accomplish the stated goal without an additional step, do not present that option as the primary recommendation.

Write a clear, accurate, well-structured answer using only verified information. State the primary recommendation in the first sentence. Include [N] citations inline. Aim for 2-4 paragraphs.`;

  const { id: verifierId, caller } = requireVerifier();
  console.log(`[COUNCIL] Synthesize verified answer → verifier: ${verifierId}`);
  const result = await caller(
    'You are an authoritative synthesizer producing verified, cited answers.',
    prompt
  );

  if (result.status !== 'success') return null;

  const citations = verifiedClaims.map((vc, i) => ({
    index: i + 1,
    claim: vc.text,
    source: vc.sources?.[0] || null,
  }));

  return { answer: result.answer, citations };
}

function computeConfidenceScores(allClaims, verifications) {
  const scores = {};
  for (const [modelId, claims] of Object.entries(allClaims)) {
    const total = claims.filter(c => c.verifiable !== false).length;
    const verified = claims.filter(c => verifications[c.id]?.verdict === 'supported').length;
    const partial = claims.filter(c => verifications[c.id]?.verdict === 'partially_supported').length;
    const refuted = claims.filter(c => verifications[c.id]?.verdict === 'refuted').length;
    const unverifiable = claims.filter(c => !verifications[c.id] || verifications[c.id]?.verdict === 'unverifiable').length;
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

async function processInBatches(items, batchSize, delayMs, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

// ── Round 1: Independent Answers ────────────────────────────

app.get('/api/fixture/questions', (req, res) => {
  res.json({ questions: listDemoQuestions() });
});

app.post('/api/fixture/run', (req, res) => {
  const { question } = req.body || {};
  try {
    const report = runFixtureCouncil({ question });
    writeReport(report);
    res.json({ report: publicFixtureReport(report) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Fixture run failed' });
  }
});

app.post('/api/ask', async (req, res) => {
  const { question, systemPrompt, models, skipShadow } = req.body;
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'Question is required' });
  if (question.length > 10000) return res.status(400).json({ error: 'Question too long (max 10,000 chars)' });
  if (models && !Array.isArray(models)) return res.status(400).json({ error: 'Models must be an array' });

  const activeModels = (models || ['claude', 'gpt', 'gemini', 'grok']).filter(id => VALID_MODEL_IDS.has(id));
  const defaultSystem = systemPrompt ||
    `You are participating in "The Council" — a multi-AI deliberation panel. Answer the question clearly and concisely. Be direct and confident in your response. If the question involves data analysis, show your reasoning. Keep answers focused — aim for 2-4 paragraphs max unless the question demands more.`;

  console.log(`[COUNCIL] Question received: "${question.slice(0, 80)}..." (models: ${activeModels.join(', ')})`);

  // Set up SSE for streaming results as they arrive
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Round 1 uses search-enabled callers for web-grounded answers
  const promises = activeModels.map(async (modelId) => {
    const caller = searchCallers[modelId];
    if (!caller) return;
    const result = await caller(buildCouncilSystemPrompt(modelId, defaultSystem), question);
    result.councilRole = COUNCIL_ROLES[modelId]?.name || 'General Council analyst';
    console.log(`[COUNCIL] ${result.name} responded in ${result.latency}ms (${result.status})`);
    // Send each result as it arrives
    res.write(`data: ${JSON.stringify({ type: 'answer', result })}\n\n`);
    return result;
  });

  const results = await Promise.allSettled(promises);
  results.filter(r => r.status === 'rejected').forEach(r => console.error('[COUNCIL] Ask promise rejected:', r.reason?.message || r.reason));

  // Fire-and-forget: send answers to Shadow Council for verification
  questionCounter++;
  const successfulResults = results
    .filter(r => r.status === 'fulfilled' && r.value?.status === 'success')
    .map(r => r.value);

  // Shadow Council is optional and async, so we dispatch without awaiting — but
  // we report whether it was dispatched/skipped and log async failures rather
  // than swallowing them, so a degraded verification is never invisible.
  let shadow;
  if (skipShadow) {
    shadow = { dispatched: false, reason: 'skipped by request' };
  } else if (successfulResults.length === 0) {
    shadow = { dispatched: false, reason: 'no successful answers to verify' };
  } else {
    console.log(`[COUNCIL] Sending ${successfulResults.length} answers to Shadow Council (Q${questionCounter})`);
    shadow = { dispatched: true, questionNumber: questionCounter };
    fetch(`${SHADOW_COUNCIL_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_number: questionCounter,
        question: question.trim(),
        answers: successfulResults.map(a => ({
          model_id: a.id,
          model_name: a.name,
          answer: a.answer,
        })),
      }),
    }).catch(err => console.warn(`[COUNCIL] Shadow Council dispatch failed (Q${questionCounter}, optional): ${err.message}`));
  }

  res.write(`data: ${JSON.stringify({ type: 'complete', shadow, sessionUsage: { calls: sessionUsage.calls.length, totalInput: sessionUsage.totalInputTokens, totalOutput: sessionUsage.totalOutputTokens } })}\n\n`);
  res.end();
});

// ── Round 2: Peer Evaluation ────────────────────────────────

app.post('/api/evaluate', async (req, res) => {
  const { question, answers } = req.body;
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'Question is required' });
  if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'Answers array required' });

  const evalPrompt = `You are a judge on "The Council" — a multi-AI deliberation panel. You were asked a question alongside other AI models. Now you must evaluate their answers.

IMPORTANT: You must respond ONLY with valid JSON. No markdown, no code fences, no explanation outside the JSON.

The original question was:
"${question}"

Here are the answers from each model:
${answers.map(a => `### ${a.name} (${a.provider}):\n${a.answer}`).join('\n\n')}

Evaluation priorities:
1. Does the answer accomplish the user's stated goal, not just a nearby or easier goal?
2. Does it distinguish the primary recommendation from caveats, scouting, or alternate interpretations?
3. Does it avoid generic heuristics that conflict with the task's physical/logistical requirements?
4. Is it concise, accurate, and useful?

Rate EACH OTHER model's answer (not your own) on a scale of 1-100. Respond in this exact JSON format:
{
  "ratings": [
    {
      "model_id": "<model_id>",
      "score": <1-100>,
      "reasoning": "<1-2 sentence explanation of score>",
      "strength": "<key strength in a few words>",
      "weakness": "<key weakness in a few words or 'none' if excellent>"
    }
  ],
  "reflection": "<1-2 sentences on what you learned from reading the other answers>",
  "would_change": <true or false>,
  "revised_position": "<if would_change is true, briefly state your revised view, otherwise null>"
}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const evaluators = answers.map(a => a.id);

  const evalPromises = evaluators.map(async (evaluatorId) => {
    const caller = callers[evaluatorId];
    if (!caller) return;

    try {
      const otherAnswers = answers.filter(a => a.id !== evaluatorId);
      const specificPrompt = `${evalPrompt}\n\nYou are ${MODELS[evaluatorId].name}. Only rate the other models, not yourself. The model_ids to rate are: ${otherAnswers.map(a => a.id).join(', ')}`;

      const result = await caller(
        'You are a fair and analytical judge. Respond ONLY with valid JSON, no markdown formatting or code fences.',
        specificPrompt
      );

      // Try to parse the JSON from the response
      let evaluation = null;
      if (result.answer) {
        try {
          // Strip markdown code fences if present
          let cleaned = result.answer.trim();
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          evaluation = JSON.parse(cleaned);
        } catch (e) {
          // Try to extract JSON from the response
          const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              evaluation = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              console.warn(`[COUNCIL] ${evaluatorId} evaluation JSON parse failed (${e2.message}); returning parseError flag`);
              evaluation = { raw: result.answer, parseError: true };
            }
          } else {
            console.warn(`[COUNCIL] ${evaluatorId} evaluation produced no JSON object (${e.message})`);
          }
        }
      }

      res.write(`data: ${JSON.stringify({
        type: 'evaluation',
        evaluator: evaluatorId,
        evaluatorName: MODELS[evaluatorId].name,
        evaluation,
        latency: result.latency,
        status: result.status,
        usage: result.usage || null,
      })}\n\n`);
    } catch (err) {
      console.error(`Evaluation failed for ${evaluatorId}:`, err.message);
      res.write(`data: ${JSON.stringify({
        type: 'evaluation',
        evaluator: evaluatorId,
        evaluatorName: MODELS[evaluatorId].name,
        evaluation: null,
        latency: 0,
        status: 'error',
      })}\n\n`);
    }
  });

  const evalResults = await Promise.allSettled(evalPromises);
  evalResults.filter(r => r.status === 'rejected').forEach(r => console.error('[COUNCIL] Eval promise rejected:', r.reason?.message || r.reason));

  res.write(`data: ${JSON.stringify({ type: 'complete', sessionUsage: { calls: sessionUsage.calls.length, totalInput: sessionUsage.totalInputTokens, totalOutput: sessionUsage.totalOutputTokens } })}\n\n`);
  res.end();
});

// ── Round 2.5: Explicit Vote ─────────────────────────────────

app.post('/api/vote', async (req, res) => {
  const { question, answers, evaluations } = req.body;

  if (!question || !answers || !evaluations) {
    return res.status(400).json({ error: 'Question, answers, and evaluations required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const evalSummary = evaluations.map(ev => {
    const ratingsText = ev.evaluation?.ratings
      ? ev.evaluation.ratings.map(r => `  - ${r.model_id}: ${r.score}/100 — ${r.reasoning}`).join('\n')
      : '  (no ratings)';
    return `${ev.evaluatorName}:\n${ratingsText}`;
  }).join('\n\n');

  const votePrompt = `You are on "The Council" — a multi-AI deliberation panel. You have seen the question, all answers, and all peer evaluations. Now you must cast a FINAL VOTE for the BEST answer.

IMPORTANT: You must respond ONLY with valid JSON. No markdown, no code fences, no explanation outside the JSON.

The original question was:
"${question}"

Here are the answers from each model:
${answers.map(a => `### ${a.name} (${a.provider}) [id: ${a.id}]:\n${a.answer}`).join('\n\n')}

Here are the peer evaluations:
${evalSummary}

Voting priorities:
1. Pick the answer that best accomplishes the user's stated goal.
2. Treat physical/logistical feasibility as a hard requirement.
3. Use efficiency, convenience, cost, and safety as tie-breakers or caveats after feasibility.

Vote for the SINGLE BEST answer. You CANNOT vote for yourself. Consider accuracy, completeness, clarity, and the peer evaluation feedback.

Respond in this exact JSON format:
{
  "winner": "<model_id of the best answer>",
  "justification": "<1-2 sentences explaining your vote>"
}`;

  const allVotes = {};

  const votePromises = answers.map(async (a) => {
    const caller = callers[a.id];
    if (!caller) return;

    const otherIds = answers.filter(x => x.id !== a.id).map(x => x.id);
    const specificPrompt = `${votePrompt}\n\nYou are ${MODELS[a.id].name} (id: ${a.id}). You must vote for one of: ${otherIds.join(', ')}`;

    const start = Date.now();
    try {
      const result = await caller(
        'You are a decisive judge casting a final vote. Respond ONLY with valid JSON, no markdown formatting or code fences.',
        specificPrompt
      );

      let vote = null;
      if (result.answer) {
        try {
          let cleaned = result.answer.trim();
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          vote = JSON.parse(cleaned);
        } catch (e) {
          const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              vote = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              console.warn(`[COUNCIL] vote JSON parse failed (${e2.message}); defaulting to first peer`);
              vote = { winner: otherIds[0], justification: 'Unable to parse vote response', parseError: true };
            }
          } else {
            console.warn(`[COUNCIL] vote produced no JSON object (${e.message})`);
          }
        }
      }

      // Ensure vote is valid (can't vote for self)
      if (vote && (vote.winner === a.id || !otherIds.includes(vote.winner))) {
        vote.winner = otherIds[0];
        vote.justification = (vote.justification || '') + ' (vote corrected — original was invalid)';
      }

      if (vote) allVotes[a.id] = vote;

      res.write(`data: ${JSON.stringify({
        type: 'vote',
        voter: a.id,
        voterName: MODELS[a.id].name,
        vote,
        latency: result.latency,
        status: result.status,
      })}\n\n`);
    } catch (err) {
      console.error(`Vote failed for ${a.id}:`, err.message);
      res.write(`data: ${JSON.stringify({
        type: 'vote',
        voter: a.id,
        voterName: MODELS[a.id].name,
        vote: null,
        latency: Date.now() - start,
        status: 'error',
      })}\n\n`);
    }
  });

  const voteResults = await Promise.allSettled(votePromises);
  voteResults.filter(r => r.status === 'rejected').forEach(r => console.error('[COUNCIL] Vote promise rejected:', r.reason?.message || r.reason));

  // Compute tally
  const tally = {};
  answers.forEach(a => { tally[a.id] = { votes: 0, voters: [] }; });

  Object.entries(allVotes).forEach(([voterId, vote]) => {
    if (vote?.winner && tally[vote.winner]) {
      tally[vote.winner].votes++;
      tally[vote.winner].voters.push(voterId);
    }
  });

  const maxVotes = Math.max(...Object.values(tally).map(t => t.votes));
  const winners = Object.keys(tally).filter(id => tally[id].votes === maxVotes);
  const winner = winners.length === 1 ? winners[0] : winners[0]; // Pick first in tie
  const unanimous = Object.values(tally).filter(t => t.votes > 0).length === 1 && maxVotes === answers.length;

  res.write(`data: ${JSON.stringify({
    type: 'tally',
    results: tally,
    winner,
    tie: winners.length > 1,
    tiedModels: winners.length > 1 ? winners : undefined,
    unanimous,
  })}\n\n`);

  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  res.end();
});

// ── Round 3: Verification Swarm ─────────────────────────────

app.post('/api/verify', async (req, res) => {
  const { question, answers } = req.body;

  if (!question || !answers) return res.status(400).json({ error: 'Question and answers required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => sendEvent({ type: 'heartbeat' }), 15000);

  try {
    // Phase 1: Extract claims from each answer in parallel
    const allClaims = {};
    const claimPromises = answers.filter(a => a.answer).map(async (a) => {
      const claims = await extractClaimsFromAnswer(a.id, a.name, a.answer);
      allClaims[a.id] = claims;
      sendEvent({ type: 'claims', modelId: a.id, claims });
      return claims;
    });
    await Promise.allSettled(claimPromises);

    // Phase 2: Cross-reference claims
    const crossRef = await crossReferenceClaims(allClaims, MODELS);
    sendEvent({ type: 'cross_reference', matrix: crossRef });

    // Phase 3: Web verification — fan out agents for each verifiable claim
    const verifications = {};
    const allClaimsList = Object.values(allClaims).flat().filter(c => c.verifiable !== false);

    // De-duplicate: for agreed claims, only verify one representative
    const agreedClaimIds = new Set((crossRef.agreed || []).flatMap(a => a.claimIds?.slice(1) || []));
    const claimsToVerify = allClaimsList.filter(c => !agreedClaimIds.has(c.id));

    await processInBatches(claimsToVerify, 3, 300, async (claim) => {
      sendEvent({ type: 'verification_progress', claimId: claim.id, status: 'searching' });

      // Reasoning claims are checked by re-derivation; skip the (useless) web search for them.
      const searchResults = isReasoningClaim(claim) ? [] : await searchBrave(generateSearchQuery(claim.text));

      sendEvent({ type: 'verification_progress', claimId: claim.id, status: 'analyzing' });

      const result = await verifyClaim(claim, searchResults);
      verifications[claim.id] = result;

      sendEvent({ type: 'verification', claimId: claim.id, result });
    });

    // Copy verdicts to agreed claims that were skipped
    for (const agreed of (crossRef.agreed || [])) {
      if (agreed.claimIds && agreed.claimIds.length > 1) {
        const primary = agreed.claimIds[0];
        if (verifications[primary]) {
          for (const dupId of agreed.claimIds.slice(1)) {
            verifications[dupId] = { ...verifications[primary] };
            sendEvent({ type: 'verification', claimId: dupId, result: verifications[dupId] });
          }
        }
      }
    }

    // Sweep: ensure no claims are left without a verdict
    for (const claim of allClaimsList) {
      if (!verifications[claim.id]) {
        verifications[claim.id] = { verdict: 'unverifiable', confidence: 0, reasoning: 'Verification did not complete', sources: [] };
        sendEvent({ type: 'verification', claimId: claim.id, result: verifications[claim.id] });
      }
    }

    // Phase 4: Resolve disagreements
    const resolutions = [];
    for (const disagreement of (crossRef.disagreed || [])) {
      const resolution = await resolveDisagreement(disagreement);
      resolutions.push({ topic: disagreement.topic, resolution });
      sendEvent({ type: 'disagreement_resolution', topic: disagreement.topic, resolution });
    }

    // Phase 5: Compute confidence scores
    const scores = computeConfidenceScores(allClaims, verifications);
    sendEvent({ type: 'confidence_scores', scores });

    // Phase 6: Synthesize verified answer
    const verifiedClaims = allClaimsList.filter(c => {
      const v = verifications[c.id];
      return v && (v.verdict === 'supported' || v.verdict === 'partially_supported');
    }).map(c => ({ ...c, ...verifications[c.id] }));

    const refutedClaims = allClaimsList.filter(c => {
      const v = verifications[c.id];
      return v && v.verdict === 'refuted';
    }).map(c => ({ ...c, ...verifications[c.id] }));

    const synthesis = await synthesizeVerifiedAnswer(question, verifiedClaims, refutedClaims);
    if (synthesis) {
      sendEvent({ type: 'synthesis', ...synthesis });
    }

    sendEvent({ type: 'complete' });
  } catch (err) {
    console.error('Verification error:', err);
    sendEvent({ type: 'error', message: err.message });
    sendEvent({ type: 'complete' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ── Health Check ────────────────────────────────────────────

// ── Model Config & Usage Endpoints ────────────────────────

function applyModelSelections(models) {
  if (!models) return;
  Object.entries(models).forEach(([id, modelString]) => {
    const option = MODEL_OPTIONS[id]?.find(o => o.model === modelString);
    if (option && MODELS[id]) {
      MODELS[id].model = option.model;
      MODELS[id].name = option.label;
    }
  });
  // Forward Claude model to Shadow Council
  if (models.claude) {
    fetch(`${SHADOW_COUNCIL_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELS.claude.model }),
    }).catch(() => {});
  }
}

app.post('/api/config', (req, res) => {
  applyModelSelections(req.body.models);
  res.json({ status: 'ok', models: MODELS });
});

app.get('/api/models', (req, res) => {
  res.json({ current: MODELS, options: MODEL_OPTIONS });
});

app.post('/api/models', (req, res) => {
  applyModelSelections(req.body.models);
  res.json({ status: 'ok', models: MODELS });
});

app.get('/api/usage', (req, res) => {
  res.json(sessionUsage);
});

app.post('/api/usage/reset', (req, res) => {
  sessionUsage.reset();
  res.json({ status: 'ok' });
});

// ── AI-Powered Pricing Research (The Double Twist) ────────

app.post('/api/research-pricing', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'status', message: 'Cost Analyst Agent researching live pricing...' })}\n\n`);

  try {
    const modelsToResearch = Object.values(MODEL_OPTIONS).flat().map(o => o.model).join(', ');

    const result = await callClaudeWithSearch(
      'You are a meticulous cost analyst. Search official pricing pages and return accurate, current pricing data as JSON. No markdown fences.',
      `Search the web for the CURRENT pricing of these specific AI models. Check the official pricing pages of each provider (anthropic.com/pricing, openai.com/api/pricing, ai.google.dev/pricing, x.ai/api).

Models to research: ${modelsToResearch}

Return ONLY this exact JSON format:
{
  "pricing": {
    "<model-id>": { "input_per_million": <number>, "output_per_million": <number>, "source": "<url>" }
  },
  "research_notes": "<brief summary of findings>"
}`
    );

    let parsed = null;
    if (result.answer) {
      try {
        let cleaned = result.answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const match = result.answer.match(/\{[\s\S]*\}/);
        if (match) try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'pricing', data: parsed, raw: result.answer })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  res.end();
});

app.get('/api/health', (req, res) => {
  const keys = {
    claude: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-key-here',
    gpt: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-key-here',
    gemini: !!process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your-google-key-here',
    grok: !!process.env.XAI_API_KEY && process.env.XAI_API_KEY !== 'your-xai-key-here',
    brave_search: !!process.env.BRAVE_SEARCH_API_KEY && process.env.BRAVE_SEARCH_API_KEY !== 'your-brave-search-key-here',
  };
  // Live Council needs >=2 configured providers for peer evaluation. Report a
  // degraded status (not a blanket "ok") when live mode can't actually run, so
  // a caller can't be misled into thinking providers are ready when they aren't.
  // Fixture mode never needs keys, so it stays available regardless.
  const providerIds = ['claude', 'gpt', 'gemini', 'grok'];
  const configuredProviders = providerIds.filter(id => keys[id]);
  const liveReady = configuredProviders.length >= 2;
  res.json({
    status: liveReady ? 'ok' : 'degraded',
    live: {
      ready: liveReady,
      configuredProviders,
      missingProviders: providerIds.filter(id => !keys[id]),
      reason: liveReady ? null : 'Live Council needs at least two configured provider keys; fixture mode remains available.',
    },
    models: MODELS,
    modelOptions: MODEL_OPTIONS,
    keysConfigured: keys,
    fixtureMode: {
      available: true,
      requiresProviderKeys: false,
      questionsEndpoint: '/api/fixture/questions',
      runEndpoint: '/api/fixture/run',
    },
  });
});

// ── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n⚡ THE COUNCIL server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    console.log('   Note: BRAVE_SEARCH_API_KEY not set — using LLM knowledge fallback for verification');
  }
  console.log();
});
