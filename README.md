# The Council: Multi-Agent Verification Swarm

**The Council turns one AI answer into a transparent deliberation: four frontier models answer a question independently, peer-critique each other, and then a hidden cross-vendor swarm re-checks every claim against a *different* model vendor — producing an evidence-backed final answer with a full audit trail.**

Track: Freestyle

The model is only ~10% of this system; the other ~90% is the **harness** — input redaction, role-separated orchestration, a tool allowlist, cross-vendor claim verification, and synthesis — that turns a single model into an auditable deliberation. **The project is the live agent.** A deterministic offline mode (no keys) exists too, but only as a reproducibility/CI fallback — see below.

## Quickstart

### ▶ Start here — the live agent

The real thing: four models (Claude, GPT, Gemini, Grok) stream their answers, the Council convenes for peer evaluation + a consensus score, and a **cross-vendor verification swarm** runs in parallel — every claim re-checked by a different vendor, with verdicts, confidence, and an audit trail.

```bash
cp .env.example .env        # then add your own provider keys
launch.bat install-ui       # one-time: install server/client/shadow deps
launch.bat live             # starts API + shadow verifier + React UI, opens http://localhost:5173
```

`launch.bat live` is idempotent — it reuses anything already running and starts only what's down. (No Windows? Start the three services manually: `npm --prefix server start`, `npm --prefix shadow-council start`, `npm --prefix client run dev`, then open `http://localhost:5173`.)

### Run without API keys (reproducibility / CI)

So anyone — including a judge without your keys — can run the pipeline end-to-end with **no keys and no network**, the same pipeline ships as a deterministic offline replay. This is what the automated tests run on and a "verify it works without my keys" fallback. Its evidence is **simulated** (it demonstrates the architecture, not live model quality — don't read it as live results):

```bash
npm run demo:fixture        # deterministic CLI dashboard; writes JSON + Markdown reports
```

On Windows: `launch.bat fixture`. Reports land in `sample_outputs/`.

## Validation

```bash
npm run verify:capstone     # demo:fixture + npm test + secret:scan + mcp:self-test
```

## What the live agent does

You ask a question; four models answer independently (with web search). You "Convene the Council" → peer evaluation surfaces strengths, weaknesses, disagreement, and a consensus score. In parallel, the **cross-vendor verification swarm** extracts each model's claims and re-checks them against a *different* vendor — so the verifier is never the author — producing Supported/Partial/Refuted verdicts with confidence and citations. The final verdict preserves confidence and unresolved claims instead of hiding uncertainty (effective trust, not a binary pass). The JSON audit trail records every critique and intermediate verdict — a **trajectory-style record** so a reviewer can confirm the answer was *earned*, not a "fragile success trap" reached by a flawed path.

### Why a council, not a single agent?

Multi-agent adds coordination cost, so it has to earn its place. It does here because the task is **high-stakes verification**: the value is exactly the disagreement, critique, and claim-checking a single prompt collapses. The pipeline "slices the elephant" — generation, critique, fact-checking, and synthesis are separate roles — so no single context has to generate *and* police itself, avoiding the context rot that degrades a monolithic prompt. A live run demonstrates this vividly: models often split on the answer, and the cross-vendor verification resolves it.

## Architecture

```text
User Question
  -> Input Redaction / Risk Check
  -> Four Independent Council Agents (live: Claude, GPT, Gemini, Grok)
  -> Peer Critique + Consensus
  -> Hidden Cross-Vendor Verification Swarm (each claim checked by a different vendor)
  -> Confidence Summary
  -> Final Synthesis + Audit Export
```

Live mode: React + Vite UI (`client/`) → Express API (`server/`) + Shadow Council verifier (`shadow-council/`). Offline mode: deterministic engine in `lib/fixtureCouncil.mjs`. See `ARCHITECTURE.md`, `docs/architecture.mmd`, `docs/mode-matrix.md`.

## Course Concepts Demonstrated

- **Model + harness (10/90):** the LLM is ~10%; the harness — redaction, role orchestration, tool allowlist, cross-vendor verification, synthesis — is the ~90% that makes the system trustworthy.
- **Multi-agent network, not a monolith ("slicing the elephant"):** four live models, peer critique, cross-vendor verification swarm, final synthesis — separated to avoid context rot, justified by the high-stakes verification goal.
- **Trajectory-aware evaluation + effective trust:** the audit trail exposes the reasoning journey of a *live* run (guards against the "fragile success trap"), not just a final output.
- **Security-first / least authority:** `.env` ignored, placeholders only, input redaction, input-risk classification, tool allowlist, secret scan. The keyless fixture mode also lets reviewers run safely.
- **Agent skills:** `skills/council-verification/SKILL.md` and `.claude/skills/add-fixture/`.
- **MCP (transport interoperability):** a dependency-free read-only MCP-style stub speaking JSON-RPC 2.0 over stdio at `mcp/server_stub.mjs` (honestly a stub, not a production SDK server).
- **Deployability + reproducibility:** the live app runs from one launcher command; a reproducible deploy path is documented; the deterministic offline mode reproduces the pipeline identically for CI.

See `COURSE_CONCEPTS.md`.

## Deployability

Deployment to a public endpoint is **not required** for judging (per the competition rubric), and we don't host the live app publicly (it runs on private keys — a no-login public endpoint would be an abuse/cost risk). The live agent is demonstrated in the **video**, and this **public repo with the setup steps above** is the project link. A reproducible deploy path is documented in `docs/` for anyone who wants to host it.

## Screenshot Assets

Public-safe helper pages in `screenshots/` (`cover.html`, `architecture.html`, `demo-output.html`) for Kaggle/GitHub/video stills. They contain only public-safe content.

## Repository Structure

```text
client/                         React 19 + Vite live UI (the agent's front end)
server/                         Express live API (orchestrates the 4 models)
shadow-council/                 Cross-vendor verification service
lib/                            Deterministic offline engine + security helpers
mcp/                            Read-only MCP-style stub
skills/council-verification/    Reusable Council verification skill
fixtures/                       Offline fixture data (no-key reproducibility)
sample_outputs/                 Generated fixture reports
screenshots/                    Public-safe screenshot helper pages
submission_assets/              Kaggle/GitHub submission helper docs
docs/                           Architecture, mode matrix, deploy notes
tests/                          Smoke tests (run on the offline engine)
```

## Known Limitations

- Live mode needs your own provider keys and provider availability; it costs money per run.
- The offline fixture mode is **simulated** — it proves the architecture and powers CI, not live model quality.
- The MCP server is a small dependency-free stub, not a production MCP SDK server.

## License Status

An MIT-style `LICENSE` is included (OSI-approved, compatible with the competition's CC-BY-4.0 winner license). See `LICENSE_REVIEW.md`.
