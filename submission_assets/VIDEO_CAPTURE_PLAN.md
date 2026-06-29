# Video Capture Plan — shot checklist

A filming checklist for the ≤5-minute Kaggle demo video. The **hero is ~2 minutes of the live agent
working**; everything else is short. Capture at **1080p**. Don't worry about model "thinking" gaps — trim
them in the edit. Each shot pairs with a narration block in `VIDEO_NARRATION_TTS.md` (for the AI voiceover).

## Before you record
- Start the live stack: `launch.bat live` (or confirm `http://localhost:5173` is up).
- Recorder at **1080p**, capturing the Chrome window.
- Demo question (a logic trap that demos cleanly):
  > I want to wash my car. The car wash is 50 meters away. Should I walk or drive?

---

## Group 1 — The live agent (the hero) · screen-record at localhost:5173

- [ ] **Shot 1 — Setup** (~5s): the "Configure your session" screen — question tiles + the four model chips. *(narration: Block 2)*
- [ ] **Shot 2 — Ask + Round 1** (~20s): type the question, click **Ask the Council**, let all four models stream. Hover one card so the model name + latency read clearly. *(Block 4a)*
- [ ] **Shot 3 — Convene + consensus** (~12s): click **Convene the Council** → Round 2 judge cards + the **consensus score**. *(Block 4b)*
- [ ] **Shot 4 — Cross-vendor verification (the money shot)** (~25s): scroll the **Round 3 verification swarm** — the "running in parallel" badge, verdict chips (Supported / Refuted), confidence bars, and the **"verified by {vendor}"** tags. Pause on a claim where the verifier is a *different* vendor than the author. *(Block 4c)*
- [ ] **Shot 5 — Verdict** (~6s): the **"The Council has decided"** card. *(Block 4d)*

> Tip: do 2–3 full takes and pick the cleanest. The models often **split** on the answer — a take where they
> disagree and the cross-vendor verification resolves it is the strongest story.

## Group 2 — No-key reproducibility · terminal

- [ ] **Shot 6 — `npm run demo:fixture`** (~10s): run it; show the dashboard + "reports written to `sample_outputs/`". This is the "anyone can reproduce it with no keys" beat. *(Block 5)*

## Group 3 — Stills (screenshots; also reused as Kaggle assets)

- [ ] **Shot 7 — Cover:** open `screenshots/cover.html` full-screen, screenshot it. *(Block 1 — also your Kaggle cover image)*
- [ ] **Shot 8 — Architecture:** `screenshots/architecture.html` screenshot. *(Block 3)*
- [ ] **Shot 9 — Audit report:** `screenshots/demo-output.html` (or `sample_outputs/latest_fixture_report.md`). *(Block 6)*

## Group 4 — Optional B-roll (only if time)

- [ ] **Shot 10 — One-command launch** (~6s): `launch.bat live` starting the three services. *(Block 3)*
- [ ] **Shot 11 — Security** (~6s): `npm run secret:scan` passing, or `lib/security.mjs` on screen. *(Block 6)*
- [ ] **Shot 12 — Audit JSON** (~6s): slowly scroll `sample_outputs/latest_fixture_report.json`. *(Block 6)*

---

**Minimum viable set: Shots 1–7** (the live flow + the fixture terminal + the cover). Everything else is gravy.

## Edit order
1. Lay the **Group 1** live walkthrough as the spine; trim the API wait gaps.
2. Drop in **Shot 6** (reproducibility) and the **Group 3 stills** at their narration beats.
3. Generate the 8 voiceover clips from `VIDEO_NARRATION_TTS.md` (videowatcher ElevenLabs or any TTS) and lay them over the matching shots.
4. Export ≤5 min, 1080p, H.264 → upload to YouTube → paste the link into the Kaggle submission.
