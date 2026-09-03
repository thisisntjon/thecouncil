#!/usr/bin/env node
// eval/run_eval.mjs — Council evaluation harness.
//
// Runs a JSONL suite of questions through the same three Council rounds the live app
// uses — Round 1 independent answers (/api/ask), Round 2 peer evaluation (/api/evaluate),
// Round 3 cross-vendor verification + synthesis (/api/verify) — driving a running
// server/ exactly the way scripts/live_feedback_loop.mjs does (HTTP + SSE, skipShadow).
// `--mode fixture` runs the same suite through lib/fixtureCouncil.mjs offline (no keys,
// no network) so CI can exercise the harness; fixture evidence is simulated and every
// fixture-mode output is labeled `simulated: true`.
//
// Correctness is only scored where a row carries `expected` (regex / must_include /
// must_not_include). Rows without `expected` are reported as "unscored", never as pass.
// Costs are computed only from the server's own usage ledger (trackUsage via
// GET /api/usage) and the server's own price table (MODEL_OPTIONS via GET /api/health);
// anything the server does not price is reported as "n/a", never estimated here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, runFixtureCouncil } from "../lib/fixtureCouncil.mjs";
import {
  EXIT, makeRunId, withTimeout, retry, retryAfterMs, isTransient,
  createLogger, resolveLevel, onCancel, isCancelling, writeTextAtomic
} from "../lib/ops.mjs";

const MODEL_ORDER = ["claude", "gpt", "gemini", "grok"];
// Same threshold (and env override) the live feedback loop uses to flag weak verification.
const MIN_AVG_CONFIDENCE = Number(process.env.COUNCIL_MIN_AVG_CONFIDENCE || "60");
// trackUsage() records the vendor name; MODEL_OPTIONS (the price table) is keyed by model id.
const PROVIDER_TO_MODEL_ID = { anthropic: "claude", openai: "gpt", google: "gemini", xai: "grok" };

const HELP = `Council evaluation harness

Usage: node eval/run_eval.mjs --suite eval/suites/<name>.jsonl [options]

Options:
  --suite PATH           JSONL suite (required)
  --mode live|fixture    live = drive a running server/ (needs keys); fixture = offline replay (default live)
  --out DIR              Output directory (default eval/runs/<timestamp>/)
  --limit N              Run only the first N rows
  --dry-run              Validate the suite and print the plan; no API calls, no files written
  --api-base URL         Council API base (default $COUNCIL_API_BASE or http://127.0.0.1:3001)
  --api-token TOKEN      Local bearer token (default $COUNCIL_API_TOKEN or $LOCAL_API_TOKEN)
  --timeout SECONDS      Per-request timeout (default 180)
  --retries N            Retries on transient connection failures (default 2)
  -v, --verbose          More log detail
  -q, --quiet            Errors only
  -h, --help             Show this help

Suite row: {"id","question","category","expected"?: {"answer_regex"?, "must_include"?: [], "must_not_include"?: []},"notes"?}

Exit codes: 0 completed · 2 usage · 3 config (server unreachable / suite invalid)
`;

// ── CLI ─────────────────────────────────────────────────────

function usage(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.USAGE });
}

function configError(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.CONFIG });
}

function parseArgs(argv) {
  const opts = {
    suite: null,
    mode: "live",
    out: null,
    limit: null,
    dryRun: false,
    apiBase: process.env.COUNCIL_API_BASE || "http://127.0.0.1:3001",
    apiToken: process.env.COUNCIL_API_TOKEN || process.env.LOCAL_API_TOKEN || "",
    timeoutMs: 180000,
    retries: 2,
    verbose: false,
    quiet: false,
    help: false
  };
  const need = (i, flag) => {
    if (i + 1 >= argv.length) throw usage(`${flag} requires a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h": case "--help": opts.help = true; break;
      case "--dry-run": opts.dryRun = true; break;
      case "-v": case "--verbose": opts.verbose = true; break;
      case "-q": case "--quiet": opts.quiet = true; break;
      case "--suite": opts.suite = need(i, arg); i += 1; break;
      case "--mode": opts.mode = need(i, arg); i += 1; break;
      case "--out": opts.out = need(i, arg); i += 1; break;
      case "--limit": opts.limit = Number(need(i, arg)); i += 1; break;
      case "--api-base": opts.apiBase = need(i, arg); i += 1; break;
      case "--api-token": opts.apiToken = need(i, arg); i += 1; break;
      case "--timeout": opts.timeoutMs = Number(need(i, arg)) * 1000; i += 1; break;
      case "--retries": opts.retries = Number(need(i, arg)); i += 1; break;
      default: throw usage(`unknown option: ${arg}`);
    }
  }
  if (opts.help) return opts;
  if (!opts.suite) throw usage("--suite is required");
  if (!["live", "fixture"].includes(opts.mode)) throw usage("--mode must be live or fixture");
  if (opts.limit != null && (!Number.isInteger(opts.limit) || opts.limit < 1)) throw usage("--limit must be a positive integer");
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) throw usage("--timeout must be a positive number of seconds");
  if (!Number.isInteger(opts.retries) || opts.retries < 0) throw usage("--retries must be a non-negative integer");
  return opts;
}

// ── Suite loading + validation ──────────────────────────────

const EXPECTED_KEYS = new Set(["answer_regex", "must_include", "must_not_include"]);

export function loadSuite(suitePath) {
  const absolute = path.resolve(suitePath);
  if (!fs.existsSync(absolute)) throw configError(`Suite not found: ${absolute}`);
  const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/);
  const rows = [];
  const ids = new Set();
  const errors = [];
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (!line.trim()) return;
    let row;
    try {
      row = JSON.parse(line);
    } catch (err) {
      errors.push(`line ${lineNo}: invalid JSON (${err.message})`);
      return;
    }
    if (!row || typeof row !== "object" || Array.isArray(row)) { errors.push(`line ${lineNo}: row must be an object`); return; }
    if (typeof row.id !== "string" || !row.id.trim()) errors.push(`line ${lineNo}: id must be a non-empty string`);
    else if (ids.has(row.id)) errors.push(`line ${lineNo}: duplicate id "${row.id}"`);
    else ids.add(row.id);
    if (typeof row.question !== "string" || !row.question.trim()) errors.push(`line ${lineNo}: question must be a non-empty string`);
    if (typeof row.category !== "string" || !row.category.trim()) errors.push(`line ${lineNo}: category must be a non-empty string`);
    if (row.notes != null && typeof row.notes !== "string") errors.push(`line ${lineNo}: notes must be a string`);
    if (row.expected != null) {
      const expected = row.expected;
      if (typeof expected !== "object" || Array.isArray(expected)) {
        errors.push(`line ${lineNo}: expected must be an object`);
      } else {
        for (const key of Object.keys(expected)) {
          if (!EXPECTED_KEYS.has(key)) errors.push(`line ${lineNo}: unknown expected key "${key}"`);
        }
        if (expected.answer_regex != null) {
          if (typeof expected.answer_regex !== "string") errors.push(`line ${lineNo}: expected.answer_regex must be a string`);
          else {
            try { new RegExp(expected.answer_regex, "i"); } catch (err) { errors.push(`line ${lineNo}: expected.answer_regex does not compile (${err.message})`); }
          }
        }
        for (const key of ["must_include", "must_not_include"]) {
          if (expected[key] != null && (!Array.isArray(expected[key]) || !expected[key].every((s) => typeof s === "string" && s.length))) {
            errors.push(`line ${lineNo}: expected.${key} must be an array of non-empty strings`);
          }
        }
        if (Object.keys(expected).length === 0) errors.push(`line ${lineNo}: expected is empty — omit it to mark the row unscored`);
      }
    }
    rows.push(row);
  });
  if (errors.length) throw configError(`Suite ${suitePath} is invalid:\n  - ${errors.join("\n  - ")}`);
  if (rows.length === 0) throw configError(`Suite ${suitePath} has no rows`);
  return rows;
}

// ── Scoring ─────────────────────────────────────────────────
// Returns {status: "pass"|"fail"|"unscored"|"n/a", checks: [...]}.
// "unscored": the row has no `expected`.  "n/a": there is no answer text to score.

export function scoreText(text, expected) {
  if (!expected) return { status: "unscored", checks: [] };
  if (typeof text !== "string" || !text.trim()) return { status: "n/a", checks: [{ check: "answer_present", passed: false }] };
  const checks = [];
  if (expected.answer_regex) {
    const passed = new RegExp(expected.answer_regex, "i").test(text);
    checks.push({ check: "answer_regex", pattern: expected.answer_regex, passed });
  }
  const lower = text.toLowerCase();
  for (const needle of expected.must_include || []) {
    checks.push({ check: "must_include", needle, passed: lower.includes(needle.toLowerCase()) });
  }
  for (const needle of expected.must_not_include || []) {
    checks.push({ check: "must_not_include", needle, passed: !lower.includes(needle.toLowerCase()) });
  }
  return { status: checks.every((c) => c.passed) ? "pass" : "fail", checks };
}

// Verification score on the live server's scale: (supported + 0.5·partial) / verifiable × 100
// (server/index.js computeConfidenceScores). Fixture mode has no per-model claim ownership,
// so it applies the same formula over all claims.
function verdictScore(counts) {
  const total = counts.supported + counts.partially_supported + counts.refuted + counts.unverifiable;
  return total > 0 ? Math.round(((counts.supported + counts.partially_supported * 0.5) / total) * 1000) / 10 : null;
}

function emptyVerdictCounts() {
  return { supported: 0, partially_supported: 0, refuted: 0, unverifiable: 0 };
}

// ── Live-mode HTTP/SSE client (same approach as scripts/live_feedback_loop.mjs) ──

function authHeaders(ctx, headers = {}) {
  return ctx.apiToken ? { ...headers, authorization: `Bearer ${ctx.apiToken}` } : headers;
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try { event = JSON.parse(line.slice(6)); } catch { event = { type: "parse_error", raw: line }; }
      events.push(event);
      onEvent?.(event);
    }
  }
  return events;
}

async function httpError(response) {
  const err = new Error(`HTTP ${response.status}`);
  err.status = response.status;
  err.headers = response.headers;
  err.retryAfterMs = retryAfterMs({ headers: response.headers });
  try { err.body = await response.text(); } catch { /* unreadable body */ }
  return err;
}

// Retries only the CONNECTION; once the server streams, the request is never re-issued
// because /api/ask, /api/evaluate and /api/verify trigger non-idempotent provider work.
async function postSse(ctx, pathname, payload, onEvent) {
  const connect = () => withTimeout(
    fetch(`${ctx.apiBase}${pathname}`, {
      method: "POST",
      headers: authHeaders(ctx, { "content-type": "application/json" }),
      body: JSON.stringify(payload)
    }),
    ctx.timeoutMs,
    `POST ${pathname}`
  );
  const response = await retry(connect, {
    retries: ctx.retries,
    retryOn: isTransient,
    onRetry: ({ attempt, retries, delay }) => ctx.log.warn(`POST ${pathname} retry ${attempt}/${retries} in ${delay}ms`)
  });
  if (!response.ok) throw await httpError(response);
  const events = await readSse(response, onEvent);
  return { response, events };
}

async function getJson(ctx, pathname) {
  const fetchOnce = async () => {
    const response = await withTimeout(fetch(`${ctx.apiBase}${pathname}`, { headers: authHeaders(ctx) }), ctx.timeoutMs, `GET ${pathname}`);
    if (!response.ok) throw await httpError(response);
    return response.json();
  };
  return retry(fetchOnce, {
    retries: ctx.retries,
    onRetry: ({ attempt, retries, delay }) => ctx.log.warn(`GET ${pathname} retry ${attempt}/${retries} in ${delay}ms`)
  });
}

function configuredModels(health) {
  const keys = health.keysConfigured || {};
  return MODEL_ORDER.filter((id) => keys[id]);
}

// Snapshot of the server's trackUsage ledger; null when the endpoint is not exposed.
async function usageSnapshot(ctx) {
  try {
    const usage = await getJson(ctx, "/api/usage");
    return Array.isArray(usage?.calls) ? usage.calls : null;
  } catch (err) {
    ctx.log.warn(`GET /api/usage unavailable (${err.message}); token usage and cost will be n/a`);
    return null;
  }
}

// Per-vendor token totals + USD cost for a slice of trackUsage calls. Prices come ONLY from
// the server's own MODEL_OPTIONS table (health.modelOptions). A vendor whose calls include a
// model the server does not price gets cost "n/a" with the unpriced models listed.
function summarizeUsage(calls, modelOptions) {
  if (!calls) return { available: false, reason: "GET /api/usage not exposed", byVendor: {}, totalUsd: "n/a" };
  const byVendor = {};
  let totalUsd = 0;
  let allPriced = true;
  for (const call of calls) {
    const vendor = call.provider || "unknown";
    const entry = byVendor[vendor] ||= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, unpricedModels: [] };
    entry.calls += 1;
    entry.inputTokens += Number(call.input) || 0;
    entry.outputTokens += Number(call.output) || 0;
    const priceRow = (modelOptions?.[PROVIDER_TO_MODEL_ID[vendor]] || []).find((o) => o.model === call.model);
    if (priceRow && Number.isFinite(priceRow.input) && Number.isFinite(priceRow.output)) {
      entry.usd += ((Number(call.input) || 0) / 1e6) * priceRow.input + ((Number(call.output) || 0) / 1e6) * priceRow.output;
    } else {
      if (!entry.unpricedModels.includes(call.model)) entry.unpricedModels.push(call.model);
    }
  }
  for (const entry of Object.values(byVendor)) {
    if (entry.unpricedModels.length) { entry.usd = "n/a"; allPriced = false; } else { entry.usd = Number(entry.usd.toFixed(6)); totalUsd += entry.usd; }
  }
  return {
    available: true,
    priceSource: "server MODEL_OPTIONS via GET /api/health (USD per 1M tokens)",
    byVendor,
    totalUsd: allPriced ? Number(totalUsd.toFixed(6)) : "n/a",
    ...(allPriced ? {} : { note: "one or more models had no server price entry; see byVendor[*].unpricedModels" })
  };
}

// Reasoning-vs-search classification of a live verification result (server/index.js verifyClaim).
function verificationMethod(result) {
  if (result?.reasoning_mode) return "reasoning_re_derivation";
  const first = result?.sources?.[0];
  if (first?.title === "LLM Knowledge Assessment") return "knowledge_fallback";
  if (Array.isArray(result?.sources) && result.sources.length > 0) return "web_search";
  return "none";
}

async function runRowLive(ctx, row) {
  const { models, modelOptions } = ctx;
  const usageBefore = await usageSnapshot(ctx);
  const rounds = {};
  const startedAt = Date.now();

  // Round 1 — four independent answers (skipShadow: the harness runs Round 3 itself, as the feedback loop does).
  let t0 = Date.now();
  const ask = await postSse(ctx, "/api/ask", { question: row.question, models, skipShadow: true }, (event) => {
    if (event.type === "answer") ctx.log.verbose(`[${row.id}] answer ${event.result?.id}: ${event.result?.status}`);
  });
  rounds.round1_ms = Date.now() - t0;
  const answers = ask.events.filter((e) => e.type === "answer").map((e) => e.result);
  const successful = answers.filter((a) => a.status === "success");
  const roundOne = MODEL_ORDER.filter((id) => models.includes(id)).map((id) => {
    const answer = answers.find((a) => a.id === id);
    return {
      model: id,
      name: answer?.name || null,
      provider: answer?.provider || null,
      status: answer?.status || "missing",
      latencyMs: answer?.latency ?? null,
      usage: answer?.usage || null,
      error: answer?.error || null,
      answer: answer?.answer ?? null,
      correctness: scoreText(answer?.answer, row.expected)
    };
  });

  // Round 2 — peer evaluation (needs at least two answers to cross-rate).
  let evaluations = { skipped: true, reason: "fewer than two successful answers", items: [] };
  if (successful.length >= 2) {
    t0 = Date.now();
    const evaluation = await postSse(ctx, "/api/evaluate", {
      question: row.question,
      answers: successful.map((a) => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer }))
    });
    rounds.round2_ms = Date.now() - t0;
    evaluations = {
      skipped: false,
      items: evaluation.events.filter((e) => e.type === "evaluation").map((e) => ({
        evaluator: e.evaluator,
        status: e.status,
        latencyMs: e.latency,
        parseError: Boolean(e.evaluation?.parseError),
        ratings: e.evaluation?.ratings || [],
        wouldChange: e.evaluation?.would_change ?? null
      }))
    };
  } else {
    rounds.round2_ms = null;
  }

  // Round 3 — claim extraction, cross-vendor verification, synthesis.
  t0 = Date.now();
  const verification = await postSse(ctx, "/api/verify", {
    question: row.question,
    answers: successful.map((a) => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer }))
  }, (event) => {
    if (event.type === "error") ctx.log.warn(`[${row.id}] verification error: ${event.message}`);
  });
  rounds.round3_ms = Date.now() - t0;

  const claimEvents = verification.events.filter((e) => e.type === "claims");
  const claimsById = {};
  for (const e of claimEvents) for (const c of e.claims || []) claimsById[c.id] = { ...c, modelId: e.modelId };
  const verdictCounts = emptyVerdictCounts();
  const methodCounts = { reasoning_re_derivation: 0, web_search: 0, knowledge_fallback: 0, none: 0 };
  const claims = [];
  for (const e of verification.events.filter((e) => e.type === "verification")) {
    const verdict = e.result?.verdict;
    const bucket = verdict in verdictCounts ? verdict : "unverifiable";
    verdictCounts[bucket] += 1;
    const method = verificationMethod(e.result);
    methodCounts[method] += 1;
    const claim = claimsById[e.claimId] || {};
    claims.push({ id: e.claimId, modelId: claim.modelId || null, text: claim.text || null, category: claim.category || null, verdict, confidence: e.result?.confidence ?? null, method, reasoning: e.result?.reasoning || null });
  }
  const scores = verification.events.find((e) => e.type === "confidence_scores")?.scores || null;
  const scoreValues = Object.values(scores || {}).map((s) => Number(s.score)).filter(Number.isFinite);
  const verificationScore = scoreValues.length ? Number((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)) : null;
  const synthesis = verification.events.find((e) => e.type === "synthesis") || null;
  const errors = verification.events.filter((e) => e.type === "error").map((e) => e.message);

  const usageAfter = await usageSnapshot(ctx);
  const rowCalls = usageBefore && usageAfter ? usageAfter.slice(usageBefore.length) : null;

  return {
    id: row.id,
    category: row.category,
    question: row.question,
    expected: row.expected || null,
    notes: row.notes || null,
    mode: "live",
    simulated: false,
    status: "completed",
    models,
    round1: roundOne,
    round2: evaluations,
    round3: {
      claimsExtracted: Object.keys(claimsById).length,
      verdictCounts,
      verificationMethodCounts: methodCounts,
      perModelScores: scores,
      verificationScore,
      verificationLow: verificationScore != null && verificationScore < MIN_AVG_CONFIDENCE,
      claims,
      errors,
      synthesisAnswer: synthesis?.answer ?? null,
      citations: synthesis?.citations || []
    },
    council: { answer: synthesis?.answer ?? null, correctness: scoreText(synthesis?.answer, row.expected) },
    usage: summarizeUsage(rowCalls, modelOptions),
    latency: { ...rounds, total_ms: Date.now() - startedAt }
  };
}

// ── Fixture mode (lib/fixtureCouncil.mjs) ───────────────────

function runRowFixture(ctx, row) {
  const startedAt = Date.now();
  let report;
  try {
    report = runFixtureCouncil({ question: row.question });
  } catch (err) {
    ctx.log.warn(`[${row.id}] ${err.message}`);
    return {
      id: row.id, category: row.category, question: row.question, expected: row.expected || null, notes: row.notes || null,
      mode: "fixture", simulated: true, status: "skipped_no_fixture", reason: err.message,
      round1: [], round2: { skipped: true, reason: "no fixture", items: [] }, round3: null,
      council: { answer: null, correctness: { status: "n/a", checks: [] } },
      usage: { available: false, reason: "fixture mode makes no provider calls", byVendor: {}, totalUsd: "n/a" },
      latency: { round1_ms: null, round2_ms: null, round3_ms: null, total_ms: Date.now() - startedAt }
    };
  }
  const elapsed = Date.now() - startedAt;
  const verdictCounts = emptyVerdictCounts();
  const methodCounts = { reasoning_re_derivation: 0, fixture_evidence: 0 };
  for (const claim of report.verifiedClaims) {
    const bucket = claim.verdict in verdictCounts ? claim.verdict : "unverifiable"; // fixture "unresolved" -> unverifiable
    verdictCounts[bucket] += 1;
    methodCounts[claim.verificationMethod === "independent_re_derivation" ? "reasoning_re_derivation" : "fixture_evidence"] += 1;
  }
  const verificationScore = verdictScore(verdictCounts);
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    expected: row.expected || null,
    notes: row.notes || null,
    mode: "fixture",
    simulated: true,
    fixture: report.fixture,
    status: "completed",
    models: report.agents.map((a) => a.id),
    round1: report.agents.map((agent) => ({
      model: agent.id, name: agent.name, provider: "fixture", status: "success", latencyMs: null, usage: null, error: null,
      answer: agent.answer, correctness: scoreText(agent.answer, row.expected)
    })),
    round2: { skipped: false, items: report.peerReviews.map((r) => ({ evaluator: r.reviewer, target: r.target, score: r.score, wouldChange: r.wouldRevise })) },
    round3: {
      claimsExtracted: report.verifiedClaims.length,
      verdictCounts,
      verificationMethodCounts: methodCounts,
      perModelScores: null,
      verificationScore,
      verificationLow: verificationScore != null && verificationScore < MIN_AVG_CONFIDENCE,
      claims: report.verifiedClaims.map((c) => ({ id: c.id, modelId: c.roleId || null, text: c.text, category: c.category || c.claimType || null, verdict: c.verdict, confidence: c.confidence, method: c.verificationMethod, reasoning: c.reasoning })),
      errors: [],
      synthesisAnswer: report.final.finalAnswer,
      fixtureConfidenceSummary: report.final.confidenceSummary
    },
    council: { answer: report.final.finalAnswer, correctness: scoreText(report.final.finalAnswer, row.expected) },
    usage: { available: false, reason: "fixture mode makes no provider calls", byVendor: {}, totalUsd: "n/a" },
    latency: { round1_ms: elapsed, round2_ms: 0, round3_ms: 0, total_ms: elapsed, note: "fixture replay runs all rounds in one synchronous call; round1_ms holds the whole replay" }
  };
}

// ── Reporting ───────────────────────────────────────────────

function fmtUsd(value) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "n/a";
}

function fmtSeconds(ms) {
  return typeof ms === "number" ? (ms / 1000).toFixed(1) : "n/a";
}

function rowFailureReasons(row) {
  const reasons = [];
  if (row.status !== "completed") reasons.push(`row not completed: ${row.status}${row.reason ? ` — ${row.reason}` : ""}`);
  if (row.council?.correctness?.status === "fail") reasons.push("council answer failed the expected check");
  if (row.council?.correctness?.status === "n/a" && row.expected) reasons.push("council produced no synthesis answer to score");
  if (row.round3?.verificationLow) reasons.push(`verification score ${row.round3.verificationScore} is below ${MIN_AVG_CONFIDENCE}`);
  if (row.round3?.errors?.length) reasons.push(`verification errors: ${row.round3.errors.join("; ")}`);
  for (const r of row.round1 || []) if (r.status !== "success") reasons.push(`${r.model} round-1 answer ${r.status}${r.error ? `: ${r.error}` : ""}`);
  return reasons;
}

function buildSummary(meta, rows) {
  const scored = rows.filter((r) => r.expected && r.status === "completed");
  const tally = (status) => rows.filter((r) => r.council.correctness.status === status).length;
  const baseline = {};
  for (const r of rows) for (const a of r.round1 || []) {
    const b = baseline[a.model] ||= { pass: 0, fail: 0, unscored: 0, "n/a": 0 };
    b[a.correctness.status] += 1;
  }
  const costs = rows.map((r) => r.usage?.totalUsd).filter((v) => typeof v === "number");
  return {
    ...meta,
    rows: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    skipped: rows.filter((r) => r.status !== "completed").length,
    scoredRows: scored.length,
    council: { pass: tally("pass"), fail: tally("fail"), unscored: tally("unscored"), "n/a": tally("n/a") },
    baseline,
    verificationLowRows: rows.filter((r) => r.round3?.verificationLow).map((r) => r.id),
    totalUsd: costs.length === rows.filter((r) => r.status === "completed").length && costs.length > 0 ? Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) : "n/a",
    totalLatencyMs: rows.reduce((a, r) => a + (r.latency?.total_ms || 0), 0),
    failures: rows.map((r) => ({ id: r.id, reasons: rowFailureReasons(r) })).filter((f) => f.reasons.length),
    results: rows.map((r) => ({
      id: r.id, category: r.category, status: r.status,
      baseline: Object.fromEntries((r.round1 || []).map((a) => [a.model, a.correctness.status])),
      council: r.council.correctness.status,
      verificationScore: r.round3?.verificationScore ?? null,
      verdictCounts: r.round3?.verdictCounts ?? null,
      verificationMethodCounts: r.round3?.verificationMethodCounts ?? null,
      usd: r.usage?.totalUsd ?? "n/a",
      latency: r.latency
    }))
  };
}

function renderMarkdown(summary, rows) {
  const lines = [];
  lines.push("# Council eval summary");
  lines.push("");
  lines.push(`Run: ${summary.runId} · mode: **${summary.mode}**${summary.simulated ? " (simulated fixture evidence — not live model quality)" : ""} · suite: \`${summary.suite}\` · generated ${summary.generatedAt}`);
  if (summary.mode === "live") lines.push(`API: ${summary.apiBase} · models: ${summary.models.join(", ")} · web search: ${summary.braveSearchConfigured ? "on" : "off (knowledge fallback)"}`);
  if (summary.partial) lines.push("**Partial run — cancelled before completion.**");
  lines.push("");
  lines.push(`Rows: ${summary.rows} · completed: ${summary.completed} · skipped: ${summary.skipped} · rows with \`expected\`: ${summary.scoredRows} · council pass/fail/unscored: ${summary.council.pass}/${summary.council.fail}/${summary.council.unscored} · total cost: ${fmtUsd(summary.totalUsd)} · total wall-clock: ${fmtSeconds(summary.totalLatencyMs)}s`);
  lines.push("");
  lines.push("Cells: `pass` / `fail` only where the row has `expected`; `unscored` = no expected answer shipped; `n/a` = no answer to score. Verification score = (supported + 0.5·partial) / verifiable claims × 100, averaged over models in live mode (server `computeConfidenceScores`). Low verification threshold: " + MIN_AVG_CONFIDENCE + ".");
  lines.push("");

  // Baseline columns: the four live model ids, or the fixture agent ids when they are uniform.
  const modelSets = rows.filter((r) => r.round1?.length).map((r) => r.round1.map((a) => a.model).join(","));
  const uniform = modelSets.length && modelSets.every((s) => s === modelSets[0]);
  const headerModels = uniform ? modelSets[0].split(",") : ["model 1", "model 2", "model 3", "model 4"];
  const baselineHeaders = headerModels.map((m) => `baseline ${m}`);
  lines.push(`| id | category | ${baselineHeaders.join(" | ")} | council pass | verification score | refuted claims | cost USD | latency s |`);
  lines.push(`|---|---|${baselineHeaders.map(() => "---").join("|")}|---|---|---|---|---|`);
  for (const r of rows) {
    const cells = headerModels.map((_, i) => {
      const a = r.round1?.[i];
      if (!a) return "n/a";
      return uniform ? a.correctness.status : `${a.model}: ${a.correctness.status}`;
    });
    const council = r.status === "completed" ? r.council.correctness.status : r.status;
    const vs = r.round3?.verificationScore ?? null;
    lines.push(`| ${r.id} | ${r.category} | ${cells.join(" | ")} | ${council} | ${vs == null ? "n/a" : vs}${r.round3?.verificationLow ? " (low)" : ""} | ${r.round3?.verdictCounts?.refuted ?? "n/a"} | ${fmtUsd(r.usage?.totalUsd)} | ${fmtSeconds(r.latency?.total_ms)} |`);
  }
  lines.push("");

  lines.push("## Verification detail");
  lines.push("");
  lines.push("| id | claims | supported | partial | refuted | unverifiable | reasoning re-derivation | search / evidence | knowledge fallback | R1 s | R2 s | R3 s |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const v = r.round3;
    if (!v) { lines.push(`| ${r.id} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`); continue; }
    const m = v.verificationMethodCounts || {};
    lines.push(`| ${r.id} | ${v.claimsExtracted} | ${v.verdictCounts.supported} | ${v.verdictCounts.partially_supported} | ${v.verdictCounts.refuted} | ${v.verdictCounts.unverifiable} | ${m.reasoning_re_derivation ?? 0} | ${(m.web_search ?? 0) + (m.fixture_evidence ?? 0)} | ${m.knowledge_fallback ?? 0} | ${fmtSeconds(r.latency?.round1_ms)} | ${fmtSeconds(r.latency?.round2_ms)} | ${fmtSeconds(r.latency?.round3_ms)} |`);
  }
  lines.push("");

  if (rows.some((r) => r.usage?.available)) {
    lines.push("## Token usage and cost per vendor (from server trackUsage; prices from server MODEL_OPTIONS)");
    lines.push("");
    lines.push("| id | vendor | calls | input tokens | output tokens | USD |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of rows) {
      for (const [vendor, u] of Object.entries(r.usage?.byVendor || {})) {
        lines.push(`| ${r.id} | ${vendor} | ${u.calls} | ${u.inputTokens} | ${u.outputTokens} | ${fmtUsd(u.usd)}${u.unpricedModels?.length ? ` (unpriced: ${u.unpricedModels.join(", ")})` : ""} |`);
      }
    }
    lines.push("");
  }

  lines.push("## Failures");
  lines.push("");
  if (!summary.failures.length) {
    lines.push("None flagged. (Unscored rows are not failures — they are simply not measured.)");
  } else {
    lines.push("Every row where the council answer was wrong, verification was low, a round errored, or the row could not run. Council answers are reproduced verbatim so the failure mode is visible.");
    for (const f of summary.failures) {
      const r = rows.find((x) => x.id === f.id);
      lines.push("");
      lines.push(`### ${f.id}`);
      lines.push("");
      for (const reason of f.reasons) lines.push(`- ${reason}`);
      if (r.expected) lines.push(`- expected: \`${JSON.stringify(r.expected)}\``);
      const failedChecks = (r.council?.correctness?.checks || []).filter((c) => !c.passed);
      if (failedChecks.length) lines.push(`- failed checks: ${failedChecks.map((c) => `${c.check}${c.pattern ? ` /${c.pattern}/` : ""}${c.needle ? ` "${c.needle}"` : ""}`).join("; ")}`);
      const refuted = (r.round3?.claims || []).filter((c) => c.verdict === "refuted");
      if (refuted.length) {
        lines.push("- refuted claims:");
        for (const c of refuted) lines.push(`  - [${c.id}] ${c.text} — ${c.reasoning || "(no reasoning)"} (confidence ${c.confidence})`);
      }
      if (r.council?.answer) {
        lines.push("");
        lines.push("Council answer (verbatim):");
        lines.push("");
        lines.push("```text");
        lines.push(r.council.answer);
        lines.push("```");
      }
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function writeOutputs(outDir, summary, rows) {
  fs.mkdirSync(path.join(outDir, "rows"), { recursive: true });
  for (const r of rows) writeTextAtomic(path.join(outDir, "rows", `${r.id}.json`), `${JSON.stringify(r, null, 2)}\n`);
  writeTextAtomic(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeTextAtomic(path.join(outDir, "summary.md"), renderMarkdown(summary, rows));
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return; }
  const log = createLogger({ level: resolveLevel({ quiet: opts.quiet, verbose: opts.verbose }), name: "eval" });

  const rows = loadSuite(opts.suite).slice(0, opts.limit ?? undefined);
  const runId = makeRunId();
  const outDir = path.resolve(opts.out || path.join(ROOT, "eval", "runs", runId));

  if (opts.dryRun) {
    log.info(`[DRY-RUN] suite ${opts.suite} is valid: ${rows.length} row(s) selected`);
    log.info(`[DRY-RUN] mode: ${opts.mode}${opts.mode === "live" ? ` · API ${opts.apiBase} · rounds: /api/ask -> /api/evaluate -> /api/verify (+ /api/usage before/after each row)` : " · lib/fixtureCouncil.mjs offline replay"}`);
    log.info(`[DRY-RUN] output: ${outDir}/{rows/<id>.json, summary.json, summary.md} (nothing written now)`);
    for (const r of rows) log.info(`[DRY-RUN]   - ${r.id} (${r.category}) ${r.expected ? `scored: ${Object.keys(r.expected).join(",")}` : "unscored"}`);
    return;
  }

  const ctx = { ...opts, log };
  const meta = { runId, generatedAt: new Date().toISOString(), suite: path.relative(ROOT, path.resolve(opts.suite)).replaceAll("\\", "/"), mode: opts.mode, simulated: opts.mode === "fixture", minAvgConfidence: MIN_AVG_CONFIDENCE, partial: false };

  if (opts.mode === "live") {
    const health = await getJson(ctx, "/api/health").catch((err) => {
      throw configError(`Cannot reach Council API at ${opts.apiBase}: ${err.message}. Start it with: npm run live:server`);
    });
    ctx.models = configuredModels(health);
    if (ctx.models.length < 2) throw configError(`Need at least two configured providers. Found: ${ctx.models.join(", ") || "none"}`);
    ctx.modelOptions = health.modelOptions || null;
    Object.assign(meta, { apiBase: opts.apiBase, models: ctx.models, currentModels: health.models || null, braveSearchConfigured: Boolean(health.keysConfigured?.brave_search) });
    log.info(`live mode · models: ${ctx.models.join(", ")} · web search: ${meta.braveSearchConfigured ? "on" : "off"}`);
    log.warn("live mode calls paid provider APIs for every row; see eval/README.md for the cost warning.");
  } else {
    Object.assign(meta, { models: null });
    log.info("fixture mode · offline replay via lib/fixtureCouncil.mjs (simulated evidence)");
  }

  const results = [];
  onCancel((signal) => {
    log.warn(`Received ${signal} — writing partial summary (${results.length} row(s)) to ${outDir}`);
    try { writeOutputs(outDir, buildSummary({ ...meta, partial: true }, results), results); } catch (err) { log.error(`partial write failed: ${err.message}`); }
  });

  for (const row of rows) {
    if (isCancelling()) break;
    log.info(`[${row.id}] ${row.category}`);
    const result = opts.mode === "live" ? await runRowLive(ctx, row) : runRowFixture(ctx, row);
    results.push(result);
    log.info(`[${row.id}] ${result.status} · council: ${result.council.correctness.status} · verification: ${result.round3?.verificationScore ?? "n/a"} · cost: ${fmtUsd(result.usage?.totalUsd)} · ${fmtSeconds(result.latency?.total_ms)}s`);
  }

  const summary = buildSummary(meta, results);
  writeOutputs(outDir, summary, results);
  log.info(`summary: ${path.join(outDir, "summary.md")}`);
  process.stdout.write(`${path.join(outDir, "summary.md")}\n`);
}

const invokedDirectly = !process.argv[1] || path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`eval failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(error?.exitCode || EXIT.INTERNAL);
  });
}
