# Kaggle Submission Checklist

- [x] Live agent (the demo) runs via `launch.bat live`: four models stream, peer evaluation + consensus, cross-vendor verification swarm.
- [x] Reproducible no-key offline mode works (`npm run demo:fixture`) as the keyless/CI fallback.
- [x] Tests pass.
- [x] Secret scan passes.
- [x] MCP stub self-test passes.
- [x] Kaggle writeup is under 2,500 words (~2,215), states Track: Freestyle, and frames live UI as the demo with fixture as the no-key reproducible path.
- [x] Video script + shot list under 5 minutes; centerpiece is the live shadcn UI, with the no-key fixture demo as the reproducible path.
- [x] Screenshot helper pages exist.
- [x] README includes no-key quickstart.
- [x] Fixture mode is clearly labeled simulated/offline.
- [x] Weighted car-wash scenario works.
- [x] Counterfactual guardrail scenarios are covered by smoke tests.
- [x] MCP stub is described as a stub, not a production SDK server.
- [x] Public GitHub link filled into assets: `https://github.com/thisisntjon/thecouncil` (repo must still be made PUBLIC — see below).
- [x] npm audit clean (0 vulnerabilities, root); verify:capstone green; UI-QA gate PASS (WCAG AA).
- [x] Public-doc integrity verified (2026-06-27): no "ADK"/"Antigravity" overclaims in tracked docs; MCP labeled a stub; deployability framed as reproducible demo.
- [~] Human license comfort still needed.
- [~] Repo visibility/access remains a human decision. Private repo is for staging only; final Kaggle submission should use a public repo or an access method confirmed by Kaggle.
- [~] Capture final screenshots/GIF from `screenshots/` and/or `launch.bat ui`.
- [ ] Add YouTube/video URL.
- [ ] Paste final writeup into Kaggle.
- [ ] Submit Kaggle entry.

## Suggested Kaggle Assets

- Live agent walkthrough (the centerpiece): `launch.bat live`, captured in the video
- Cover image from `screenshots/cover.html`
- Architecture image from `screenshots/architecture.html`
- Demo summary image from `screenshots/demo-output.html`
- Public GitHub repository link: `https://github.com/thisisntjon/thecouncil`
- YouTube/video demo link
