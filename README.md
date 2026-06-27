# The Council: Multi-Agent Verification Swarm

**The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.**

Track: Freestyle

The model is only ~10% of this system; the other ~90% is the **harness** — input redaction, role-separated orchestration, a tool allowlist, claim verification, and synthesis — that turns a single model into an auditable deliberation. The public demo path is fixture/offline by default: simulated, **reproducible**, and requiring no API keys or live provider calls.

## Quickstart

**Recommended (visual):** start the offline fixture UI and open it in a browser — the dashboard shows each agent, peer critiques, color-coded claim verdicts, confidence bars, decision scores, and the final synthesis:

```bash
npm run ui:fixture
```

Then open `http://127.0.0.1:4173` (no keys, no packages beyond Node/npm). On Windows: `launch.bat ui`.

**Command-line equivalent:** the same fixture evaluator, as text + JSON/Markdown reports:

```bash
npm run demo:fixture
```

On Windows, you can also double-click `launch.bat` for a menu, or run:

```bat
launch.bat ui
launch.bat fixture
launch.bat car-wash
launch.bat verify
```

The demo writes:

- `sample_outputs/latest_fixture_report.json`
- `sample_outputs/latest_fixture_report.md`

## Required Validation Commands

Run these before publishing or submitting:

```bash
npm run verify:capstone
```

That command runs the full public checklist:

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

Direct MCP self-test equivalent:

```bash
node mcp/server_stub.mjs --self-test
```

Optional weighted practical-reasoning scenario:

```bash
npm run demo:car-wash
```

## What The Demo Shows

The default question is:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

Expected result: four simulated Council agents answer independently, peer critique runs, a hidden verification swarm checks 12 fixture claims, and audit reports are exported. The JSON report is a **trajectory-style audit trail** — it records every critique and intermediate verdict, so a reviewer can confirm the answer was *earned*, not a "fragile success trap" where a good-looking output was reached by a flawed path. The Markdown report is the **human-readable vibe diff** for sign-off. The final answer preserves confidence and unresolved-claim handling instead of hiding uncertainty (effective trust, not a binary pass).

### Why a council, not a single agent?

Multi-agent adds coordination cost, so it has to earn its place. It does here because the task is **high-stakes verification**: the value is exactly the disagreement, critique, and claim-checking a single prompt collapses. The pipeline "slices the elephant" — generation, critique, fact-checking, and synthesis are separate roles — so no single context has to generate *and* police itself, avoiding the context rot that degrades a monolithic prompt.

The weighted car-wash scenario asks:

> I want to wash my car. The car wash is 50 meters away. Should I walk or drive?

Expected result: the Council recommends driving the car for the actual wash, while preserving the caveat that walking is reasonable for checking, paying, asking a question, or if the car is already at the wash. The report includes role weights, claim weights, decision scores, and unresolved assumptions.

## Architecture

```text
User Question
  -> Input Redaction / Risk Check
  -> Four Independent Council Agents
  -> Peer Critique
  -> Hidden Verification Swarm
  -> Claim Verification
  -> Confidence Summary
  -> Final Synthesis + Audit Export
```

See `ARCHITECTURE.md`, `docs/architecture.mmd`, and `docs/mode-matrix.md`.

## Course Concepts Demonstrated

- **Model + harness (10/90):** the LLM is ~10%; the deterministic harness — redaction, role orchestration, tool allowlist, verification, synthesis — is the ~90% that makes the system trustworthy
- **Multi-agent network, not a monolith ("slicing the elephant"):** four Council agents, peer critique, hidden verification swarm, final synthesis — separated to avoid context rot, and justified by the high-stakes verification goal
- **Effective trust + trajectory-aware evaluation:** the JSON report is a trajectory-style audit trail that exposes the reasoning journey (guards against "fragile success traps"), not just a final output
- **Human-readable vibe diff:** the Markdown report translates the multi-agent run into plain language for human sign-off
- **Spec-driven verification flow:** `specs/verification.feature` is the durable Gherkin contract; code is disposable, the spec is the source of truth
- **Security-first / least authority:** no-key fixture mode, `.env` ignored, placeholders only, redaction helper, input-risk classification, tool allowlist, secret scan
- **Deployability + reproducibility:** one-command fixture demo, deterministic reports (re-running reproduces identical verification content; only the run timestamp differs), smoke tests
- **Agent skills:** `skills/council-verification/SKILL.md`
- **MCP (transport interoperability):** a dependency-free read-only MCP-style stub speaking JSON-RPC 2.0 over stdio at `mcp/server_stub.mjs`
- **Weighted practical reasoning:** the car-wash fixture demonstrates role-weighted claim applicability where `drive` beats `walk` for the actual-wash interpretation, with counterfactual guardrails
- **Operational readiness:** `docs/process/QUALITY_OF_LIFE_BASELINE.md` maps the system to practical run/debug/safety features

See `COURSE_CONCEPTS.md`.

## Screenshot Assets

Public-safe screenshot helper pages are in `screenshots/`:

- `screenshots/cover.html`
- `screenshots/architecture.html`
- `screenshots/demo-output.html`

Open those local HTML files in a browser and capture screenshots for Kaggle, GitHub, or the video. They contain only public-safe fixture content.

You can also open the public fixture UI from the Windows launcher:

```bat
launch.bat ui
```

That starts a local offline UI at `http://127.0.0.1:4173`. It uses the same fixture evaluator as the CLI, writes `sample_outputs/latest_fixture_report.json` and `.md`, and does not require API keys.

## Optional Live Provider Mode

Live provider mode is optional and disabled by default. To try it locally, copy `.env.example` to `.env`, add your own provider keys, install the relevant client/server packages, and run the existing app servers.

The preserved React/Vite live UI lives in `client/` and expects the optional Express API in `server/`. From the launcher:

```bat
launch.bat install-ui
launch.bat ui-live
```

`launch.bat ui-live` starts the API on `http://localhost:3001` and the React UI on `http://localhost:5173` when dependencies are installed. Provider calls still require local API keys.

To inspect live-mode readiness without starting servers:

```bash
npm run ui:live:preflight
```

To run the online Council feedback loop against the live API and configured providers:

```bash
npm run live:feedback
```

Or from the Windows launcher:

```bat
launch.bat live-feedback
```

The feedback loop asks five stress questions, streams progress through answer, peer-evaluation, and verification phases, then writes `runs/live-feedback/latest.json` and `runs/live-feedback/latest.md`. It marks a run `needs_attention` when calls succeed but verification confidence collapses.

Do not use live mode for the public capstone demo unless you intentionally want a live-provider walkthrough. Do not commit `.env`, credentials, screenshots of private accounts, or live run outputs.

## Repository Structure

```text
client/                         Existing React/Vite UI
server/                         Existing optional live Express API
shadow-council/                 Existing optional shadow verification server
fixtures/                       Public-safe offline fixture data
lib/                            Fixture engine and security helper
mcp/                            Read-only MCP-style stub
skills/council-verification/    Reusable Council verification skill
sample_outputs/                 Generated fixture reports
screenshots/                    Public-safe screenshot helper pages
submission_assets/              Kaggle/GitHub submission helper docs
docs/                           Architecture and demo-flow docs
tests/                          Existing tests plus capstone smoke test
```

## Known Limitations

- Fixture mode is simulated; it demonstrates architecture, not live model quality.
- The MCP server is a small dependency-free stub, not a production MCP SDK server.
- Live provider mode needs user-supplied keys, provider availability, and separate review before public deployment.
- The existing UI is preserved, but the most reliable capstone review path is the offline fixture command.

## License Status

The copied source included an MIT-style `LICENSE`. See `LICENSE_REVIEW.md` before public release.
