# Scope

The Council is a **live multi-agent verification swarm**: four frontier models (Claude, GPT, Gemini, Grok)
answer independently, peer-critique each other, and a cross-vendor swarm re-checks every claim against a
*different* vendor, with a full audit trail. **That live agent is the demo and the project.**

## Modes

- **Live (the demo):** real provider calls via `server/` + `client/` + `shadow-council/`. Start with
  `launch.bat live` (Windows) or the cross-platform npm steps in `README.md` / `docs/deploy.md`. Needs your
  own provider keys in a gitignored `.env`.
- **Offline reproducibility / CI:** a deterministic no-key replay (`lib/fixtureCouncil.mjs`) that runs the
  same pipeline with no keys or network. It powers `npm test` and lets a keyless reviewer run it. Its
  evidence is clearly labeled simulated — a test/reproducibility harness, not the headline, and never
  presented as live results.

## Hosting

We deliberately do not host the live app on a public no-login endpoint: it runs on private provider keys,
and the competition's public project link must be no-login/no-paywall, so a hosted endpoint would be an
uncapped spend surface. Per the rubric, deployment to a public endpoint is not required — the live agent is
shown in the video, a reproducible deploy path is in `docs/deploy.md`, and the public repo + setup
instructions are the project link.

## Invariants

- Never commit secrets or live run outputs; `.env`, `runs/`, `logs/`, `generated-runs/` stay gitignored
  (the `secret:scan` pre-commit hook enforces it). One curated exception: the redacted three-question
  audit-trail pack in `sample_outputs/live_runs/`, published deliberately as writeup evidence.
- No private/customer/employer/personal data; no copied course content in the public repo.
- Keep the offline engine deterministic (tests assert exact strings).
