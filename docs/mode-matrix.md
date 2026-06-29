# Mode Matrix

The Council's headline mode is the **live multi-agent agent**. A deterministic no-key offline mode
ships alongside it for reproducibility and CI. Keep these distinct when demoing, testing, or recording
submission material.

## Live Provider UI (the headline — this is the project)

- Command: `launch.bat live` (alias: `launch.bat ui-live`); first run `launch.bat install-ui`
- Preflight: `npm run ui:live:preflight`
- URL: `http://localhost:5173`
- Implementation: `client/` (React 19 + Vite + Tailwind/shadcn) plus `server/` and `shadow-council/`
- Evaluator: live `/api/ask`, `/api/evaluate`, and cross-vendor `/api/verify`
- Behavior: four frontier models (Claude, GPT, Gemini, Grok) answer independently and stream → "Convene
  the Council" peer evaluation + consensus → a cross-vendor verification swarm re-checks every claim
  against a *different* vendor → final verdict + audit trail
- Requires dependencies: `client/node_modules`, `server/node_modules`, `shadow-council/node_modules`
- Requires provider keys: Anthropic, OpenAI, Google, and xAI/Grok keys for full participation
- Requires network: yes
- Submission status: **the demo.** Shown in the submission video; see `docs/deploy.md` for the
  reproducible deploy path. We do not host it publicly (it runs on private keys).

## Live Feedback Loop (live diagnostic)

- Command: `npm run live:feedback` or `launch.bat live-feedback`
- Implementation: `scripts/live_feedback_loop.mjs`
- Evaluator: live `/api/ask`, `/api/evaluate`, and `/api/verify`
- Inputs: five current stress questions covering practical reasoning, current factuality, simple-reasoning traps, symbolic constraints, and prompt injection
- Outputs: streamed progress plus `runs/live-feedback/latest.json` and `.md`
- Requires live API: `http://127.0.0.1:3001`
- Requires provider keys/network: yes
- Submission status: live diagnostic path; useful for proving live Council/swarm behavior and exposing
  failure points (see `submission_assets/EVALUATION_SUMMARY.md`), not for committed static screenshots.

## No-Key Offline UI (reproducibility fallback)

- Command: `launch.bat ui` (alias: `launch.bat ui-fixture`)
- URL: `http://127.0.0.1:4173`
- Implementation: `scripts/fixture_ui_server.mjs`
- Evaluator: `lib/fixtureCouncil.mjs`
- Inputs: public-safe fixture questions and optional custom text
- Outputs: browser UI plus `sample_outputs/latest_fixture_report.json` and `.md`
- Requires API keys: no
- Requires network: no
- Submission status: no-key fallback so a keyless reviewer can run the pipeline; evidence is **simulated**,
  never present it as live results.

## No-Key Offline CLI (reproducibility / CI)

- Command: `npm run demo:fixture` or `npm run demo:car-wash`
- Implementation: `demo_fixture.mjs`
- Evaluator: `lib/fixtureCouncil.mjs`
- Outputs: console summary plus `sample_outputs/latest_fixture_report.json` and `.md`
- Requires API keys: no
- Requires network: no
- Submission status: what `npm test` / CI runs on; deterministic and reproducible. Simulated evidence —
  demonstrates the architecture, not live model quality.

## Main Express Fixture Routes

- Endpoints: `GET /api/fixture/questions`, `POST /api/fixture/run`
- Implementation: `server/index.js`
- Evaluator: `lib/fixtureCouncil.mjs`
- Requires API keys: no
- Requires network: no
- Purpose: lets an installed live server expose the same no-key offline behavior

## Main Express Live Verification

- Endpoint: `POST /api/verify`
- Implementation: `server/index.js`
- Evaluator: live claim extraction, cross-reference, search/fallback verification, disagreement resolution, and synthesis
- Requires dependencies: `server/node_modules`
- Requires provider keys/network: yes for meaningful live verification
- Submission status: part of the live agent; not the offline evaluator

## Shadow Council Server (cross-vendor verifier)

- Command: `npm --prefix shadow-council start`
- Endpoint: `POST /api/verify`, `GET /api/stream`
- Implementation: `shadow-council/index.js`
- Evaluator: separate cross-vendor verification pipeline (re-checks claims against a different vendor)
- Requires dependencies: `shadow-council/node_modules`
- Requires provider keys/network: yes
- Submission status: the verification swarm behind the live agent (started automatically by `launch.bat live`).

## Rule Of Thumb

The live agent is the project — use it to demo, and use the live feedback loop to stress-test real
provider behavior. Use the no-key offline mode when you (or a keyless reviewer / CI) need to reproduce
the pipeline deterministically without keys, network, or cost.
