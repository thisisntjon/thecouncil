# Quality of Life Baseline

This checklist maps the project to a practical operational-readiness baseline. It covers **two
execution paths**, because they have very different risk profiles:

- **Fixture path** (public default) — `demo_fixture.mjs`, the fixture UI server, and the fixture
  engine in `lib/`. Offline, deterministic, no keys, no network. **Tier: Standard.**
- **Live path** (optional) — `scripts/live_feedback_loop.mjs` and the `server/` + `shadow-council/`
  services. Real multi-provider LLM calls over the network. **Tier: Heavy.**

An earlier version of this doc predated the live machinery and marked the network features
"Not Applicable." That is no longer true: the live path now does real API work and has been hardened
to match. Shared primitives live in **`lib/ops.mjs`** (timeouts, retries with backoff + jitter,
run IDs, leveled TTY/CI-aware logging, atomic writes, SIGINT/SIGTERM cancellation).

## Official paths

```bash
# Public (offline, no keys)
npm run demo:fixture          # add --help / --dry-run / --json / --output DIR
npm test                      # ops unit checks + capstone smoke
npm run verify:capstone       # demo + test + secret scan + MCP self-test
npm run ui:fixture            # offline fixture UI (graceful Ctrl+C; clear port-in-use error)

# Live (optional, requires provider keys in .env)
npm run ui:live:preflight     # dependency/key readiness
npm run live:feedback -- --help            # full flag surface
npm run live:feedback -- --dry-run --limit 1   # plan only, zero API calls
```

## Checklist (per path)

| # | Feature | Fixture | Live | Notes |
|---|---|---|---|---|
| 1 | Robust error handling | ✅ Implemented | ✅ Implemented | Classified `EXIT` codes (2 usage / 3 config / 4 transient / 70 internal); provider try/catch; JSON-parse fallbacks now logged + carry `parser_fallback`; `requireVerifier` fails clearly instead of a keyless-Claude crash. |
| 2 | Preflight validation | N/A — no external deps | ✅ Implemented | `live_preflight.mjs`; `/api/health` returns `ok\|degraded` with per-provider detail; feedback loop checks health + ≥2 models before running. |
| 3 | Structured logging | ⚪ Light (console + `--json`) | ✅ Implemented | Leveled logger (quiet/normal/verbose/debug via `LOG_LEVEL`/`-v`/`-q`/`--debug`), timestamps, stderr-for-logs / stdout-for-data. |
| 4 | Clear status summaries | ✅ Implemented | ✅ Implemented | Before/after counts, run ID, output paths, elapsed time. |
| 5 | Graceful cancellation | ✅ Implemented | ✅ Implemented | Fixture UI: `onCancel` → `server.close` + actionable `EADDRINUSE`. Feedback loop: SIGINT flushes a partial report. |
| 6 | Timeout controls | N/A — no I/O waits | ✅ Implemented | `withTimeout` on every provider call; env `API_TIMEOUT_MS`/`API_SEARCH_TIMEOUT_MS`; feedback `--timeout`. |
| 7 | Retries w/ backoff | N/A | ✅ Implemented | Exp backoff + jitter, honors `Retry-After`; env `API_RETRIES`; feedback `--retries`. Retries only idempotent work (see safety notes). |
| 8 | Config / env support | ✅ Implemented | ✅ Implemented | Flags > env > defaults in the feedback loop; tuning vars documented in `.env.example`. |
| 9 | Dry-run / preview | ✅ Implemented (`--dry-run`) | ✅ Implemented (`--dry-run`) | Live dry-run makes zero API calls and writes nothing. |
| 10 | Idempotency | ✅ Implemented | ✅ Implemented | Atomic write (temp→rename). Live runs write `runs/live-feedback/<runId>/` plus a stable `latest` copy. |
| 11 | Machine-readable output | ✅ Implemented | ✅ Implemented | `demo --json`; feedback JSON report + `--output-format json\|md\|both`. |
| 12 | Test / sample mode | ✅ Implemented (fixture *is* the sample) | ✅ Implemented | Feedback `--sample` / `--limit N` / `--filter ids`. |
| 13 | Progress indicators | N/A — completes instantly | ✅ Implemented | Per-question progress + approx ETA; auto-disabled on non-TTY / `CI` / `--no-progress` / `--quiet`. |
| 14 | Checkpoints | N/A | ⚪ N/A (documented) | 5-question batch; each run is preserved under its own `runId` dir, so a per-item checkpoint would add complexity without payoff. |
| 15 | Resume support | N/A | ⚪ N/A (documented) | Same rationale as #14; re-running is cheap and safe. |
| 16 | Rate-limit awareness | N/A | ✅ Implemented | `Retry-After` honored in backoff; `--workers` defaults to 1; server batches verification calls. |
| 17 | Batching controls | N/A | ✅ Implemented | Server `processInBatches` (size 3) for verification; feedback `--workers`. |
| 18 | ETA / throughput | N/A | ✅ Implemented | Approx ETA + average per-question time in the progress line; `durationMs` per question. |
| 19 | Audit trail | ✅ Implemented | ✅ Implemented | Fixture report `auditTrail`; live run-ID'd JSON reports under `runs/live-feedback/<runId>/`. |
| 20 | Fallback strategies | ✅ Implemented | ✅ Implemented | No-key fixture mode is the safe fallback. Live: Brave→LLM-knowledge fallback; Shadow Council dispatch status surfaced in the `complete` event and failures logged (no longer fire-and-forget-silent). |
| 21 | Profiling hooks | N/A | ⚪ N/A | Performance is not a risk; per-call latency is already recorded. |
| 22 | Parallelization | N/A | ✅ Implemented | Server fans providers out via `Promise.allSettled`; feedback `--workers` (conservative default, documented rate-limit boundary). |

## Acceptance report

1. **QoL features added.** Shared `lib/ops.mjs` toolkit; live-path timeouts, retries+backoff, `Retry-After`,
   graceful cancellation, run IDs, leveled logging, progress+ETA, dry-run, sample/limit/filter, worker
   pool; honest `/api/health`; `requireVerifier` (no keyless-provider crash); Shadow Council
   dispatch-status reporting; logged JSON-parse fallbacks; fixture-path `--help/--output/--dry-run/--json`
   + run ID; fixture-UI port-in-use handling + graceful shutdown; preflight/secret-scan error handling.
2. **Considered but Not Applicable.** Checkpoints (#14) and resume (#15) — small fixed batch, each run
   preserved by run ID. Profiling hooks (#21) — performance not a submission risk. Most network features
   remain N/A for the **fixture** path by design (offline, deterministic, no waits).
3. **New commands / flags / config / files.** Files: `lib/ops.mjs`, `tests/ops_smoke.mjs`.
   Scripts: `npm run test:ops`. Flags: `demo_fixture.mjs` `--help/--output/--dry-run/--json`;
   `live_feedback_loop.mjs` `--help/--dry-run/--sample/--limit/--workers/--timeout/--retries/--output/--output-format/--no-progress/-v/-q/--debug`.
   Env: `API_TIMEOUT_MS`, `API_SEARCH_TIMEOUT_MS`, `API_RETRIES` (and existing `SHADOW_COUNCIL_URL`,
   `PORT`, provider keys). Removed dead `COUNCIL_MODE`. New `/api/health` fields: `live.{ready,
   configuredProviders,missingProviders,reason}`; new `complete` event field: `shadow.{dispatched,reason}`.
4. **New dependencies.** None. Everything is built on Node built-ins + the existing stack.
5. **Normal execution.** `npm run demo:fixture` (offline); live: start the server (`launch.bat ui-live`)
   then `npm run live:feedback`.
6. **Dry run.** `npm run demo:fixture -- --dry-run`; `npm run live:feedback -- --dry-run` (zero API calls).
7. **Sample / test mode.** Fixture mode is itself the sample; live: `npm run live:feedback -- --sample`
   (or `--limit N` / `--filter id`).
8. **Resume from checkpoint.** N/A (documented above). The newest live run is always at
   `runs/live-feedback/latest.{json,md}`; full history is under `runs/live-feedback/<runId>/`.
9. **Logs, structured outputs, audit trails.** Leveled logger to stderr; machine-readable reports to
   stdout / files; fixture reports carry an `auditTrail`; each live run is an audit record under its
   `runId`.
10. **Safety notes.** Retries cover only idempotent work — the feedback loop retries the **connection**
    to non-idempotent SSE endpoints but never re-issues a request once streaming begins, so provider
    work is never duplicated. `--workers` defaults to 1 and its rate-limit boundary is documented.
    `Retry-After` is honored. No destructive operations; important outputs use atomic writes. Live mode
    is optional and off by default; the secret-scan pre-commit hook blocks committing keys/live outputs.

## Default tuning rationale

Defaults were reviewed against a real 5-question live run (`runs/live-feedback/`) rather than guessed.
Observed: worst provider answer ~16s, worst evaluator ~34s, slowest question ~145s, **zero** retries/transient
failures fired. Verdict: **hold every default** — none of the data argues for loosening anything.

| Knob | Default | Rationale |
|---|---|---|
| `API_TIMEOUT_MS` / `API_SEARCH_TIMEOUT_MS` | 60s / 90s | ~1.8–3.5× headroom over worst observed latency. |
| `API_RETRIES` / `--retries` | 2 | Never triggered; cheap insurance for transient blips. |
| `--workers` | 1 | Sequential run completed clean; >1 multiplies provider request rate — raise only with known quota. |
| verify batch / delay | 3 / 300ms | No throttling observed. |
| `MIN_AVG_CONFIDENCE` / `MIN_PROVIDER_CONFIDENCE` | 60 / 25 | **Held deliberately.** The low scores that tripped these were a *scoring defect* (reasoning claims marked unverifiable), now fixed by the reasoning-verification mode — not a reason to lower the bar. The lowest legitimately-scored value observed was 33.3, so 25 won't false-flag genuine low-but-nonzero scores. |

A fully clean threshold re-baseline would use a `BRAVE_SEARCH_API_KEY`-enabled run (factual claims get real web evidence instead of the conservative knowledge fallback); without a Brave key the factual path runs degraded, so factual thresholds are held pending such a run. The reasoning-mode fix is independent of web search.

## Safety boundary (unchanged)

- Live-provider mode remains optional and disabled by default; fixture mode needs no keys.
- The MCP surface is a read-only fixture stub, not a production MCP SDK server.
- The secret scan reports only risky path/category matches and never prints secret values.
- Private research notes belong only under `_private_course_alignment/`, which is git-ignored.
