# Video Script

Target length: 5 minutes or less. Estimated read time: about 3 to 3.5 minutes.

## 0:00-0:20 - Problem and Hook

"A single AI answer can sound confident even when it is incomplete. The Council asks a simple question: what if an answer had to survive independent agents, peer critique, and claim-level verification before becoming final?"

## 0:20-0:50 - What The Council Is

"The Council is a multi-agent verification swarm. Four visible agents answer independently. They critique each other. Then a hidden verification swarm extracts claims, checks evidence, and produces an auditable final response."

Show `screenshots/cover.html`.

## 0:50-1:25 - Architecture

Show `screenshots/architecture.html` or `ARCHITECTURE.md`.

"The stages are input redaction, four independent answers, peer critique, hidden claim verification, confidence summary, final synthesis, and audit export. The capstone demo uses offline fixture mode, so no API keys, paid calls, or live provider accounts are required."

"The important course idea here is that this is not just a chatbot. The model-like answer is surrounded by a harness: redaction, role separation, tool boundaries, verification, and export."

## 1:25-3:05 - Fixture Demo

Run:

```bash
npm run demo:fixture
```

Show:

- the demo question
- four agents
- 12 verified claims
- average confidence
- `sample_outputs/latest_fixture_report.json`
- `sample_outputs/latest_fixture_report.md`

Say:

"This fixture is simulated, but the workflow is the point. It shows how disagreement, confidence, and unresolved claims can stay visible instead of being smoothed into one overconfident answer."

## 3:05-4:10 - Security, Evaluation, Audit Trail

Show `SECURITY_AND_PRIVACY.md`, `COURSE_CONCEPTS.md`, `screenshots/demo-output.html`, and the report audit trail.

"The default path is no-key. `.env` files are ignored, examples use placeholders, input redaction catches common sensitive patterns, and the fixture tool allowlist keeps the demo bounded. The JSON report gives reviewers a trajectory-style audit trail: agent answers, critiques, verified claims, confidence, and final synthesis. The Markdown report is the human-readable review layer."

## 4:10-4:45 - Impact, Limitations, Next Steps

"The Council is useful when a wrong answer is costly: research, policy, security, or strategy. The current capstone uses fixtures for reproducibility, so it should not be presented as live model quality. Next steps are an official MCP SDK server, richer evidence sets, and a one-click fixture UI."

## 4:45-5:00 - Close

"The main takeaway is that reliable agentic systems are not just about adding agents. They are about separating roles, preserving disagreement, checking claims, and making the final answer auditable."
