# Video Script

Target length: 5 minutes or less. Estimated read time: about 4 minutes. Track: Freestyle.

## 0:00-0:20 - Problem and Hook

"A single AI answer can sound confident even when it is incomplete. The Council asks a simple question: what if an answer had to survive independent agents, peer critique, and claim-level verification before becoming final?"

## 0:20-0:50 - What The Council Is

"The Council is a multi-agent verification swarm. Four visible agents answer independently. They critique each other. Then a hidden verification swarm extracts claims and re-checks each one against a *different* model vendor before producing an auditable final response."

Show `screenshots/cover.html`.

## 0:50-1:25 - Architecture

Show `screenshots/architecture.html` or `ARCHITECTURE.md`.

"The stages are input redaction, four independent answers, peer critique, hidden claim verification, confidence summary, final synthesis, and audit export. The important course idea is that this is not just a chatbot: the model is only about ten percent of it. The other ninety percent is a harness — redaction, role separation, tool boundaries, verification, and audit export."

"The Council runs two ways. What you're about to see is live mode. Everything is also reproducible offline with no keys, which I'll show at the end."

## 1:25-3:15 - Live Demo (the centerpiece)

Drive the live React UI (Tailwind + shadcn/ui). Ask a real question, then narrate the flow as it streams:

- "Round one: all four models — Claude, GPT, Gemini, and Grok — answer independently, streaming their reasoning live."
- "Convene the Council: the agents peer-evaluate each other and a consensus score forms."
- "Round three is the part I'm proudest of: a cross-vendor verification swarm runs in parallel — every claim is re-checked by a *different* vendor than authored it. You can see the verdict badges, the confidence bars, and the 'verified by' tag on each claim."
- "It even refutes weak claims from the winning answer — a skeptic that checks the winner, not a rubber stamp."

Say:

"That cross-vendor check is the whole thesis: independent answers, then independent verification, with the uncertainty kept visible instead of smoothed into one overconfident reply."

## 3:15-3:55 - Reproducible Offline (no keys)

Run:

```bash
npm run demo:fixture
```

Show the four agents, 12 verified claims, average confidence, and `sample_outputs/latest_fixture_report.json` / `.md`.

Say:

"Live mode needs your own provider keys — but the architecture is fully reproducible with none. Fixture mode is deterministic and offline, so a reviewer can re-run this and get identical verification content. That's the path in the public repo."

## 3:55-4:35 - Security, Evaluation, Audit Trail

Show `SECURITY_AND_PRIVACY.md`, `COURSE_CONCEPTS.md`, and the report audit trail.

"Secret hygiene throughout: the live agent uses your own keys via a gitignored `.env` — examples use placeholders — input redaction catches common sensitive patterns, and a tool allowlist keeps it bounded. And anyone can reproduce the whole pipeline with no keys at all. The JSON report is a trajectory-style audit trail: agent answers, critiques, verified claims, confidence, and final synthesis. I also ran ten hard questions through the pipeline — all produced an auditable answer, a prompt-injection attempt was resisted, and the evaluation surfaced honest weaknesses instead of hiding them."

## 4:35-4:50 - The Build (vibe coding, all the way down)

Show a quick still of the Claude Code terminal / repo, then a beat of the Miracle edit-decision JSON.

"The build itself was vibe-coded: natural language was the primary programming interface, with an AI coding agent doing the implementation and me directing. I even dogfooded the course — an LLM pipeline transcribed all five course days, turned them into a rubric, and audited this capstone against it. And this video? Produced the same way: a companion agent analyzed the raw screen recording, proposed a timestamped edit plan, rendered it with FFmpeg, and critiqued its own cuts — the same analyze, plan, verify, audit-trail discipline as The Council itself."

## 4:50-5:00 - Impact, Limitations, Close

"The Council is useful when a wrong answer is costly: research, policy, security, or strategy. Fixture mode proves the workflow shape, not live model quality, and the MCP piece is an honest stub. The takeaway: reliable agentic systems aren't about adding agents — they're about separating roles, preserving disagreement, checking claims across vendors, and making the final answer auditable."
