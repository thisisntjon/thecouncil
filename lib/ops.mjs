// lib/ops.mjs — shared operational-readiness toolkit (QoL baseline).
//
// Dependency-free ESM primitives reused by the CLI scripts and both servers so
// timeouts, retries, run IDs, logging, atomic writes, and cancellation behave
// the same everywhere. Prefer these over hand-rolling the same patterns again.

import fs from "node:fs";
import path from "node:path";

// ── Exit codes ──────────────────────────────────────────────
// Distinct codes so callers and CI can branch on failure class (#1).
export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 2, // bad input/flags
  CONFIG: 3, // missing/invalid setup (keys, deps)
  TRANSIENT: 4, // retried and still failed
  INTERNAL: 70 // unexpected bug
});

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Atomic writes (#10/#14) ─────────────────────────────────
// Write to a temp file then rename so a crash mid-write can't leave a partial
// final file. Creates the parent directory if needed.
export function writeTextAtomic(targetPath, contents) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, targetPath);
}

// ── Run IDs (#14) ───────────────────────────────────────────
// `20260625-143052-7f3a` — sortable timestamp + per-process counter + short
// random so concurrent runs don't collide. Plain Node runtime: Date is fine.
let runCounter = 0;
export function makeRunId(date = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const seq = pad((runCounter = (runCounter + 1) % 0x10000).toString(16), 4);
  return `${stamp}-${seq}`;
}

// ── Timeouts (#6) ───────────────────────────────────────────
// Reject with a classified (transient) error if `promise` outlives `ms`.
export function withTimeout(promise, ms, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "ETIMEDOUT";
      err.transient = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Retry classification + Retry-After (#7/#16) ─────────────
const NETWORK_CODES = new Set([
  "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EPIPE"
]);

// Default: retry on network blips, timeouts, HTTP 429, and 5xx.
export function isTransient(err) {
  if (!err) return false;
  if (err.transient === true) return true;
  if (err.code && NETWORK_CODES.has(err.code)) return true;
  const status = err.status ?? err.statusCode;
  return status === 429 || (typeof status === "number" && status >= 500 && status < 600);
}

// Parse a Retry-After value (seconds or HTTP-date) into milliseconds, or null.
// Accepts err.retryAfterMs, err.retryAfter, or a Headers-like err.headers.
export function retryAfterMs(err, now = Date.now()) {
  if (!err) return null;
  if (typeof err.retryAfterMs === "number") return Math.max(0, err.retryAfterMs);
  let raw = err.retryAfter;
  const headers = err.headers;
  if (raw == null && headers) {
    raw = typeof headers.get === "function" ? headers.get("retry-after") : headers["retry-after"];
  }
  if (raw == null) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(raw);
  return Number.isNaN(when) ? null : Math.max(0, when - now);
}

// ── Retry with exponential backoff + jitter (#7) ────────────
// Only wrap idempotent/safe operations. `fn(attempt)` is awaited; on a transient
// failure it's retried up to `retries` times. Honors Retry-After by default.
export async function retry(fn, opts = {}) {
  const {
    retries = 3,
    baseMs = 500,
    factor = 2,
    maxMs = 30000,
    jitter = true,
    retryOn = isTransient,
    honorRetryAfter = true,
    onRetry = null
  } = opts;

  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !retryOn(err)) throw err;
      const hinted = honorRetryAfter ? retryAfterMs(err) : null;
      const backoff = Math.min(maxMs, baseMs * factor ** attempt);
      const jittered = jitter ? Math.round(backoff * (0.5 + Math.random() * 0.5)) : backoff;
      const delay = hinted != null ? Math.min(maxMs, hinted) : jittered;
      if (onRetry) onRetry({ attempt: attempt + 1, retries, delay, error: err });
      await sleep(delay);
      attempt += 1;
    }
  }
}

// ── TTY / CI awareness (#13 gating) ─────────────────────────
export function isInteractive(stream = process.stderr) {
  return Boolean(stream && stream.isTTY) && !process.env.CI;
}

// Progress is shown only on an interactive TTY, never under CI / --no-progress / --quiet.
export function shouldShowProgress({ noProgress = false, quiet = false, stream = process.stderr } = {}) {
  return !noProgress && !quiet && isInteractive(stream);
}

// ── Leveled logging (#3) ────────────────────────────────────
const LEVELS = { silent: 0, quiet: 1, normal: 2, verbose: 3, debug: 4 };

// Resolve a level name from flags then LOG_LEVEL env then a default.
export function resolveLevel({ quiet = false, verbose = false, debug = false, env = process.env } = {}) {
  if (debug) return "debug";
  if (verbose) return "verbose";
  if (quiet) return "quiet";
  const fromEnv = (env.LOG_LEVEL || "").toLowerCase();
  return fromEnv in LEVELS ? fromEnv : "normal";
}

// Console logs go to stderr so stdout stays clean for machine-readable output (#11).
export function createLogger({ level = "normal", json = false, stream = process.stderr, name = "" } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.normal;
  const tag = name ? `${name} ` : "";
  const emit = (lvl, severity, args) => {
    if (LEVELS[lvl] > threshold) return;
    if (json) {
      stream.write(`${JSON.stringify({ ts: new Date().toISOString(), level: severity, name: name || undefined, msg: args.map(String).join(" ") })}\n`);
    } else {
      stream.write(`[${new Date().toISOString()}] ${severity.toUpperCase()} ${tag}${args.map(String).join(" ")}\n`);
    }
  };
  return {
    level,
    enabled: (lvl) => (LEVELS[lvl] ?? 99) <= threshold,
    error: (...a) => emit("quiet", "error", a), // errors show unless fully silent
    warn: (...a) => emit("quiet", "warn", a),
    info: (...a) => emit("normal", "info", a),
    verbose: (...a) => emit("verbose", "verbose", a),
    debug: (...a) => emit("debug", "debug", a)
  };
}

// ── Graceful cancellation (#5) ──────────────────────────────
// Register a handler for SIGINT/SIGTERM. First signal runs handlers (flush,
// checkpoint, release); a second forces an immediate exit so a hung handler
// can't trap the user. Returns an unregister function.
const cancelHandlers = new Set();
let signalsInstalled = false;
let cancelling = false;

function installSignals() {
  if (signalsInstalled) return;
  signalsInstalled = true;
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, async () => {
      if (cancelling) {
        process.exit(130); // second signal: hard exit
        return;
      }
      cancelling = true;
      for (const handler of cancelHandlers) {
        try {
          await handler(sig);
        } catch {
          // a failing cleanup handler must not block the others or the exit
        }
      }
      process.exit(130);
    });
  }
}

export function onCancel(handler) {
  installSignals();
  cancelHandlers.add(handler);
  return () => cancelHandlers.delete(handler);
}

export function isCancelling() {
  return cancelling;
}
