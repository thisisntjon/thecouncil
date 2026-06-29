# Media Asset Guide

The **video centerpiece is the live agent** (`launch.bat live`): four models streaming, peer evaluation, and the cross-vendor verification swarm. You record your own live run, so live output is fine in the video **as long as** no keys, billing, private tabs, or private data are on screen (see "Do Not Show").

For **committed/static image assets** (Kaggle cover, GitHub stills) use only the public-safe screenshot helper pages — don't commit raw live-run output as a static asset.

## Screenshot Helper Pages

- `screenshots/cover.html`: title, pitch, track, and pipeline summary.
- `screenshots/architecture.html`: full workflow diagram.
- `screenshots/demo-output.html`: fixture report summary with relative output paths.

## Capture Guidance

- Open each HTML file locally in a browser.
- Capture these three images first: cover, architecture, demo output.
- Use a clean browser window with no visible private tabs, account names, bookmarks, or desktop background.
- Capture PNG screenshots or a short GIF.
- Prefer relative paths in the visible frame, such as `sample_outputs/latest_fixture_report.md`.
- For the video, lead with the **live agent**: ask a real question, show the four models streaming, "Convene the Council" for peer evaluation + consensus, then the cross-vendor verification swarm reaching a verdict. Optionally close with `npm run demo:fixture` as the no-key reproducibility path. Keep the story on The Council: uncertainty, agents, critique, cross-vendor verification, audit trail.

## Do Not Show

- API keys or `.env` values.
- Provider dashboards or billing pages.
- Private browser tabs, email, chats, account names, or local file paths.
- Live provider run outputs committed as static assets (a reviewed live run in the recorded video is fine).
- Work, customer, employer, legal, health, or private personal data.
- Raw course notes, transcript material, or the private course-alignment folder.
