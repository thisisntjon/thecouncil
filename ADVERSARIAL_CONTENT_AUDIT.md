# Adversarial Content Audit

Date: 2026-06-26

## Method

Searched public candidate files for the requested risky terms without printing secret-like line contents. Ignored private/ignored paths such as `_private_course_alignment/`, `runs/`, `workflow/`, `importantprompt.txt`, `.git/`, and `node_modules/`.

Terms searched:

`Pirate`, `PirateShip`, `Pirate Ship`, `Intercom`, `Assembled`, `Databricks`, `customer`, `employer`, `support conversation`, `ticket`, `WFM`, `FIN`, `Parlay`, `Polaris`, `thisi`, `Jonathan`, `Jon Simone`, `phone`, `email`, `address`, `api_key`, `apikey`, `token`, `secret`, `password`, `private`, `.env`, `BEGIN PRIVATE KEY`, `OPENAI`, `ANTHROPIC`, `GEMINI`, `BRAVE`.

## Actions Taken

- Sanitized local machine paths in `JUDGE_GRADE_AUDIT_REPORT.md` and `PRE_COMMIT_PACKAGING_REHEARSAL.md` to remove the Windows username.
- Added `.claude/`, `workflow/`, and `importantprompt.txt` to `.gitignore` so local process state and the audit instruction prompt are not accidentally published.
- Moved process/history docs into `docs/process/` so public root is cleaner.

## Findings

| Suspicious term group | File path(s) | Category | Status | Action |
| --- | --- | --- | --- | --- |
| `Pirate`, `PirateShip`, `Pirate Ship`, `Intercom`, `Assembled`, `Databricks`, `WFM`, `Parlay`, `Polaris`, `thisi`, `Jonathan`, `Jon Simone` | None after sanitization | Private/company/personal names | Safe | Removed local username path hits from audit reports. |
| `customer`, `employer`, `support conversation`, `ticket` | `RELEASE_CHECKLIST.md`, `SECURITY_AND_PRIVACY.md`, `skills/council-verification/SKILL.md`, `screenshots/README.md`, `submission_assets/MEDIA_ASSET_GUIDE.md`, `docs/process/FINAL_COUNCIL_SUBMISSION_CHECK.md` | Safety/release wording | Safe | References are policy-style "do not include/show" guidance, not actual customer/employer data. |
| `phone`, `email`, `address` | Public docs, `lib/security.mjs`, `scripts/secret_scan.mjs`, `scripts/live_preflight.mjs`, `scripts/fixture_ui_server.mjs`, `tests/capstone_smoke.mjs`, `server/index.js`, `shadow-council/index.js`, process docs, submission assets | Redaction/safety/contact-wording | Safe | Hits are redaction regexes, safety guidance, or generic wording. No actual phone/email/address values found in this pass. |
| `api_key`, `apikey`, `token`, `secret`, `password`, `private`, `BEGIN PRIVATE KEY`, `OPENAI`, `ANTHROPIC`, `GEMINI`, `BRAVE` | `.env.example`, `server/.env.example`, `README.md`, `CAPSTONE.md`, `SECURITY_AND_PRIVACY.md`, `package.json`, `lib/security.mjs`, `scripts/secret_scan.mjs`, optional live scripts/server/shadow files, process docs, submission assets | Security/config/live-provider wording | Safe with caveat | Expected references to placeholders, redaction rules, provider names, and secret-scan logic. Do not commit real `.env`. |
| `.env` | `.env.example`, `server/.env.example`, docs, scripts, tests | Config/safety wording | Safe | Placeholder examples and ignore/scan docs only. |

## Risk Assessment

No actual private company names, customer data, employer data, personal names, phone numbers, email addresses, real API keys, passwords, private keys, or raw secret values were found in the public candidate set during this audit.

Remaining caution: process docs under `docs/process/` and active audit reports are still not polished public-facing assets. They should be reviewed before a public release decision, or left out of the final public repo if the goal is a clean submission surface.
