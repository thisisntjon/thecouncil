# Screenshots

This folder contains public-safe local HTML pages for screenshots or video b-roll:

- `cover.html`
- `architecture.html`
- `demo-output.html`

Open them directly in a browser and capture images for Kaggle, GitHub, or the video. They contain only simulated fixture content and relative paths.

For the interactive public UI, run:

```bat
launch.bat ui
```

Capture `http://127.0.0.1:4173` when you want to show scenario selection, Council roles, verified claims, decision scores, caveats, and audit export paths. Avoid the optional `ui-live` provider interface for public submission screenshots unless live keys/costs/outputs have been separately reviewed.

Do not include:

- API keys
- `.env` values
- private desktop windows
- customer/work/employer data
- private messages, resumes, legal files, or screenshots from unrelated projects

Recommended final screenshots (hero first):

1. **Browser fixture UI at `http://127.0.0.1:4173`** (run `npm run ui:fixture`): the interactive dashboard with Council roles, scored peer critiques, color-coded claim verdicts, confidence bars, decision scores, and synthesis. This is the strongest single visual — make it the headline image.
2. `cover.html`: title, one-sentence pitch, and Council pipeline.
3. `architecture.html`: user question, redaction/risk check, four agents, peer critique, hidden verification, confidence, and audit export.
4. `demo-output.html`: static fixture report card with metrics, verified-claim verdict badges, a peer-critique snippet, synthesis excerpt, and relative report paths.

Optional additional screenshot: terminal output from `npm run demo:fixture`, cropped so only the command result and relative project content are visible.
