# Mode Matrix

The Council has one public default path and two optional live paths. Keep these distinct when demoing, testing, or recording submission material.

## Public Fixture UI

- Command: `launch.bat ui`
- URL: `http://127.0.0.1:4173`
- Implementation: `scripts/fixture_ui_server.mjs`
- Evaluator: `lib/fixtureCouncil.mjs`
- Inputs: public-safe fixture questions and optional custom text
- Outputs: browser UI plus `sample_outputs/latest_fixture_report.json` and `.md`
- Requires API keys: no
- Requires network: no
- Submission status: recommended public UI path

## Public Fixture CLI

- Command: `npm run demo:fixture` or `npm run demo:car-wash`
- Implementation: `demo_fixture.mjs`
- Evaluator: `lib/fixtureCouncil.mjs`
- Outputs: console summary plus `sample_outputs/latest_fixture_report.json` and `.md`
- Requires API keys: no
- Requires network: no
- Submission status: recommended validation/demo path

## Optional Live Provider UI

- Command: `launch.bat ui-live`
- Preflight: `npm run ui:live:preflight`
- Implementation: `client/` plus `server/`
- Evaluator: live `/api/ask`, `/api/evaluate`, and optional `/api/verify`
- Requires dependencies: `client/node_modules` and `server/node_modules`
- Requires provider keys: Anthropic, OpenAI, Google, and xAI keys for full model participation
- Requires network: yes
- Submission status: optional local exploration only; do not use for public demo unless keys, costs, and outputs have been separately reviewed

## Optional Live Feedback Loop

- Command: `npm run live:feedback` or `launch.bat live-feedback`
- Implementation: `scripts/live_feedback_loop.mjs`
- Evaluator: live `/api/ask`, `/api/evaluate`, and `/api/verify`
- Inputs: five current stress questions covering practical reasoning, current factuality, simple-reasoning traps, symbolic constraints, and prompt injection
- Outputs: streamed progress plus `runs/live-feedback/latest.json` and `.md`
- Requires live API: `http://127.0.0.1:3001`
- Requires provider keys/network: yes
- Submission status: optional diagnostic path; useful for proving live Council/swarm behavior and exposing failure points, not for public artifact screenshots

## Main Express Fixture Routes

- Endpoints: `GET /api/fixture/questions`, `POST /api/fixture/run`
- Implementation: `server/index.js`
- Evaluator: `lib/fixtureCouncil.mjs`
- Requires API keys: no
- Requires network: no
- Purpose: lets an installed live server expose the same no-key fixture behavior

## Main Express Live Verification

- Endpoint: `POST /api/verify`
- Implementation: `server/index.js`
- Evaluator: live claim extraction, cross-reference, search/fallback verification, disagreement resolution, and synthesis
- Requires dependencies: `server/node_modules`
- Requires provider keys/network: yes for meaningful live verification
- Submission status: optional; not the public fixture evaluator

## Optional Shadow Council Server

- Command: `npm --prefix shadow-council start`
- Endpoint: `POST /api/verify`, `GET /api/stream`
- Implementation: `shadow-council/index.js`
- Evaluator: separate Anthropic/web-search verification pipeline
- Requires dependencies: `shadow-council/node_modules`
- Requires provider keys/network: Anthropic key and network
- Submission status: optional diagnostic/live mode, not required for the public fixture demo

## Rule Of Thumb

Use fixture mode when showing course concepts, reproducibility, security, and the car-wash weighted reasoning scenario. Use live mode only when intentionally demonstrating provider behavior with local keys and accepted cost/privacy tradeoffs.
