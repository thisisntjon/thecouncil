# Scope Freeze

Original: 2026-06-26 · **Course-corrected: 2026-06-29**

> **Course correction (2026-06-29).** The 2026-06-26 freeze made the *offline fixture* the "official public
> demo" and barred live provider calls from it. Re-checking the actual course (Days 1–5) and the competition
> rubric, that was a **self-imposed misalignment**: the course expects a **real, live, evaluated agent**
> ("prompt to production", real API/MCP calls, runtime/trajectory evaluation), and an offline replay is the
> exact **"fragile success trap"** Day 4 warns about. The original rationale was operational safety only
> (no key exposure) and never weighed this. Corrected stance: **the live multi-agent system is the demo;
> the fixture is the no-key reproducibility / CI harness, not the project's identity.** The *secret-hygiene*
> rules below were always correct and still hold.

The Council remains the capstone.

## Still in force
- **Never commit secrets or live outputs.** `.env`, `runs/`, `logs/`, `generated-runs/` stay gitignored;
  the `secret:scan` pre-commit hook enforces it. (This is the legitimate half of the original decision.)
- No raw transcripts, downloaded videos, full captions, or copied course content in the public repo.
- The Council remains the project (no course-companion pivot).

## Corrected (these rules from the 2026-06-26 freeze were wrong)
- ~~"No live API dependency / no real provider calls in the official demo."~~ → **The live agent is the
  headline demo.** Fixture is the documented no-key reproducibility + CI fallback (it powers `npm test`).
- ~~"Fixture/offline/no-key mode remains the official public path."~~ → It's the *fallback*, not the headline.
- ~~"No UI rewrite."~~ → The React client was rebuilt (Tailwind + shadcn/ui) into the live hero and QA-gated
  to WCAG AA. This is the real agent the course asks for.

## Still requires explicit approval
- Public hosting of the live app on our keys (cost/abuse on a no-login endpoint) — decided **against**:
  the rubric doesn't require deployment and we already clear ≥3 concepts. Deployability is shown via the
  video + a documented reproducible deploy path + the public repo with setup.
- Any change that alters core behavior or the submission story beyond this course-correction.
