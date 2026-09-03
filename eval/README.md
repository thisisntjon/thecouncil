# Council eval harness

`eval/run_eval.mjs` runs a JSONL suite of questions through the same three Council rounds the
live app runs — Round 1 independent answers, Round 2 peer evaluation, Round 3 cross-vendor
verification + synthesis — and writes a per-row JSON record, a `summary.json`, and a
`summary.md` table with a "Failures" section that reproduces every wrong or weakly verified
council answer verbatim.

It is an instrument for looking at the system's behavior on a handful of questions. It is
**not** a benchmark, and it ships no ground truth beyond what the repo already contained.
Read "What is NOT measured" before quoting any number from it.

## Running

```bash
# Validate a suite and print the plan (no API calls, no files written)
node eval/run_eval.mjs --suite eval/suites/smoke-5.jsonl --dry-run

# Offline, no keys, no network — replays lib/fixtureCouncil.mjs (simulated evidence)
npm run eval:fixture
#   = node eval/run_eval.mjs --suite eval/suites/smoke-5.jsonl --mode fixture --out eval/runs/fixture

# Live, with your own keys (costs money — see below)
npm run live:server            # in another terminal; needs >= 2 provider keys in .env
node eval/run_eval.mjs --suite eval/suites/smoke-5.jsonl --mode live
node eval/run_eval.mjs --suite eval/suites/smoke-5.jsonl --mode live --limit 1   # one row first
```

Options: `--mode live|fixture` (default `live`), `--out DIR` (default `eval/runs/<timestamp>/`),
`--limit N`, `--dry-run`, `--api-base URL`, `--api-token TOKEN`, `--timeout SECONDS`,
`--retries N`, `-v`, `-q`. `eval/runs/` is gitignored; live outputs stay local.

### Live mode: what it talks to

Live mode does not import the provider SDKs or hold any key. Like `scripts/live_feedback_loop.mjs`,
it drives a **running** `server/` over HTTP + SSE and consumes the same events the React client
consumes:

| Round | Endpoint | Server code path |
|---|---|---|
| 1 — four independent answers | `POST /api/ask` (`skipShadow: true`) | `searchCallers[*]` + `buildCouncilSystemPrompt` |
| 2 — peer evaluation | `POST /api/evaluate` | the judge prompt + JSON parsing in `server/index.js` |
| 3 — verification + synthesis | `POST /api/verify` | `extractClaimsFromAnswer` → `crossReferenceClaims` → `verifyClaim` (reasoning re-derivation / web / knowledge fallback, verifier ≠ author) → `computeConfidenceScores` → `synthesizeVerifiedAnswer` |
| tokens / cost | `GET /api/usage` before and after each row; prices from `GET /api/health` `modelOptions` | `trackUsage` ledger; `MODEL_OPTIONS` price table |

`skipShadow: true` is the same setting the feedback loop uses: Round 3 is run explicitly by the
harness through `server/`'s swarm rather than fire-and-forgotten to the optional
`shadow-council/` service, so the harness can observe every verdict. The `shadow-council/`
service is therefore **not** exercised by this harness.

Requests are retried only at the connection stage (transient network errors); once the server
starts streaming a round, the request is never re-issued, because each round triggers paid,
non-idempotent provider work.

## Suite format

One JSON object per line:

```json
{"id": "car_wash_50m", "question": "...", "category": "physical commonsense",
 "expected": {"answer_regex": "...", "must_include": ["..."], "must_not_include": ["..."]},
 "notes": "where the question and the expectation come from"}
```

- `id`, `question`, `category` are required; `id` must be unique.
- `expected` is optional. If present, an answer passes only if `answer_regex` matches (case-insensitive)
  **and** every `must_include` string is present **and** no `must_not_include` string is present.
- If `expected` is absent the row is **unscored**: the pipeline still runs and everything else is
  recorded, but correctness is reported as `unscored`, never as pass.

`eval/suites/smoke-5.jsonl` contains five questions that already existed in the repo
(`fixtures/*.json` + `tests/capstone_smoke.mjs`, `scripts/live_feedback_loop.mjs`,
`sample_outputs/live_runs/`). Three carry an `expected` taken from the repo; two are unscored because
the repo has no expected answer for them. No expected answers were invented; each row's `notes` says
where its expectation came from and how strong it is (the car-wash regex, for example, is a weaker
proxy than the feedback loop's full drive-first validator).

## What is measured (per row)

- **Baseline single-model correctness** — each Round 1 answer scored against `expected` on its own,
  so the council result can be compared with what any one model would have said.
- **Council correctness** — the Round 3 synthesis answer scored against `expected`.
- **Verification score** — `(supported + 0.5 × partially_supported) / verifiable claims × 100`, the
  server's own `computeConfidenceScores`, averaged over models in live mode. Rows below
  `COUNCIL_MIN_AVG_CONFIDENCE` (default 60, same env var as the feedback loop) are flagged "low".
- **Verdict counts** — supported / partially_supported / refuted / unverifiable.
- **Verification-method counts** — reasoning re-derivation vs. web search vs. knowledge fallback
  (live), or reasoning re-derivation vs. fixture evidence (fixture mode).
- **Token usage and USD cost per vendor** — from the server's `trackUsage` ledger (`GET /api/usage`),
  priced only with the server's `MODEL_OPTIONS` table. Any call whose model the server does not price
  (e.g. the search-API model id) makes that vendor's cost `n/a`; nothing is estimated locally. Fixture
  mode is always `n/a` (no provider calls).
- **Wall-clock latency** per round and total.

The failures section lists every row where the council answer failed its check, verification was
low, a round errored, or the row could not run — with the council answer verbatim and the refuted
claims listed — so failure modes are exposed rather than averaged away.

## What is NOT measured

- **No ground-truth benchmark ships with this repo.** Correctness is only checked where a row has
  `expected`, and those expectations are regex/substring proxies copied from the repo, not graded
  reference answers. A `pass` means "matched the pattern", not "was right"; a regex can match a
  wrong answer that mentions the right string, and can miss a right answer phrased differently.
- **Peer-evaluation quality is recorded, not scored.** Round 2 ratings are stored in each row's JSON
  but nothing judges whether the judges were right.
- **Verdict accuracy is not measured.** The verification score reports how many claims the swarm
  marked supported; it does not know whether those verdicts were correct. A high score with a wrong
  final answer is possible and would show up only in the failures section.
- **Fixture mode measures the harness, not the models.** Its answers, claims and verdicts are
  pre-authored fixture data (`simulated: true`); only questions with a fixture can run, and the rest
  are reported as `skipped_no_fixture`. Never present fixture-mode numbers as live results.
- **`shadow-council/` is not exercised** (see above).

## Statistical power — read before comparing anything

A five-question suite cannot detect small effects. With n = 5, the difference between the council
and a single model would have to be enormous (on the order of 3–4 rows out of 5 flipping) to be
distinguishable from noise, and live model output is itself non-deterministic run to run. If you
intend to claim "the council is better/worse than model X":

1. Decide the comparison and the metric first (e.g. council pass rate vs. best single-model pass
   rate on `answer_regex`).
2. **Pre-register N** — pick the suite size before running, based on the smallest effect you would
   care about, and do not stop early or add rows after seeing results.
3. Run the same suite more than once; report the spread, not one run.
4. Keep the suite's `expected` fields fixed for the whole comparison; changing a regex after a run
   invalidates it.

Without that, the honest reading of a `summary.md` is a list of observations about specific
questions, not evidence of an effect in either direction.

## Cost warning

Every live row makes roughly a dozen or more paid provider calls: four Round 1 answers (with web
search where the vendor supports it), up to four Round 2 evaluations, then one claim extraction per
answer, one cross-reference call, one verification call per unique claim (often 10–30), disagreement
resolutions, and one synthesis. Cost scales with claim count, which scales with answer length. Run
`--dry-run` first, then `--limit 1`, and read the per-vendor cost table in `summary.md` before
running a full suite. Costs shown are the server's own price table applied to the server's own
token ledger; check both against your providers' current pricing.
