# Public Release Review

Review date: 2026-06-25

## Status

Safe to publish: conditional.

The code/docs are prepared for a private GitHub capstone release after final human review of the license and after the user captures public-safe screenshots/GIFs from the helper pages. Kaggle submission still needs the final YouTube/video link and a decision about reviewer access to the private repository.

Private project URL: `https://github.com/thisisntjon/thecouncil`

## Findings

- Risky files removed by path/category only: `.bigboss/` local runtime artifacts, including token-named files and a local SQLite database.
- Duplicate docs removed: `capstone/` duplicate folder.
- Local machine path risk sanitized: `CAPSTONE_CONVERSION_REPORT.md`.
- `.env` / `.env.local`: not present.
- `.env.example`: placeholders only.
- `server/.env.example`: placeholders only.
- Package lockfiles: targeted checks found no private registry token markers or local path leak markers.
- License: MIT-style `LICENSE` is present; human comfort with publishing remains required.

## Remaining Human Review

- Confirm license comfort.
- Capture screenshots or a short GIF from `screenshots/cover.html`, `screenshots/architecture.html`, and `screenshots/demo-output.html`.
- Decide whether optional live-provider instructions should remain in the public README or be reduced further.
- Decide how Kaggle reviewers should access the private GitHub repository, if required.
- Add final YouTube/video link.
- Submit to Kaggle.

## Verification

- `npm run secret:scan`: pass after removing local runtime artifacts.
- Fixture data and generated sample reports are simulated/public-safe by review.
- Live provider mode remains optional and disabled by default.
