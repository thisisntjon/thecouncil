// End-to-end backend smoke test for The Council.
// Spawns server + shadow-council, runs the three-round flow, reports distribution.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MAIN_PORT = 3011;
const SHADOW_PORT = 3022;
const MAIN_URL = `http://localhost:${MAIN_PORT}`;
const SHADOW_URL = `http://localhost:${SHADOW_PORT}`;

const QUESTION = 'Who was the first US president, when was he inaugurated, and what was the population of the United States at that time?';

const results = {
  health: null,
  ask: { answers: [], errors: [] },
  evaluate: { evaluations: [], errors: [] },
  verify: {
    claims: [],
    crossReference: null,
    verificationProgress: 0,
    verifications: [],
    disagreements: [],
    confidenceScores: null,
    synthesis: null,
    errors: [],
    complete: false,
  },
  verifierHits: {},
};

function log(...args) {
  console.log('[SMOKE]', ...args);
}

function spawnService(name, cwd, port, extraEnv = {}) {
  const portEnv = name === 'shadow' ? { SHADOW_PORT: String(port) } : { PORT: String(port) };
  const env = { ...process.env, ...portEnv, ...extraEnv };
  const child = spawn(process.execPath, ['index.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdoutBuf = [];
  const stderrBuf = [];
  child.stdout.on('data', (d) => {
    const s = d.toString();
    stdoutBuf.push(s);
    process.stdout.write(`[${name}] ${s}`);
  });
  child.stderr.on('data', (d) => {
    const s = d.toString();
    stderrBuf.push(s);
    process.stderr.write(`[${name}:err] ${s}`);
  });
  return { child, getStdout: () => stdoutBuf.join(''), getStderr: () => stderrBuf.join('') };
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
        const payload = line.slice(6);
        try {
          onEvent(JSON.parse(payload));
        } catch (e) {
          // Ignore parse errors on heartbeats etc.
        }
      }
    }
  }
}

async function runAsk() {
  log('POST /api/ask ...');
  const res = await fetch(`${MAIN_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: QUESTION, models: ['claude', 'gpt', 'gemini', 'grok'] }),
  });
  if (!res.ok) throw new Error(`/api/ask returned ${res.status}`);
  await readSSE(res, (event) => {
    if (event.type === 'answer') {
      const { result } = event;
      if (result.status === 'success' && result.answer) {
        results.ask.answers.push(result);
        log(`  answer from ${result.name} (${result.latency}ms, ${result.answer.length} chars)`);
      } else {
        results.ask.errors.push(result);
        log(`  ERROR ${result.name}: ${result.error || 'no answer'}`);
      }
    }
  });
}

async function runEvaluate() {
  log('POST /api/evaluate ...');
  const answers = results.ask.answers.map(a => ({
    id: a.id, name: a.name, provider: a.provider, answer: a.answer,
  }));
  const res = await fetch(`${MAIN_URL}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: QUESTION, answers }),
  });
  if (!res.ok) throw new Error(`/api/evaluate returned ${res.status}`);
  await readSSE(res, (event) => {
    if (event.type === 'evaluation') {
      if (event.evaluation && event.evaluation.ratings) {
        results.evaluate.evaluations.push(event);
        log(`  evaluation by ${event.evaluatorName} (${event.evaluation.ratings.length} ratings, ${event.latency}ms)`);
      } else {
        results.evaluate.errors.push(event);
        log(`  eval ERROR for ${event.evaluatorName}: status=${event.status}`);
      }
    }
  });
}

async function runVerify() {
  log('POST /api/verify ...');
  const answers = results.ask.answers.map(a => ({
    id: a.id, name: a.name, provider: a.provider, answer: a.answer,
  }));
  const res = await fetch(`${MAIN_URL}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: QUESTION, answers }),
  });
  if (!res.ok) throw new Error(`/api/verify returned ${res.status}`);
  await readSSE(res, (event) => {
    switch (event.type) {
      case 'claims':
        results.verify.claims.push({ modelId: event.modelId, count: event.claims?.length || 0 });
        log(`  claims from ${event.modelId}: ${event.claims?.length || 0}`);
        break;
      case 'cross_reference':
        results.verify.crossReference = event.matrix;
        log(`  cross_reference: agreed=${event.matrix?.agreed?.length || 0} disagreed=${event.matrix?.disagreed?.length || 0} unique=${event.matrix?.unique?.length || 0}`);
        break;
      case 'verification_progress':
        results.verify.verificationProgress++;
        break;
      case 'verification':
        results.verify.verifications.push({ claimId: event.claimId, verdict: event.result?.verdict, confidence: event.result?.confidence });
        break;
      case 'disagreement_resolution':
        results.verify.disagreements.push(event);
        log(`  disagreement resolved: ${event.topic}`);
        break;
      case 'confidence_scores':
        results.verify.confidenceScores = event.scores;
        log(`  confidence_scores: ${JSON.stringify(event.scores)}`);
        break;
      case 'synthesis':
        results.verify.synthesis = { answerLength: event.answer?.length || 0, citations: event.citations?.length || 0 };
        log(`  synthesis: ${event.answer?.length || 0} chars, ${event.citations?.length || 0} citations`);
        break;
      case 'error':
        results.verify.errors.push(event);
        log(`  verify ERROR: ${event.message}`);
        break;
      case 'complete':
        results.verify.complete = true;
        log('  complete');
        break;
    }
  });
}

function tallyVerifierHits(stdout) {
  const re = /→ verifier:\s*(\w+)/g;
  const hits = {};
  let m;
  while ((m = re.exec(stdout)) !== null) {
    hits[m[1]] = (hits[m[1]] || 0) + 1;
  }
  return hits;
}

async function main() {
  const mainSvc = spawnService('council', join(ROOT, 'server'), MAIN_PORT, { SHADOW_COUNCIL_URL: SHADOW_URL });
  const shadowSvc = spawnService('shadow', join(ROOT, 'shadow-council'), SHADOW_PORT);

  let exitCode = 0;
  try {
    results.health = await waitForHealth(MAIN_URL);
    log('Health:', JSON.stringify(results.health.keysConfigured));

    await waitForHealth(SHADOW_URL).catch(() => log('Shadow health skipped'));

    await runAsk();
    if (results.ask.answers.length === 0) throw new Error('No answers from /api/ask — aborting');

    await runEvaluate();
    await runVerify();

    results.verifierHits = tallyVerifierHits(mainSvc.getStdout());
  } catch (err) {
    console.error('[SMOKE] FAIL:', err.message);
    exitCode = 1;
  } finally {
    log('Shutting down services...');
    mainSvc.child.kill('SIGTERM');
    shadowSvc.child.kill('SIGTERM');
    await sleep(500);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n========== SMOKE TEST SUMMARY ==========');
  console.log('Health keys:', results.health?.keysConfigured);
  console.log(`Ask: ${results.ask.answers.length} answers, ${results.ask.errors.length} errors`);
  console.log(`Evaluate: ${results.evaluate.evaluations.length} evaluations, ${results.evaluate.errors.length} errors`);
  console.log(`Verify: ${results.verify.claims.length} claim-batches, ` +
    `cross_ref=${results.verify.crossReference ? 'yes' : 'no'}, ` +
    `verifications=${results.verify.verifications.length}, ` +
    `disagreements=${results.verify.disagreements.length}, ` +
    `synthesis=${results.verify.synthesis ? 'yes' : 'no'}, ` +
    `complete=${results.verify.complete}`);
  console.log('Verifier distribution:', results.verifierHits);

  // Pass/fail gates
  const gates = [
    ['health all 4 keys', ['claude', 'gpt', 'gemini', 'grok'].every(k => results.health?.keysConfigured?.[k])],
    ['/api/ask ≥ 3 answers', results.ask.answers.length >= 3],
    ['/api/evaluate ≥ 3 evaluations', results.evaluate.evaluations.length >= 3],
    ['/api/verify complete', results.verify.complete],
    ['/api/verify has synthesis', !!results.verify.synthesis],
    ['distribution ≥ 2 providers', Object.keys(results.verifierHits).length >= 2],
  ];
  console.log('\nGates:');
  let allPassed = true;
  for (const [name, passed] of gates) {
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}`);
    if (!passed) allPassed = false;
  }
  console.log('========================================\n');

  process.exit(allPassed ? exitCode : 1);
}

main().catch((err) => {
  console.error('[SMOKE] fatal:', err);
  process.exit(1);
});
