# Final Council Submission Check

Date: 2026-06-26

## Summary

The Council is still clearly the only submitted project. Public docs now frame course alignment as a small supporting checklist used to polish The Council around multi-agent role separation, tool boundaries, security, reproducibility, agent skills, and auditability.

Course-alignment material is minimal and public-safe. Raw transcript material is absent from the public repo. The private analysis folder `_private_course_alignment/` is ignored by Git.

## Transcript Tooling Status

`scripts/pull_course_transcripts.py` was moved to `_private_course_alignment/tools/pull_course_transcripts.py`.

Reason: it was useful for private alignment research, but keeping it as a public script would make the repo look like a course-transcript tool instead of The Council. The moved file is ignored and should not be committed.

## Commands Run

| Command | Result | Fixes made | Remaining blocker |
| --- | --- | --- | --- |
| `launch.bat verify` | Pass | Added Windows launcher for local runs | None |
| `launch.bat car-wash` | Pass | Added Windows launcher shortcut for weighted scenario | None |
| `launch.bat custom "The coffee shop is 50 meters away. Should I walk or drive?"` | Pass | Verified custom scenario routing from launcher | None |
| `npm run verify:capstone` | Pass | Added as one-command public validation | None |
| `npm run demo:car-wash` | Pass | Added weighted practical-reasoning scenario | None |
| `npm run demo:fixture` | Pass | None | None |
| `npm test` | Pass | None | None |
| `npm run secret:scan` | Pass | None | None |
| `npm run mcp:self-test` | Pass | None | None |
| Direct MCP JSON-RPC round trip | Pass | None | None |

## End-To-End Result

The public fixture path works without API keys, live provider calls, or installed npm packages beyond Node/npm itself. It generates JSON and Markdown reports, validates the smoke tests, passes the public secret scan, exposes the MCP tools, and successfully handles a direct `initialize` -> `tools/list` -> `tools/call` -> `shutdown` JSON-RPC flow.

The Windows launcher `launch.bat` supports menu-driven use and direct commands for the default fixture, weighted car-wash scenario, full verification, smoke tests, MCP self-test, and custom fixture questions.

The weighted car-wash scenario now demonstrates role/claim weighting and counterfactual guardrails:

- Base car wash: drive beats walk.
- Price check: walk beats drive.
- Car already at wash: walk beats drive.
- Unsafe-to-drive: do not drive beats drive.
- Coffee shop 50 meters away: walk beats drive.

## Evaluation Artifact

A live 10-question evaluation was run through the full pipeline (ask → peer evaluation → verification swarm → synthesis). Outputs:

- `COUNCIL_EVALUATION_REPORT.md` — detailed report with verbatim model answers. **Supporting artifact only.** Web search was OFF, so the inline `[N]` citations/URLs inside the model answers are model-generated, not verified sources; a caveat header at the top says so explicitly. Some Q10 specifics are unverified model-generated scenarios.
- `submission_assets/EVALUATION_SUMMARY.md` — concise, **public-safe** summary (no full model responses, no fabricated citations) with the headline findings and indicative 1–100 scores. This is the artifact to surface publicly.

Safety scan: no secrets, no machine-specific absolute paths, no PII/employer/customer references in either file. Headline findings: 10/10 synthesized, prompt injection resisted, no crashes; confidence under-calibration and verifier-strictness differences found (tracked as Future Work in `CAPSTONE.md`).

## Files Changed

- `.gitignore`
- `README.md`
- `CAPSTONE.md`
- `COURSE_CONCEPTS.md`
- `COURSE_ALIGNMENT.md`
- `KAGGLE_WRITEUP_DRAFT.md`
- `VIDEO_SCRIPT.md`
- `QUALITY_OF_LIFE_BASELINE.md`
- `PUBLIC_RELEASE_REVIEW.md`
- `FINAL_SUBMISSION_POLISH_REPORT.md`
- `RELEASE_CHECKLIST.md`
- `demo_fixture.mjs`
- `launch.bat`
- `lib/fixtureCouncil.mjs`
- `fixtures/car_wash_fixture.json`
- `fixtures/car_wash_price_check_fixture.json`
- `fixtures/car_already_at_wash_fixture.json`
- `fixtures/car_not_safe_to_drive_fixture.json`
- `fixtures/coffee_shop_fixture.json`
- `sample_outputs/latest_fixture_report.json`
- `sample_outputs/latest_fixture_report.md`
- `screenshots/README.md`
- `submission_assets/SUBMISSION_SUMMARY.md`
- `submission_assets/KAGGLE_SUBMISSION_CHECKLIST.md`
- `submission_assets/GITHUB_RELEASE_NOTES.md`
- `submission_assets/MEDIA_ASSET_GUIDE.md`
- `submission_assets/VIDEO_SHOT_LIST.md`
- `specs/verification.feature`
- `FINAL_COUNCIL_SUBMISSION_CHECK.md`
- `workflow/PLAN.md`
- `workflow/research/`
- `MULTI_AGENT_INVESTIGATION_REPORT.md`
- `COUNCIL_EVALUATION_REPORT.md` (caveat header added)
- `submission_assets/EVALUATION_SUMMARY.md` (public-safe; reframed findings-first)
- `submission_assets/EVALUATION_SAMPLE.md` (new; concrete hero examples)
- Course-alignment + wow pass: `README.md`, `CAPSTONE.md`, `KAGGLE_WRITEUP_DRAFT.md`, `DEMO_GUIDE.md`, `ARCHITECTURE.md`, `screenshots/demo-output.html`, `screenshots/README.md` (UI-first demo; model+harness / vibe-trajectory / vibe-diff / effective-trust framing; memory+tools+reproducibility)

## Files Removed Or Moved

- Moved public transcript puller from `scripts/pull_course_transcripts.py` to `_private_course_alignment/tools/pull_course_transcripts.py`.
- Moved detailed course-alignment final report to `_private_course_alignment/COURSE_ALIGNMENT_FINAL_REPORT.md`.
- Ignored root-local `COURSE_CONCEPTS_SUMMARY.md` so detailed private course notes with local file links cannot be accidentally committed.

## Writeup And Video

- Kaggle writeup word count: 933 words, under 2,500 (added "Evaluation Snapshot" + "Memory, Tools, and Reproducibility" and course-aligned framing).
- Video script estimated duration: about 3 to 3.5 minutes, under 5 minutes. An optional ~10-15s "Evaluation Snapshot" shot was added, marked include-only-if-time-allows so the base script stays under 5 minutes.
- The writeup and video script do not present transcript extraction as a project feature.

## Screenshot Helpers

Ready and public-safe:

- `screenshots/cover.html`
- `screenshots/architecture.html`
- `screenshots/demo-output.html`

Recommended capture order:

1. Cover/title page.
2. Architecture flow.
3. Demo output summary.
4. Optional cropped terminal output from `npm run demo:fixture`.
5. Optional cropped terminal output from `npm run demo:car-wash` showing decision scores/caveats in the generated report.

## Repo Visibility

Repo visibility/public-link remains a human decision. Private repo is for staging only; final Kaggle submission should use a public repo or an access method confirmed by Kaggle.

Placeholder to fill before submission:

`Public GitHub link: https://github.com/thisisntjon/thecouncil`

## Ready To Push?

Ready to commit/push after final validation. Do not push until explicitly requested.

## Exact Next Steps

1. Capture screenshots from the three helper pages under `screenshots/`.
2. Record the under-5-minute video using `VIDEO_SCRIPT.md` and `submission_assets/VIDEO_SHOT_LIST.md`.
3. Decide the final public repo/access method for Kaggle.
4. Add the final public repo link and YouTube link to the Kaggle submission.
