// End-to-end batch smoke test for The Council + Shadow Council.
//
// Batch A: COUNCIL_COUNT questions through /api/ask → /api/evaluate → /api/verify.
//          Each /api/ask auto-fires to shadow, so shadow also runs a pipeline per Q.
// Batch B: SHADOW_COUNT different questions. /api/ask with skipShadow=true to get
//          answers, then POST directly to shadow /api/verify with a distinct
//          question_number (1000 + i) so pipelines don't collide with Batch A's.
//
// Usage: COUNCIL_COUNT=10 SHADOW_COUNT=10 node scripts/e2e-batch-smoke.mjs

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const COUNCIL_COUNT = parseInt(process.env.COUNCIL_COUNT || '1', 10);
const SHADOW_COUNT = parseInt(process.env.SHADOW_COUNT || '1', 10);
const MAIN_PORT = 3011;
const SHADOW_PORT = 3022;
const MAIN_URL = `http://localhost:${MAIN_PORT}`;
const SHADOW_URL = `http://localhost:${SHADOW_PORT}`;

// Shadow pipeline can take 1–3 minutes per question.
const SHADOW_PIPELINE_TIMEOUT_MS = 6 * 60 * 1000; // 6 min per batch (not per Q)

const COUNCIL_QUESTIONS = [
  'Who was the first US president, when was he inaugurated, and what was the US population at the time?',
  'When did the Berlin Wall fall, and approximately how long was the wall?',
  'Who wrote "Pride and Prejudice" and when was it first published?',
  'What is the chemical formula for table salt, and what is its melting point in Celsius?',
  'Who discovered penicillin, in what year, and at what institution?',
  'What is the tallest mountain in Africa, how tall is it, and in what country is it located?',
  'Who directed the 1941 film "Citizen Kane" and what was the film\'s reported budget?',
  'What is the average distance from Earth to the Moon, and how long does light take to travel that distance?',
  'Who won the 2018 FIFA World Cup, what was the final score, and who scored the opening goal of the final?',
  'When was the Eiffel Tower completed, how tall is it, and who was its lead engineer?',
];

const SHADOW_QUESTIONS = [
  'Who invented the World Wide Web, in what year, and at which organization?',
  'What are the three main classifications of rocks in geology?',
  'Who was the first woman to win a Nobel Prize, in what field, and in what year?',
  'What is the speed of sound in dry air at 20°C, and how does it compare to the speed of light?',
  'In what year did the Western Roman Empire fall, and who was its last emperor?',
  'Who composed Beethoven\'s 9th Symphony, when was it premiered, and approximately how long is it?',
  'What is the largest ocean on Earth, roughly what fraction of Earth\'s water does it hold, and what is its deepest point?',
  'Who founded the Mongol Empire, in what year, and roughly what was its greatest territorial extent?',
  'What is photosynthesis, what inputs does it require, and what outputs does it produce?',
  'Who painted the Sistine Chapel ceiling, over what period, and what is the name of its most famous scene?',
];

function log(...args) { console.log('[BATCH]', ...args); }

function spawnService(name, cwd, port, extraEnv = {}) {
  // Shadow uses SHADOW_PORT; council uses PORT.
  const portEnv = name === 'shadow' ? { SHADOW_PORT: String(port) } : { PORT: String(port) };
  const env = { ...process.env, ...portEnv, ...extraEnv };
  const child = spawn(process.execPath, ['index.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const buf = [];
  child.stdout.on('data', (d) => {
    const s = d.toString();
    buf.push(s);
    // Comment out for quieter batch runs; uncomment to debug
    // process.stdout.write(`[${name}] ${s}`);
  });
  child.stderr.on('data', (d) => {
    const s = d.toString();
    buf.push(s);
    process.stderr.write(`[${name}:err] ${s}`);
  });
  return { child, getLog: () => buf.join('') };
}

async function waitForHealth(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(300);
  }
  throw new Error(`Health check timed out for ${url}`);
}

async function readSSE(response, onEvent, onDone) {
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
  onDone?.();
}

// ── Shadow completion tracker (subscribe to /api/stream) ────
function subscribeShadowStream() {
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
      if (err.name !== 'AbortError') console.error('[BATCH] shadow stream error:', err.message);
    }
  })();

  return {
    completed,
    failed,
    close: () => ctrl.abort(),
    waitFor(ids, timeoutMs) {
      const start = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          const pending = ids.filter((id) => !completed.has(id) && !failed.has(id));
          if (pending.length === 0) return resolve({ done: true, pending: [] });
          if (Date.now() - start > timeoutMs) return resolve({ done: false, pending });
          setTimeout(tick, 1000);
        };
        tick();
      });
    },
  };
}

async function runCouncilQuestion(qIdx, question) {
  const t0 = Date.now();
  const out = { qIdx, question, ask: { answers: [], errors: [] }, evaluate: { evals: [], errors: [] }, verify: null, ok: false };

  // Round 1
  const askRes = await fetch(`${MAIN_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, models: ['claude', 'gpt', 'gemini', 'grok'] }),
  });
  if (!askRes.ok) throw new Error(`/api/ask ${askRes.status}`);
  await readSSE(askRes, (ev) => {
    if (ev.type === 'answer') {
      if (ev.result.status === 'success' && ev.result.answer) out.ask.answers.push(ev.result);
      else out.ask.errors.push(ev.result);
    }
  });

  if (out.ask.answers.length === 0) return out;

  const answers = out.ask.answers.map(a => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer }));

  // Round 2
  const evalRes = await fetch(`${MAIN_URL}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answers }),
  });
  await readSSE(evalRes, (ev) => {
    if (ev.type === 'evaluation') {
      if (ev.evaluation?.ratings) out.evaluate.evals.push(ev);
      else out.evaluate.errors.push(ev);
    }
  });

  // Round 3
  const verifyRes = await fetch(`${MAIN_URL}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answers }),
  });
  const verify = { claims: [], crossRef: null, verifications: 0, disagreements: 0, synthesis: null, complete: false };
  await readSSE(verifyRes, (ev) => {
    if (ev.type === 'claims') verify.claims.push({ modelId: ev.modelId, n: ev.claims?.length || 0 });
    else if (ev.type === 'cross_reference') verify.crossRef = ev.matrix;
    else if (ev.type === 'verification') verify.verifications++;
    else if (ev.type === 'disagreement_resolution') verify.disagreements++;
    else if (ev.type === 'synthesis') verify.synthesis = { len: ev.answer?.length || 0, cites: ev.citations?.length || 0 };
    else if (ev.type === 'complete') verify.complete = true;
  });
  out.verify = verify;
  out.durationMs = Date.now() - t0;
  out.ok = out.ask.answers.length >= 3 && out.evaluate.evals.length >= 3 && verify.complete && !!verify.synthesis;
  return out;
}

async function runShadowQuestion(qIdx, question, shadowQNum) {
  const t0 = Date.now();
  const out = { qIdx, question, shadowQNum, ask: { answers: [], errors: [] }, submitted: false };

  // Get answers via council but skip shadow auto-fire
  const askRes = await fetch(`${MAIN_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, models: ['claude', 'gpt', 'gemini', 'grok'], skipShadow: true }),
  });
  if (!askRes.ok) throw new Error(`/api/ask ${askRes.status}`);
  await readSSE(askRes, (ev) => {
    if (ev.type === 'answer') {
      if (ev.result.status === 'success' && ev.result.answer) out.ask.answers.push(ev.result);
      else out.ask.errors.push(ev.result);
    }
  });

  if (out.ask.answers.length === 0) return out;

  // POST direct to shadow
  const payload = {
    question_number: shadowQNum,
    question,
    answers: out.ask.answers.map(a => ({ model_id: a.id, model_name: a.name, answer: a.answer })),
  };
  const shadowRes = await fetch(`${SHADOW_URL}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  out.submitted = shadowRes.ok;
  out.submitDurationMs = Date.now() - t0;
  return out;
}

function tallyVerifierHits(log) {
  const re = /→ verifier:\s*(\w+)/g;
  const hits = {};
  let m;
  while ((m = re.exec(log)) !== null) hits[m[1]] = (hits[m[1]] || 0) + 1;
  return hits;
}

async function main() {
  log(`Starting: COUNCIL_COUNT=${COUNCIL_COUNT}, SHADOW_COUNT=${SHADOW_COUNT}`);
  const mainSvc = spawnService('council', join(ROOT, 'server'), MAIN_PORT, { SHADOW_COUNCIL_URL: SHADOW_URL });
  const shadowSvc = spawnService('shadow', join(ROOT, 'shadow-council'), SHADOW_PORT);
  const overallStart = Date.now();

  let exit = 0;
  let shadowTracker = null;
  const councilResults = [];
  const shadowResults = [];

  try {
    await waitForHealth(MAIN_URL);
    await waitForHealth(SHADOW_URL);
    log('Both services healthy.');

    shadowTracker = subscribeShadowStream();
    await sleep(500); // give stream a moment to connect

    // ── Batch A ────────────────────────────────────────────
    log(`Batch A: ${COUNCIL_COUNT} council question(s), full 3-round flow`);
    for (let i = 0; i < COUNCIL_COUNT; i++) {
      const q = COUNCIL_QUESTIONS[i % COUNCIL_QUESTIONS.length];
      log(`  [A${i + 1}/${COUNCIL_COUNT}] ${q.slice(0, 70)}...`);
      try {
        const r = await runCouncilQuestion(i, q);
        councilResults.push(r);
        log(`  [A${i + 1}] ${r.ok ? 'OK' : 'FAIL'} answers=${r.ask.answers.length} evals=${r.evaluate.evals.length} verify.complete=${r.verify?.complete} ${(r.durationMs / 1000).toFixed(1)}s`);
      } catch (err) {
        councilResults.push({ qIdx: i, question: q, error: err.message });
        log(`  [A${i + 1}] ERROR ${err.message}`);
      }
    }

    // Wait for shadow to drain Batch A auto-fires (question_numbers 1..COUNCIL_COUNT)
    const batchAShadowIds = Array.from({ length: COUNCIL_COUNT }, (_, i) => i + 1);
    log(`Waiting for shadow to finish Batch A pipelines (${batchAShadowIds.length})...`);
    const batchAWait = await shadowTracker.waitFor(batchAShadowIds, SHADOW_PIPELINE_TIMEOUT_MS);
    if (!batchAWait.done) log(`  WARN: ${batchAWait.pending.length} shadow pipelines still pending after timeout: ${batchAWait.pending.join(', ')}`);
    else log('  Batch A shadow pipelines all complete.');

    // ── Batch B ────────────────────────────────────────────
    log(`Batch B: ${SHADOW_COUNT} shadow question(s), /api/ask (skipShadow) → shadow /api/verify direct`);
    for (let i = 0; i < SHADOW_COUNT; i++) {
      const q = SHADOW_QUESTIONS[i % SHADOW_QUESTIONS.length];
      const shadowQNum = 1000 + i + 1;
      log(`  [B${i + 1}/${SHADOW_COUNT}] Q#${shadowQNum}: ${q.slice(0, 70)}...`);
      try {
        const r = await runShadowQuestion(i, q, shadowQNum);
        shadowResults.push(r);
        log(`  [B${i + 1}] submitted=${r.submitted} answers=${r.ask.answers.length} ${(r.submitDurationMs / 1000).toFixed(1)}s`);
      } catch (err) {
        shadowResults.push({ qIdx: i, question: q, error: err.message });
        log(`  [B${i + 1}] ERROR ${err.message}`);
      }
    }

    // Wait for shadow to finish Batch B direct pipelines
    const batchBShadowIds = shadowResults.filter(r => r.submitted).map(r => r.shadowQNum);
    log(`Waiting for shadow to finish Batch B pipelines (${batchBShadowIds.length})...`);
    const batchBWait = await shadowTracker.waitFor(batchBShadowIds, SHADOW_PIPELINE_TIMEOUT_MS);
    if (!batchBWait.done) log(`  WARN: ${batchBWait.pending.length} shadow pipelines still pending: ${batchBWait.pending.join(', ')}`);
    else log('  Batch B shadow pipelines all complete.');

  } catch (err) {
    console.error('[BATCH] FAIL:', err.message);
    exit = 1;
  } finally {
    shadowTracker?.close();
    log('Shutting down services...');
    mainSvc.child.kill('SIGTERM');
    shadowSvc.child.kill('SIGTERM');
    await sleep(500);
  }

  // ── Summary ────────────────────────────────────────────
  const verifierHits = tallyVerifierHits(mainSvc.getLog());
  const totalMs = Date.now() - overallStart;
  const councilOk = councilResults.filter(r => r.ok).length;
  const shadowOk = shadowResults.filter(r => r.submitted && shadowTracker?.completed.has(r.shadowQNum)).length;
  const shadowSubmitted = shadowResults.filter(r => r.submitted).length;

  console.log('\n========== BATCH SMOKE SUMMARY ==========');
  console.log(`Total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`Council batch: ${councilOk}/${councilResults.length} OK`);
  for (const r of councilResults) {
    const tag = r.ok ? 'OK' : r.error ? 'ERR' : 'FAIL';
    console.log(`  [A${r.qIdx + 1}] ${tag} — ${r.question?.slice(0, 60)}...${r.error ? ` (${r.error})` : ''}`);
  }
  console.log(`Shadow batch: ${shadowOk}/${shadowResults.length} pipelines complete (${shadowSubmitted} submitted)`);
  for (const r of shadowResults) {
    const done = shadowTracker?.completed.has(r.shadowQNum);
    const tag = r.error ? 'ERR' : done ? 'DONE' : r.submitted ? 'PENDING' : 'NOT_SENT';
    console.log(`  [B${r.qIdx + 1}] Q#${r.shadowQNum} ${tag} — ${r.question?.slice(0, 60)}...`);
  }
  console.log(`\nVerifier distribution (council verification swarm): ${JSON.stringify(verifierHits)}`);

  const gates = [
    ['All council 3-round flows complete', councilOk === councilResults.length],
    ['All shadow pipelines complete', shadowOk === shadowResults.length && shadowResults.length > 0],
    ['Verifier distribution ≥ 2 providers', Object.keys(verifierHits).length >= 2],
  ];
  console.log('\nGates:');
  let pass = true;
  for (const [n, ok] of gates) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) pass = false; }
  console.log('=========================================\n');
  process.exit(pass ? exit : 1);
}

main().catch((err) => { console.error('[BATCH] fatal:', err); process.exit(1); });
