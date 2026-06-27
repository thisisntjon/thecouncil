#!/usr/bin/env node
// Offline unit checks for lib/ops.mjs — no network, deterministic.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EXIT, sleep, writeTextAtomic, makeRunId, withTimeout, isTransient,
  retryAfterMs, retry, shouldShowProgress, resolveLevel, createLogger, onCancel
} from "../lib/ops.mjs";

// EXIT codes are distinct and frozen.
assert.equal(EXIT.OK, 0);
assert.notEqual(EXIT.USAGE, EXIT.CONFIG);
assert.throws(() => { EXIT.OK = 9; });

// writeTextAtomic creates parent dirs and writes the final file (no leftover .tmp).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-smoke-"));
const nested = path.join(tmp, "a", "b", "out.txt");
writeTextAtomic(nested, "hello");
assert.equal(fs.readFileSync(nested, "utf8"), "hello");
assert.ok(!fs.existsSync(`${nested}.tmp`));

// makeRunId is sortable-ish, unique per call, and matches the expected shape.
const id1 = makeRunId(new Date("2026-06-25T14:30:52"));
assert.match(id1, /^20260625-143052-[0-9a-f]{4}$/);
assert.notEqual(makeRunId(), makeRunId());

// withTimeout rejects with a classified transient error.
await assert.rejects(
  () => withTimeout(sleep(50).then(() => "late"), 5, "slowcall"),
  (err) => err.code === "ETIMEDOUT" && err.transient === true && /slowcall/.test(err.message)
);
// withTimeout passes a fast value through untouched.
assert.equal(await withTimeout(Promise.resolve("ok"), 1000), "ok");

// Transient classification.
assert.equal(isTransient({ status: 429 }), true);
assert.equal(isTransient({ status: 503 }), true);
assert.equal(isTransient({ code: "ECONNRESET" }), true);
assert.equal(isTransient({ status: 400 }), false);
assert.equal(isTransient(new Error("plain")), false);

// Retry-After parsing: seconds, Headers-like, and absent.
assert.equal(retryAfterMs({ retryAfter: "2" }), 2000);
assert.equal(retryAfterMs({ headers: { get: (k) => (k === "retry-after" ? "1" : null) } }), 1000);
assert.equal(retryAfterMs({ status: 500 }), null);

// retry: succeeds after transient failures, counts attempts, then stops.
let calls = 0;
const result = await retry(
  () => { calls += 1; if (calls < 3) { const e = new Error("boom"); e.status = 503; throw e; } return "done"; },
  { retries: 5, baseMs: 1, jitter: false }
);
assert.equal(result, "done");
assert.equal(calls, 3);

// retry: does NOT retry a non-transient error.
let nonTransientCalls = 0;
await assert.rejects(
  () => retry(() => { nonTransientCalls += 1; const e = new Error("bad input"); e.status = 400; throw e; }, { retries: 3, baseMs: 1 }),
  /bad input/
);
assert.equal(nonTransientCalls, 1);

// retry: exhausts and rethrows the last error.
await assert.rejects(
  () => retry(() => { const e = new Error("always"); e.status = 500; throw e; }, { retries: 2, baseMs: 1, jitter: false }),
  /always/
);

// Progress/level gating respects flags and non-TTY.
assert.equal(shouldShowProgress({ noProgress: true, stream: { isTTY: true } }), false);
assert.equal(shouldShowProgress({ quiet: true, stream: { isTTY: true } }), false);
assert.equal(shouldShowProgress({ stream: { isTTY: false } }), false);
assert.equal(resolveLevel({ debug: true }), "debug");
assert.equal(resolveLevel({ verbose: true }), "verbose");
assert.equal(resolveLevel({ quiet: true }), "quiet");
assert.equal(resolveLevel({ env: { LOG_LEVEL: "verbose" } }), "verbose");
assert.equal(resolveLevel({ env: {} }), "normal");

// Logger honors the threshold and writes to its stream (stderr-style sink here).
const lines = [];
const sink = { write: (s) => lines.push(s) };
const log = createLogger({ level: "normal", stream: sink, name: "test" });
log.debug("hidden");
log.info("shown");
assert.equal(lines.length, 1);
assert.match(lines[0], /INFO test shown/);

// JSON logger emits parseable records.
const jsonLines = [];
const jlog = createLogger({ level: "debug", json: true, stream: { write: (s) => jsonLines.push(s) }, name: "j" });
jlog.error("nope");
assert.equal(JSON.parse(jsonLines[0]).level, "error");

// onCancel returns an unregister function (don't actually fire signals here).
const off = onCancel(() => {});
assert.equal(typeof off, "function");
off();

console.log("ops smoke tests passed.");
