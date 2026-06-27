# UI Overhaul Brief — "The Council" (for the Cursor agent)

> **You are an expert React + Tailwind + shadcn/ui designer-engineer.** Your job is to take this
> working app's web UI from ~30/100 to ~100/100 design quality for a **Google/Kaggle hackathon
> judging panel**, WITHOUT breaking any of the live functionality. Read this whole brief, then read
> the referenced repo files, then execute. Work in small, verifiable steps; build after each.

---

## 0. How to use this brief

1. **Read these repo files first** (full context — do not skip):
   - `CLAUDE.md` (project guide + conventions), `ARCHITECTURE.md`, `CAPSTONE.md`, `DEMO_GUIDE.md`
   - **Course alignment / what judges reward**: `COURSE_CONCEPTS_SUMMARY.md`, `COURSE_CONCEPTS.md`,
     `COURSE_ALIGNMENT.md`, `_private_course_alignment/COURSE_ALIGNMENT_FINAL_REPORT.md`,
     `_private_course_alignment/THE_COUNCIL_ALIGNMENT_MATRIX.md`
   - **Judge lens / scoring**: `JUDGE_SCORECARD.md`, `JUDGE_REPORT.md`, `KAGGLE_WRITEUP_DRAFT.md`
   - **Our research / discoveries**: everything under `workflow/research/` (esp. `judge-SYNTHESIS.md`,
     `align-judging-and-wow.md`, `course-ux-audit.md`, `codebase-reality.md`)
   - **The code you'll change**: `client/src/App.jsx` (one ~3,700-line component + a giant
     `const styles` template literal), `client/index.html`, `server/index.js`,
     `shadow-council/index.js`
2. Then implement Sections 5–9 under the Hard Constraints (Section 10).
3. Verify against Section 12 after every milestone.

---

## 1. What this project is

**The Council: a multi-agent verification swarm.** Instead of trusting one AI's unchecked answer,
four different frontier models answer independently, peer-review each other, a **cross-vendor
verification swarm** checks their claims, and a synthesis preserves confidence + unresolved claims +
an audit trail. There are two modes:

- **Live mode (the demo we're polishing):** `server/` (Express, port **3001**) orchestrates real
  provider calls; `client/` (React 19 + Vite, port **5173**) is the UI; `shadow-council/` (Express,
  port **3002**) is the independent cross-vendor verifier. Vite proxies `/api` → `:3001`.
- **Fixture mode (offline, no keys):** `lib/fixtureCouncil.mjs` + `demo_fixture.mjs` +
  `scripts/fixture_ui_server.mjs`. **Must keep working** (it's the no-key reproducibility path and
  the test suite depends on it).

**The live flow (preserve this exactly):**
`Round 1` — 4 models answer independently (web-search enabled) → user clicks **"Convene The
Council"** → `Round 2` — each model peer-evaluates + votes → **Consensus** score → `Round 3` —
**Verification Swarm** (cross-vendor, runs in parallel) → **Verdict** ("The Council Has Decided")
→ Next question. A 3-question "game" wraps it with a scoreboard + history.

## 2. Hackathon context + the judging lens (DESIGN MANDATE)

This is a **Kaggle / Google capstone hackathon**. The judging panel is **AI practitioners and
developer-relations people** — e.g. Google DevRel, **Google DeepMind research scientists**, Kaggle
AI/ML specialists, and EPAM program managers (names: Tanvi Singhal, Laxmi Harikumar, Aman Tayal,
Vijit Singh, Nilay Chauhan, Thilakraj Sripal, Naz Bayrak, Luis Sala, Martyna Plomecka, Tania
Rodriguez Fuentes, Sara Wolley, Brenda Flynn).

**For this audience, credibility beats spectacle.** The aesthetic mandate is **clean, modern,
"premium research/dev-tool"** — think Linear / Vercel / shadcn.com / Google AI Studio — NOT neon,
NOT cyberpunk, NOT "game show." The "wow" must come from the *substance* rendered cleanly: four
real frontier models streaming live, a cross-vendor verification swarm running in parallel,
confidence/verdict visualization, and transparent token/cost accounting.

**The current UI fails this.** It uses a cyberpunk theme (Orbitron font, neon glows, scanlines,
"arena/battle" framing). A prior pass swapped palette variables but kept the cyberpunk *structure*,
so it still reads dated and "bland." **You are doing a real design-system rebuild, not a repaint.**

## 3. Key discoveries (so you don't repeat our mistakes)

- **Models are CURRENT and VALIDATED — do not "fix" them.** The repo contains a stale
  "pricing-research" note claiming `gpt-5.2`, `grok-4.3`, etc. are "fictitious." **That research is
  wrong.** We validated every model ID **live against the provider APIs** on 2026-06-27. The live
  API is the source of truth, not web-search. The council's current **default (balanced-value)**
  models, with **real** pricing ($/1M tokens), are:
  | role | model | input | output |
  |---|---|---|---|
  | Claude | `claude-haiku-4-5` | $1.00 | $5.00 |
  | GPT | `gpt-5.4-mini` | $0.75 | $4.50 |
  | Gemini | `gemini-3.5-flash` | $1.50 | $9.00 |
  | Grok | `grok-4.3` | $1.00 | $2.00 |
  Premium/flagship options exist in `MODEL_OPTIONS` (Sonnet 4.6, GPT-5.5, Opus 4.8, etc.) and are
  user-selectable. **Keep all of this; do not change model IDs or prices.**
- **Already fixed (preserve):** newest-first history ordering; verification renders **inline** (we
  removed a focus-stealing `window.open` popup); a caption clarifies the "Convene" step; the value
  models are synced across `server/`, `client/`, `shadow-council/`.
- **Known UX wart to fix:** Round-1 answers are **not streamed** — a slow model (Gemini took 140s)
  shows a frozen spinner. We want **token streaming + chain-of-thought streaming** (Section 8).
- **Local auth:** the server trusts loopback, so no token is needed when running locally.

## 4. The stack (don't fight it)

- React **19** + Vite **6**, ESM only. Single component in `client/src/App.jsx`. Styling today is a
  ~1,400-line `const styles` template literal injected via `<style>`.
- **Adopt Tailwind CSS + shadcn/ui** (the credible, AI-native design system the judges will
  recognize). Vite + React 19 is fully supported. Use the **"new-york"** shadcn style.
- Keep `react-markdown` for answer rendering. Add **framer-motion** for *subtle* motion only.

## 5. The job — a clean design-system rebuild

**Replace the bespoke cyberpunk CSS with a real design system.** Concretely:

1. Install + configure **Tailwind** and **shadcn/ui** in `client/`. Bring in primitives:
   `Card`, `Badge`, `Button`, `Progress`, `Tabs`, `Separator`, `Skeleton`, `ScrollArea`,
   `Tooltip`, `Collapsible`, `Avatar`.
2. **Delete** the cyberpunk `const styles` block and all neon/scanline/glow/Orbitron remnants.
   Restyle every section on Tailwind + shadcn. Remove "arena/battle/game-show" framing language in
   favor of calm, precise section labels.
3. Rebuild the layout with **strong typographic hierarchy, generous whitespace, and a real spacing
   scale**. The page should look like a premium product, legible at a glance, screenshot-ready.

## 6. Design system (use these tokens — paste into every styling decision)

Define as CSS variables (shadcn HSL convention) + Tailwind theme. **Default to a clean theme; ship a
light/dark toggle if cheap.** Recommended palette (neutral + one accent):

- **Neutrals:** zinc/slate ramp. (shadcn defaults are fine: `background`, `card`, `muted`,
  `muted-foreground`, `border`, `foreground`.)
- **Accent (brand):** a single restrained indigo/blue (e.g. `--primary: 239 84% 60%`). One accent
  only — no rainbow.
- **Per-model accents (chips/dots ONLY, never glows):** Claude amber `#D97706`, GPT emerald
  `#10B981`, Gemini blue `#3B82F6`, Grok rose `#EF4444`. Mute them; use as small identity chips.
- **Verdict semantics:** supported = emerald, partially_supported = amber, refuted = rose,
  unverifiable/unknown = zinc. Use shadcn `Badge` variants + a `Progress` for confidence.
- **Type:** `Inter` (UI) + `JetBrains Mono` (numbers, latencies, token counts, model IDs). Real
  scale: 12 / 14 / 16 / 20 / 28 / 36px; headings `tracking-tight`, weight 600–800.
- **Radius:** `--radius: 0.625rem` (lg cards), md for inputs. **Shadows:** subtle (`shadow-sm/md`).
  **No glows, no text-shadow, no scanlines, no shimmer.**
- **Motion:** framer-motion, ≤200ms, ease-out; fade/slide-in for streamed items. Tasteful, not flashy.

## 7. Screen / component requirements

Rebuild these (keep the data + handlers; restyle + restructure):

- **Header:** product name "The Council" + tagline "Independent answers, cross-verified" + a small
  **mode badge** (`live` vs `fixture`) and a compact provider legend. No giant uppercase title.
- **Question input:** shadcn `Textarea` + primary `Button` ("Ask the Council"); model toggles as
  clean chips; Cmd/Ctrl+Enter to submit.
- **Round 1 — Independent Answers:** a responsive grid of **answer cards**. Each card: a **provider
  chip** (model dot + name + model id + provider), latency in mono, **streaming answer text** with a
  `Skeleton` while waiting, and a **collapsible "Reasoning" (chain-of-thought)** region that fills as
  it streams then auto-collapses. Status states: waiting / streaming / done / error.
- **Convene CTA:** prominent primary button with a one-line helper ("Round 1 complete — convene to
  peer-evaluate, pick a winner, and run the verification swarm"). This is the clear next step.
- **Round 2 — Peer Evaluation:** judge cards (who-judges-whom), numeric scores as clean stats,
  strengths/weaknesses as small chips, "stands by / would revise" as a `Badge`.
- **Consensus:** one clean number + label + a `Progress`/gauge. No neon.
- **Round 3 — Verification Swarm (PARALLEL):** a section with a `⟳ running in parallel` badge that
  streams **claim-by-claim** rows: claim text, a **verdict `Badge`**, a **confidence `Progress`**,
  and a **"verified by {vendor}"** tag (cross-vendor). Ends with a **verified synthesis** card +
  citations. See Section 9 for wiring.
- **Verdict ("The Council Has Decided"):** the winning model + its answer in a hero `Card`.
- **Cost/usage strip:** a tidy, muted stat bar (API calls · tokens · est. $ · per-question $) in mono.
- **History (newest-first) + 3-question scoreboard:** clean list/table, current question pinned top.

## 8. Streaming — answers + chain-of-thought (server + client)

Today `POST /api/ask` (in `server/index.js`) runs each model to completion and emits one SSE
`{type:'answer', result}` per model, then `{type:'complete', shadow, sessionUsage}`. Upgrade to
**token streaming**, where each SDK supports it:

- **Server:** convert the Round-1 *search-enabled* callers (`callClaudeWithSearch`,
  `callGPTWithSearch`, `callGeminiWithSearch`, `callGrokWithSearch`) to streaming and emit, tagged by
  modelId so concurrent streams interleave safely on one SSE response:
  - `{type:'answer_delta', modelId, text}` · `{type:'thinking_delta', modelId, text}` ·
    `{type:'answer_done', modelId, result}`
  - **Keep emitting the final `{type:'answer', result}` and `{type:'complete', ...}`** so the
    headless harness (`scripts/live_feedback_loop.mjs`) and tests keep working.
  - Claude: `anthropic.messages.stream({ thinking:{type:'adaptive', display:'summarized'},
    tools:[web_search] })` → forward text + thinking deltas. OpenAI (`gpt-5.4-mini` /
    `gpt-5-search-api`): `stream:true`. Gemini (`gemini-3.5-flash` + googleSearch):
    `generateContentStream`. Grok (`grok-4.3`): chat-completions `stream:true`; the `/v1/responses`
    search path may not stream — **fall back to non-stream there** ("where possible").
- **Client (`handleAsk` + the answer card):** consume deltas into per-model answer/thinking buffers;
  render answer text token-by-token; show the live collapsible "Reasoning" stream. This eliminates
  the frozen-spinner problem.

## 9. Native parallel verification (replace the iframe)

Today the verification swarm is shown via an **`<iframe src="http://localhost:3002">`** (the shadow
dashboard). Replace it with **native rendering**:

- Open an `EventSource('http://localhost:3002/api/stream')` (the shadow server already sets
  permissive CORS for the `:5173` dev origin) when verification starts (right after Round 1).
- Render the streamed events natively with shadcn components (don't keep the iframe). Event types
  emitted by `shadow-council/index.js`: `claims`, `cross_reference`, `verification_progress`,
  `verification`, `disagreement_resolution`, `confidence_scores`, `synthesis`, `swarm_diversity`,
  `complete`. Each verification carries the verdict + confidence + the cross-vendor `verifiedBy`.
- Present it **stacked in pipeline order** with the `running in parallel · no action needed` badge so
  it doesn't compete with the Convene CTA. Keep a small "pop out ↗" link to the full dashboard.

## 10. HARD CONSTRAINTS (do not violate)

- **Do NOT break live functionality.** Preserve every server endpoint and its SSE contract
  (`/api/ask`, `/api/evaluate`, `/api/vote`, `/api/verify`, `/api/health`, `/api/usage`), the state
  machine, and the Round 1→Convene→Round 2→Round 3→Verdict flow.
- **Do NOT change model IDs or prices** (Section 3) and do not act on the stale "models are
  fictitious" research. Keep `MODELS` / `MODEL_OPTIONS` (server), `MODEL_CONFIG` (client),
  `SHADOW_PROVIDERS` (shadow) in sync.
- **Keep fixture mode + tests green:** `npm test` and `npm run lint` (from repo root) must pass; do
  not touch `lib/fixtureCouncil.mjs`, `demo_fixture.mjs`, or the fixtures except as needed.
- **Preserve the prior fixes:** newest-first history, inline (non-popup) verification, the Convene
  caption.
- **Security/secrets:** never commit `.env` (it's git-ignored and holds real keys); never print
  secret values; `runs/`, `logs/`, `generated-runs/` stay git-ignored. Don't commit unless asked.
- **ESM only, Node 18+.** Don't introduce a build step the project doesn't already have besides
  Tailwind/PostCSS (which Vite supports).

## 11. File map

- `client/src/App.jsx` — the entire UI (one big `MainApp` + sub-components: `WaitingCard`,
  `AnswerCard`, `EvaluationCard`, `VerificationProgress`, `ClaimModelGroup`, `ConfidenceScores`,
  `SynthesisCard`, `ShadowWindow`), `MODEL_CONFIG`, `handleAsk`/`handleEvaluate`, the `const styles`
  block. **This is where most of your work happens.**
- `client/index.html` — fonts + title. `client/vite.config.js` — `/api` → `:3001` proxy.
- `server/index.js` — orchestration, `MODELS`/`MODEL_OPTIONS`, the `callX`/`callXWithSearch`
  functions, all `/api/*` routes (SSE).
- `shadow-council/index.js` — cross-vendor verifier; `SHADOW_PROVIDERS`, `/api/verify`, `/api/stream`.
- `lib/fixtureCouncil.mjs` — offline engine (don't break). `tests/` — smoke tests run by `npm test`.

## 12. Acceptance criteria (verify after each milestone)

1. **Visual:** the UI reads as a clean, premium research/dev tool (Linear/Vercel/shadcn-grade) — no
   neon, no Orbitron, no scanlines, real type scale + spacing. Screenshot-ready for judges.
2. **Functional (live):** `cd server && npm start`, `cd shadow-council && npm start`,
   `cd client && npm run dev`; open `http://localhost:5173`, ask a question →
   answers **stream token-by-token** with live reasoning → Convene → Round 2 + consensus →
   verification **streams natively in parallel** with verdict badges + confidence → final verdict.
   No console errors.
3. **Backend intact:** `npm run live:feedback -- --sample` (from repo root, server running) still
   completes; `/api/health` shows the 4 value models.
4. **Offline + CI:** `npm test` and `npm run lint` pass; fixture demo (`npm run demo:fixture`) works.
5. **No regressions:** newest-first history, no popup, Convene caption, correct model IDs/prices.

## 13. Suggested execution order

1. Read Section 0 files. 2. Add Tailwind + shadcn/ui; set up the design tokens (Section 6).
3. Rebuild the **shell + header + question input + Round-1 answer cards** first (biggest visual win);
   build + eyeball. 4. Add **streaming** (Section 8). 5. Rebuild **Round 2 + consensus + verdict +
   cost strip + history**. 6. **Native parallel verification** (Section 9), drop the iframe.
7. Motion + responsive + a11y polish. 8. Run Section 12 acceptance; iterate.

> Build in small steps, run `npm run build` (in `client/`) frequently, and keep the live app working
> at every step. Quality bar: a Google/DeepMind/Kaggle judge should think "this is a credible,
> well-built product," not "this is a flashy demo."
