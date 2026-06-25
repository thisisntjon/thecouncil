// Workstream A — Cost Telemetry Harness
//
// Captures per-call, per-step token + cost telemetry for N questions through the
// full Council + Shadow pipeline. Writes one JSON file per question to
// research/A-data/*.json. Does NOT modify server/shadow code — attribution is
// done by snapshotting /api/usage between steps and diffing.
//
// Usage: QUESTION_IDS=factual,numeric node scripts/research-instrumented-smoke.mjs
//   (omit env var to run all 5 canonical questions)

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'research', 'A-data');

const MAIN_PORT = 3011;
const SHADOW_PORT = 3022;
const MAIN_URL = `http://localhost:${MAIN_PORT}`;
const SHADOW_URL = `http://localhost:${SHADOW_PORT}`;
const SHADOW_TIMEOUT_MS = 6 * 60 * 1000;

// ── Questions (5 diverse shapes, per workstream A plan) ─────
const QUESTIONS = [
  { id: 'factual',        text: 'Who was the first US president, when was he inaugurated, and what was the US population at the time?' },
  { id: 'analytical',     text: 'What are the primary arguments for and against supply-side economics, and what empirical evidence exists for each?' },
  { id: 'numeric',        text: 'What is the speed of light in vacuum, how long does sunlight take to reach Earth, and what is Earth\'s orbital velocity around the Sun?' },
  { id: 'historical',     text: 'What caused the 1929 stock market crash, when did the Great Depression officially end, and what was the unemployment rate at its peak?' },
  { id: 'current-events', text: 'What was the outcome of the 2024 US presidential election, what were the key policy differences between the candidates, and what was the voter turnout?' },
];

// ── Pricing (USD per million tokens) — snapshot of MODEL_OPTIONS ─────
const PRICING = {
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001':  { input: 1.00,  output: 5.00 },
  'gpt-5.2':                    { input: 1.75,  output: 14.00 },
  'gpt-4.1':                    { input: 2.00,  output: 8.00 },
  'gpt-4.1-mini':               { input: 0.40,  output: 1.60 },
  'gpt-5-search-api':           { input: 1.75,  output: 14.00 }, // approximation
  'gemini-3-flash-preview':     { input: 0.50,  output: 3.00 },
  'gemini-2.5-flash':           { input: 0.15,  output: 0.60 },
  'gemini-2.5-flash-lite':      { input: 0.10,  output: 0.40 },
  'grok-4-1-fast-reasoning':    { input: 0.20,  output: 0.50 },
  'grok-3-mini':                { input: 0.30,  output: 0.50 },
};

function costOfCall(call) {
  const p = PRICING[call.model];
  if (!p) return { cost: 0, unpriced: true, model: call.model };
  const cost = (call.input / 1_000_000) * p.input + (call.output / 1_000_000) * p.output;
  return { cost, unpriced: false };
}

function log(...args) { console.log('[A-HARNESS]', ...args); }

// ── Service management ──────────────────────────────────────
function spawnService(name, cwd, port, extraEnv = {}) {
  const portEnv = name === 'shadow' ? { SHADOW_PORT: String(port) } : { PORT: String(port) };
  const env = { ...process.env, ...portEnv, ...extraEnv };
  const child = spawn(process.execPath, ['index.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const buf = [];
  child.stdout.on('data', (d) => buf.push(d.toString()));
  child.stderr.on('data', (d) => { buf.push(d.toString()); process.stderr.write(`[${name}:err] ${d}`); });
  return { child, getLog: () => buf.join('') };
}

async function waitForHealth(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(`${url}/api/health`); if (res.ok) return await res.json(); } catch {}
    await sleep(300);
  }
  throw new Error(`Health check timed out for ${url}`);
}

// ── SSE reader ──────────────────────────────────────────────
async function readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try { onEvent(JSON.parse(line.slice(6))); } catch {}
      }
    }
  }
}

// ── Usage helpers ───────────────────────────────────────────
async function snapshotUsage(url) {
  const res = await fetch(`${url}/api/usage`);
  return res.json();
}
async function resetUsage(url) {
  await fetch(`${url}/api/usage/reset`, { method: 'POST' });
}

// Return calls recorded since a previous snapshot (by index, since sessionUsage.calls
// is append-only until reset).
function callsSince(before, after) {
  return after.calls.slice(before.calls.length);
}

function summarizeCalls(calls) {
  const byModel = {};
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  for (const c of calls) {
    const { cost, unpriced } = costOfCall(c);
    const k = `${c.provider}/${c.model}`;
    byModel[k] = byModel[k] || { count: 0, inputTokens: 0, outputTokens: 0, cost: 0, unpriced };
    byModel[k].count++;
    byModel[k].inputTokens += c.input;
    byModel[k].outputTokens += c.output;
    byModel[k].cost += cost;
    totalInput += c.input;
    totalOutput += c.output;
    totalCost += cost;
  }
  return { byModel, totalInput, totalOutput, totalCost, callCount: calls.length };
}

// ── Shadow stream subscriber (tracks pipeline_complete) ─────
function subscribeShadow() {
  const completed = new Set();
  const failed = new Map();
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(`${SHADOW_URL}/api/stream`, { signal: ctrl.signal });
      await readSSE(res, (ev) => {
        if (ev.type === 'pipeline_complete') completed.add(ev.question_number);
        if (ev.type === 'status_change' && ev.status === 'error') failed.set(ev.question_number, ev.error);
      });
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[A-HARNESS] shadow stream error:', err.message);
    }
  })();
  return {
    completed, failed,
    close: () => ctrl.abort(),
    waitFor(id, timeoutMs) {
      const start = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          if (completed.has(id)) return resolve({ done: true });
          if (failed.has(id))    return resolve({ done: false, error: failed.get(id) });
          if (Date.now() - start > timeoutMs) return resolve({ done: false, error: 'timeout' });
          setTimeout(tick, 1000);
        };
        tick();
      });
    },
  };
}

// ── Per-question flow ───────────────────────────────────────
async function runQuestion(q, qIdx, shadowTracker) {
  const expectedShadowQNum = qIdx + 1; // questionCounter increments per /api/ask
  const result = {
    id: q.id,
    questionIndex: qIdx,
    question: q.text,
    startedAt: new Date().toISOString(),
    steps: {},
    totalCost: 0,
    totalCalls: 0,
    errors: [],
  };

  try {
    // Reset both services' usage counters so calls for this Q are isolated
    await resetUsage(MAIN_URL);
    await resetUsage(SHADOW_URL);

    // ── Step 1: /api/ask (Round 1, fires shadow async) ──
    let before = await snapshotUsage(MAIN_URL);
    const askResp = { answers: [], errors: [] };
    const askRes = await fetch(`${MAIN_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q.text, models: ['claude', 'gpt', 'gemini', 'grok'] }),
    });
    await readSSE(askRes, (ev) => {
      if (ev.type === 'answer') {
        if (ev.result.status === 'success' && ev.result.answer) askResp.answers.push(ev.result);
        else askResp.errors.push(ev.result);
      }
    });
    let after = await snapshotUsage(MAIN_URL);
    const askCalls = callsSince(before, after);
    result.steps.ask = {
      calls: askCalls,
      summary: summarizeCalls(askCalls),
      answersOK: askResp.answers.length,
      answersError: askResp.errors.length,
    };

    // If we got 0 answers, we can't continue the flow
    if (askResp.answers.length === 0) {
      result.errors.push('No answers from /api/ask — aborting');
      return result;
    }

    const answersPayload = askResp.answers.map(a => ({
      id: a.id, name: a.name, provider: a.provider, answer: a.answer,
    }));

    // ── Step 2: /api/evaluate (Round 2) ──
    before = after;
    const evalRes = await fetch(`${MAIN_URL}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q.text, answers: answersPayload }),
    });
    const evalCount = { ok: 0, err: 0 };
    await readSSE(evalRes, (ev) => {
      if (ev.type === 'evaluation') {
        if (ev.evaluation?.ratings) evalCount.ok++;
        else evalCount.err++;
      }
    });
    after = await snapshotUsage(MAIN_URL);
    const evalCalls = callsSince(before, after);
    result.steps.evaluate = {
      calls: evalCalls,
      summary: summarizeCalls(evalCalls),
      evaluationsOK: evalCount.ok,
      evaluationsError: evalCount.err,
    };

    // ── Step 3: /api/verify (Round 3) ──
    before = after;
    const verifyRes = await fetch(`${MAIN_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q.text, answers: answersPayload }),
    });
    const verifySummary = { claims: 0, verifications: 0, disagreements: 0, synthesis: null, complete: false };
    await readSSE(verifyRes, (ev) => {
      if (ev.type === 'claims') verifySummary.claims += ev.claims?.length || 0;
      else if (ev.type === 'verification') verifySummary.verifications++;
      else if (ev.type === 'disagreement_resolution') verifySummary.disagreements++;
      else if (ev.type === 'synthesis') verifySummary.synthesis = { answerLen: ev.answer?.length || 0, citations: ev.citations?.length || 0 };
      else if (ev.type === 'complete') verifySummary.complete = true;
    });
    after = await snapshotUsage(MAIN_URL);
    const verifyCalls = callsSince(before, after);
    result.steps.verify = {
      calls: verifyCalls,
      summary: summarizeCalls(verifyCalls),
      ...verifySummary,
    };

    // ── Step 4: wait for shadow pipeline (started by /api/ask auto-fire) ──
    log(`  waiting for shadow pipeline_complete(${expectedShadowQNum})...`);
    const shadowWait = await shadowTracker.waitFor(expectedShadowQNum, SHADOW_TIMEOUT_MS);
    if (!shadowWait.done) {
      result.errors.push(`shadow pipeline did not complete: ${shadowWait.error}`);
    }

    // ── Step 5: snapshot shadow usage (entire pipeline was for this Q) ──
    const shadowUsage = await snapshotUsage(SHADOW_URL);
    result.steps.shadow = {
      calls: shadowUsage.calls,
      summary: summarizeCalls(shadowUsage.calls),
      pipelineComplete: shadowWait.done,
    };

    // Aggregate
    result.totalCost = Object.values(result.steps).reduce((a, s) => a + (s.summary?.totalCost || 0), 0);
    result.totalCalls = Object.values(result.steps).reduce((a, s) => a + (s.summary?.callCount || 0), 0);
  } catch (err) {
    result.errors.push(`exception: ${err.message}`);
  }

  result.endedAt = new Date().toISOString();
  return result;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const subset = process.env.QUESTION_IDS;
  const questions = subset
    ? QUESTIONS.filter(q => subset.split(',').includes(q.id))
    : QUESTIONS;
  if (questions.length === 0) {
    console.error(`No questions matched QUESTION_IDS=${subset}`);
    process.exit(1);
  }

  log(`Running ${questions.length} question(s):`, questions.map(q => q.id).join(', '));

  const mainSvc = spawnService('council', join(ROOT, 'server'), MAIN_PORT, { SHADOW_COUNCIL_URL: SHADOW_URL });
  const shadowSvc = spawnService('shadow', join(ROOT, 'shadow-council'), SHADOW_PORT);
  const overallStart = Date.now();

  let shadowTracker = null;
  const allResults = [];

  try {
    await waitForHealth(MAIN_URL);
    await waitForHealth(SHADOW_URL);
    log('Both services healthy.');

    shadowTracker = subscribeShadow();
    await sleep(500);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      log(`[${i + 1}/${questions.length}] ${q.id}: ${q.text.slice(0, 70)}...`);
      const result = await runQuestion(q, i, shadowTracker);
      allResults.push(result);

      const outFile = join(DATA_DIR, `${q.id}.json`);
      writeFileSync(outFile, JSON.stringify(result, null, 2));
      log(`  wrote ${outFile} — ${result.totalCalls} calls, $${result.totalCost.toFixed(4)}, errors=${result.errors.length}`);
    }
  } catch (err) {
    console.error('[A-HARNESS] fatal:', err.message);
  } finally {
    shadowTracker?.close();
    log('Shutting down services...');
    mainSvc.child.kill('SIGTERM');
    shadowSvc.child.kill('SIGTERM');
    await sleep(500);
  }

  // ── Summary ────────────────────────────────────────────
  const totalCost = allResults.reduce((a, r) => a + r.totalCost, 0);
  const totalCalls = allResults.reduce((a, r) => a + r.totalCalls, 0);
  console.log('\n========== A-HARNESS SUMMARY ==========');
  console.log(`Wall time: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);
  console.log(`Questions:  ${allResults.length}`);
  console.log(`Total calls: ${totalCalls}`);
  console.log(`Total cost:  $${totalCost.toFixed(4)}`);
  console.log('\nPer question:');
  for (const r of allResults) {
    const e = r.errors.length ? ` (${r.errors.length} errors)` : '';
    console.log(`  ${r.id.padEnd(16)} calls=${String(r.totalCalls).padStart(4)}  cost=$${r.totalCost.toFixed(4)}${e}`);
  }
  console.log('\nPer-step totals (across all questions):');
  const stepTotals = {};
  for (const r of allResults) {
    for (const [step, data] of Object.entries(r.steps)) {
      stepTotals[step] = stepTotals[step] || { calls: 0, cost: 0 };
      stepTotals[step].calls += data.summary?.callCount || 0;
      stepTotals[step].cost += data.summary?.totalCost || 0;
    }
  }
  for (const [step, data] of Object.entries(stepTotals)) {
    console.log(`  ${step.padEnd(12)} calls=${String(data.calls).padStart(4)}  cost=$${data.cost.toFixed(4)}`);
  }
  console.log('=======================================\n');

  const aggregateFile = join(DATA_DIR, '_aggregate.json');
  writeFileSync(aggregateFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    wallTimeMs: Date.now() - overallStart,
    totalCost,
    totalCalls,
    stepTotals,
    questions: allResults.map(r => ({ id: r.id, totalCost: r.totalCost, totalCalls: r.totalCalls, errors: r.errors })),
  }, null, 2));
  log(`Aggregate written to ${aggregateFile}`);

  process.exit(0);
}

main().catch((err) => { console.error('[A-HARNESS] fatal:', err); process.exit(1); });
