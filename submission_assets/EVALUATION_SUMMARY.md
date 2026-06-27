# Evaluation Summary

Project: The Council: Multi-Agent Verification Swarm

Track: Freestyle

Short pitch: A public-safe snapshot of a live end-to-end evaluation of The Council, demonstrating that the pipeline is auditable and that its self-assessment is honest about its own weaknesses.

## Observed in the live pipeline

- **10/10 questions** ran through the full pipeline and produced an auditable final answer — **no crashes**, no silent failures.
- **Every final answer was correct or well-reasoned by post-run review**, including a trick question and a multi-step math trap.
- **A prompt-injection attempt was resisted** — the Council answered the real question and flagged the injected "override" as untrusted data (see `EVALUATION_SAMPLE.md`).
- **A real bug was caught and fixed live:** logic/math answers that previously scored 0 verification confidence now score normally (the reasoning-mode fix).
- **The evaluation reported its own weaknesses** (below) instead of hiding them — confidence under-reports correct reasoning, and the models verify with different strictness.

> ⚠️ **Methodology & caveat:** Web search was **OFF** for this run, so factual claims used the conservative knowledge fallback; figures are **indicative (n = 10)**, not benchmark-grade. The detailed companion report (`../docs/process/COUNCIL_EVALUATION_REPORT.md`) contains verbatim model answers whose inline citations/URLs are **model-generated, not verified sources**. This summary is the public-safe overview; no full model responses are reproduced here.

## What was tested

Ten difficult, diverse questions were run through the **full pipeline** (independent answers → peer evaluation → hidden verification swarm → synthesis), spanning these categories:

1. Current factuality + staleness/calibration
2. Multi-step math (classic trap)
3. Fresh symbolic constraint reasoning
4. Ambiguous practical intent / tradeoffs
5. Ethical dilemma (no single right answer)
6. Prompt injection / instruction–data separation
7. Physics misconception
8. Trick / trivialized puzzle
9. Fermi estimation
10. Model self-knowledge + calibration

## Headline results

- **10/10 questions synthesized** a final answer; **no crashes**, no silent failures.
- **All 10 final answers were correct or well-reasoned by post-run review**, including the trick and trap questions.
- **Prompt injection resisted** — the model answered the real question and flagged the injected "override" as untrusted data.
- **Reasoning-mode fix verified live** — logic/math answers that previously scored 0 confidence now score normally.

## Honest findings (areas to improve)

- **Confidence under-calibration:** reasoning/meta/security questions produced *correct* answers but *low* verification confidence (e.g., logic ~39, injection ~46) — the system under-trusts correct non-empirical reasoning.
- **Verifier strictness differs by model:** as verifiers, GPT discriminates (uses the full verdict range incl. "refuted"), Claude is over-cautious (rarely refutes), and Gemini is lenient (marks most claims "supported"). A claim's verdict depends partly on which verifier draws it.

## Indicative scores (1–100)

Council members (answerers):

| Member | Score |
|---|---|
| Claude | 86 |
| GPT | 84 |
| Gemini | 83 |

Swarm members (verifiers):

| Member | Score |
|---|---|
| GPT | 85 |
| Claude | 78 |
| Gemini | 72 |

_Scores blend the system's own peer ratings, verification confidence, reliability, and a correctness read. See the companion report for methodology and per-question detail._

## Takeaway

The Council is functionally healthy — correct, secure, and auditable — and it surfaces its own calibration weaknesses rather than hiding them. The top follow-up is **verifier calibration** (tracked in `CAPSTONE.md` → Future Work).
