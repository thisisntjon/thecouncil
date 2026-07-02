# Real Live Run — 2026-06-30 (Writeup Evidence)

**These are REAL live-run artifacts, not fixtures.** Captured 2026-06-30 by driving the
full live pipeline (four vendors + cross-vendor verification swarm) headlessly on three
hard questions for the Kaggle writeup's "A Real Run" section. Web search was **off**, so
verification is models cross-checking each other, not external lookups. All strings were
passed through `lib/security.mjs` redaction before publishing; no keys, PII, or private
data are present.

This is the curated exception to the "live outputs stay local" policy — published
deliberately as evidence backing the writeup's claims, so a reviewer can open the actual
audit trail instead of taking our word for it.

## What to look at

- **`q1_physics_photon_vs_electron.json`** — the hero catch. All four models got the
  final answer right, but the swarm still refuted `gpt-7` (the claim that the electron's
  kinetic energy ≈ the photon's ~1.24 keV; it is actually ~1.5 eV) at **0.99 confidence**,
  and caught a `gemini-8` arithmetic slip (1240/1.50 = 826.67, not 824) at 0.95.
  Peer review had scored GPT 92–98 — claim-level cross-vendor verification caught what
  holistic peer scoring missed. Per-claim scores: Claude 100 · Grok 93.8 · Gemini 87.5 ·
  GPT 81.3.
- **`q2_jwst_multiclaim_facts.json`** — multi-fact calibration: three perfect scores,
  zero hallucinations, minor omissions still flagged.
- **`q3_logic_puzzle_deduction.json`** — the honest failure mode, preserved on purpose:
  all four models solved the puzzle correctly, but verifiers re-checking deductive steps
  in isolation (without the clues in context) under-trusted correct reasoning — scores
  35.7–71.4 with 12 refutals. The system **surfaced** that low confidence rather than
  hiding it; this run motivated the reasoning-vs-evidence routing in `lib/claims.mjs`.

## Shape

Each file: `question` → `round1_answers` (per-model, with latency) →
`round2_evaluations` (peer review) → `round3_verification` (claims, per-claim verdicts
with confidence, per-model scores, synthesis).
