# File-by-File Publication Audit

Date: 2026-06-26

## Scope And Method

This audit covers the current publishable candidate set from:

```bash
git ls-files --cached --others --exclude-standard
git ls-files --deleted
```

It includes tracked files, untracked non-ignored files, and tracked paths currently deleted in the worktree. It does not include ignored private files such as `.env`, `_private_course_alignment/`, `node_modules/`, or `runs/`.

## Summary

- Current existing publishable candidates: 109
- Deleted tracked paths still in Git index: 29
- Root was cluttered with process/audit/history docs. Phase 3 cleanup moved the main process reports into `docs/process/` and ignored local-only prompt/workflow paths.
- True public root should emphasize `README.md`, `CAPSTONE.md`, `KAGGLE_WRITEUP_DRAFT.md`, `VIDEO_SCRIPT.md`, `COURSE_CONCEPTS.md`, `COURSE_ALIGNMENT.md`, `SECURITY_AND_PRIVACY.md`, `DEMO_GUIDE.md`, `RELEASE_CHECKLIST.md`, `LICENSE`, `LICENSE_REVIEW.md`, and package files.
- `importantprompt.txt`, `workflow/`, and `.claude/` are process/internal and should not be included in the public release.
- Deleted legacy Python paths should be removed from the index if the Node fixture harness is the final capstone submission.

## Current Existing Paths

| Path | Category | Decision | Public repo? | Reason / risk |
| --- | --- | --- | --- | --- |
| `.claude/skills/add-fixture/SKILL.md` | process/internal | Review/remove | No | Local agent workflow, not core capstone artifact. |
| `.env.example` | config example | Keep | Yes | Placeholder-only environment template. |
| `.gitignore` | repo hygiene | Keep | Yes | Required to keep private/generated files out. |
| `ARCHITECTURE.md` | public-facing core doc | Keep | Yes | Explains fixture architecture and boundaries. |
| `CAPSTONE.md` | public-facing core doc | Keep | Yes | Main capstone framing. |
| `docs/process/CAPSTONE_CONVERSION_REPORT.md` | process/internal | Keep in `docs/process/` | Review | Historical conversion notes preserved outside root. |
| `CLAUDE.md` | process/internal | Review/remove | Review | Assistant-local instructions may be public-safe but are not submission material. |
| `docs/process/COUNCIL_EVALUATION_REPORT.md` | generated/supporting output | Keep in `docs/process/` with caveat | Review | Verbatim model outputs and model-generated citation markers require caveat. |
| `COURSE_ALIGNMENT.md` | public-facing supporting doc | Keep | Yes | Course alignment summary, public-safe if concise. |
| `COURSE_CONCEPTS.md` | public-facing supporting doc | Keep | Yes | Maps project to course concepts. |
| `DEMO_GUIDE.md` | public-facing core doc | Keep | Yes | Reviewer demo instructions. |
| `docs/process/FINAL_COUNCIL_SUBMISSION_CHECK.md` | process/internal | Keep in `docs/process/` | Review | Final checklist/history, not root-facing. |
| `docs/process/FINAL_SUBMISSION_POLISH_REPORT.md` | process/internal | Keep in `docs/process/` | Review | Historical polish report preserved outside root. |
| `JUDGE_GRADE_AUDIT_REPORT.md` | process/internal audit | Move after audit or keep uncommitted | Review | Useful for work process, not polished public artifact. |
| `KAGGLE_WRITEUP_DRAFT.md` | submission asset | Keep | Yes | Needed for Kaggle writeup. |
| `LICENSE` | license | Keep | Yes | Required public license file. |
| `LICENSE_REVIEW.md` | public-release support | Keep | Yes | Documents license caveat/human decision. |
| `docs/process/MULTI_AGENT_INVESTIGATION_REPORT.md` | process/internal | Keep in `docs/process/` | Review | Investigation history preserved outside root. |
| `PRE_COMMIT_PACKAGING_REHEARSAL.md` | process/internal audit | Move after audit or keep uncommitted | Review | Useful audit evidence, not public root material. |
| `docs/process/PUBLIC_RELEASE_REVIEW.md` | process/internal | Keep in `docs/process/` | Review | Release-history doc preserved outside root. |
| `docs/process/QUALITY_OF_LIFE_BASELINE.md` | process/internal/supporting doc | Keep in `docs/process/` | Review | Useful but too process-heavy for root; public links updated. |
| `README.md` | public-facing core doc | Keep | Yes | Main entry point. |
| `RELEASE_CHECKLIST.md` | public-release support | Keep | Yes | Submission checklist belongs in root. |
| `SECURITY_AND_PRIVACY.md` | public-facing core doc | Keep | Yes | Public safety posture. |
| `VIDEO_SCRIPT.md` | submission asset | Keep | Yes | Video preparation artifact. |
| `client/index.html` | source code | Keep | Yes | Optional live UI source. |
| `client/package-lock.json` | dependency lock | Keep | Yes | Required for reproducible client install. |
| `client/package.json` | dependency manifest | Keep | Yes | Required for optional client install. |
| `client/src/App.jsx` | source code | Keep | Yes | Optional live UI source. |
| `client/src/main.jsx` | source code | Keep | Yes | Optional live UI entry point. |
| `client/vite.config.js` | source config | Keep | Yes | Optional client build config. |
| `demo_fixture.mjs` | source code | Keep | Yes | Core offline CLI demo. |
| `docs/architecture.mmd` | public-facing doc source | Keep | Yes | Architecture diagram source. |
| `docs/demo-flow.md` | public-facing supporting doc | Keep | Yes | Demo flow explanation. |
| `docs/mode-matrix.md` | public-facing supporting doc | Keep | Yes | Clarifies fixture/live/shadow modes. |
| `eslint.config.mjs` | dev config | Keep | Yes | Required for `npm run lint`. |
| `fixtures/README.md` | fixture doc | Keep | Yes | Explains public fixture data. |
| `fixtures/car_already_at_wash_fixture.json` | fixture | Keep | Yes | Public-safe guardrail fixture. |
| `fixtures/car_not_safe_to_drive_fixture.json` | fixture | Keep | Yes | Public-safe guardrail fixture. |
| `fixtures/car_wash_fixture.json` | fixture | Keep | Yes | Public-safe weighted scenario fixture. |
| `fixtures/car_wash_price_check_fixture.json` | fixture | Keep | Yes | Public-safe guardrail fixture. |
| `fixtures/coffee_shop_fixture.json` | fixture | Keep | Yes | Public-safe guardrail fixture. |
| `fixtures/council_fixture.json` | fixture | Keep | Yes | Core public-safe fixture. |
| `importantprompt.txt` | process/internal | Remove from public or ignore | No | Audit instruction prompt, not submission artifact. |
| `launch.bat` | runner/helper | Keep | Yes | Windows reviewer convenience launcher. |
| `lib/claims.mjs` | source code | Keep | Yes | Claim handling helper. |
| `lib/fixtureCouncil.mjs` | source code | Keep | Yes | Core offline fixture engine. |
| `lib/ops.mjs` | source code | Keep | Yes | Operational helper code. |
| `lib/security.mjs` | source code | Keep | Yes | Redaction/risk/tool allowlist. |
| `mcp/README.md` | public-facing supporting doc | Keep | Yes | Documents MCP-style stub. |
| `mcp/server_stub.mjs` | source code | Keep | Yes | Read-only MCP-style stub. |
| `package-lock.json` | dependency lock | Keep with audit review | Yes | Reproducibility; currently pulls vulnerable transitive `form-data`. |
| `package.json` | dependency manifest | Keep with audit review | Yes | Main commands; live SDK dependencies create audit surface. |
| `sample_outputs/README.md` | generated-output doc | Keep | Yes | Explains sample reports. |
| `sample_outputs/latest_fixture_report.json` | generated output | Keep or regenerate before release | Yes | Public-safe sample, timestamp changes. |
| `sample_outputs/latest_fixture_report.md` | generated output | Keep or regenerate before release | Yes | Public-safe sample, timestamp changes. |
| `screenshots/README.md` | screenshot/media helper | Keep | Yes | Public-safe capture guidance. |
| `screenshots/architecture.html` | screenshot/media helper | Keep | Yes | Public-safe architecture visual. |
| `screenshots/cover.html` | screenshot/media helper | Keep | Yes | Public-safe cover visual. |
| `screenshots/demo-output.html` | screenshot/media helper | Keep | Yes | Public-safe demo output visual. |
| `scripts/fixture_ui_server.mjs` | source code | Keep | Yes | Public fixture browser UI server. |
| `scripts/live_feedback_loop.mjs` | optional diagnostic script | Keep with caveat | Review | Live-provider diagnostic; must stay optional and no-key path must remain default. |
| `scripts/live_preflight.mjs` | optional diagnostic script | Keep | Yes | Makes live mode safer and explicit. |
| `scripts/secret_scan.mjs` | release hygiene script | Keep | Yes | Public safety validation. |
| `server/.env.example` | config example | Keep | Yes | Placeholder-only live server env template. |
| `server/index.js` | source code | Keep with caveat | Yes | Optional live server; requires no-key fixture boundaries documented. |
| `server/package-lock.json` | dependency lock | Keep with audit review | Yes | Optional live server lockfile. |
| `server/package.json` | dependency manifest | Keep | Yes | Optional live server manifest. |
| `shadow-council/dashboard.html` | optional diagnostic UI | Keep with caveat | Review | Optional/shadow live path, not official public demo. |
| `shadow-council/index.js` | optional diagnostic source | Keep with caveat | Review | Optional/shadow live path, not official public demo. |
| `shadow-council/package-lock.json` | dependency lock | Keep with audit review | Review | Optional shadow dependencies. |
| `shadow-council/package.json` | dependency manifest | Keep | Review | Optional shadow manifest. |
| `skills/council-verification/SKILL.md` | agent skill | Keep | Yes | Public reusable project skill. |
| `specs/verification.feature` | spec/test artifact | Keep | Yes | Durable behavioral contract. |
| `submission_assets/EVALUATION_SAMPLE.md` | submission asset | Keep | Yes | Public-safe examples. |
| `submission_assets/EVALUATION_SUMMARY.md` | submission asset | Keep | Yes | Public-safe evaluation summary. |
| `submission_assets/GITHUB_RELEASE_NOTES.md` | submission asset | Keep | Yes | Public release helper. |
| `submission_assets/KAGGLE_SUBMISSION_CHECKLIST.md` | submission asset | Keep | Yes | Kaggle checklist. |
| `submission_assets/MEDIA_ASSET_GUIDE.md` | submission asset | Keep | Yes | Media guidance. |
| `submission_assets/SUBMISSION_SUMMARY.md` | submission asset | Keep | Yes | Public summary. |
| `submission_assets/VIDEO_SHOT_LIST.md` | submission asset | Keep | Yes | Video capture plan. |
| `tests/capstone_smoke.mjs` | test | Keep, fix fallback | Yes | Current test assumes Git metadata; source-zip risk. |
| `tests/claims_smoke.mjs` | test | Keep | Yes | Offline claims smoke coverage. |
| `tests/ops_smoke.mjs` | test | Keep | Yes | Offline ops smoke coverage. |
| `workflow/PLAN.md` | process/internal | Keep internal, do not public-root | No | Phased work state, not public submission material. |
| `workflow/research/SYNTHESIS.md` | process/internal | Keep internal, do not public-root | No | Prior research state. |
| `workflow/research/align-course-wants.md` | process/internal | Keep internal, do not public-root | No | Course-alignment research; avoid overexposing process. |
| `workflow/research/align-judging-and-wow.md` | process/internal | Keep internal, do not public-root | No | Course-alignment research. |
| `workflow/research/codebase-reality.md` | process/internal | Keep internal, do not public-root | No | Internal investigation notes. |
| `workflow/research/course-ux-audit.md` | process/internal | Keep internal, do not public-root | No | Internal investigation notes. |
| `workflow/research/judge-audit-context-2026-06-26.md` | process/internal | Keep internal, do not public-root | No | Audit planning context. |
| `workflow/research/model-evaluation-status.md` | process/internal | Keep internal, do not public-root | No | Internal investigation notes. |
| `workflow/research/phase-1.md` | process/internal | Keep internal, do not public-root | No | Prior workflow phase notes. |
| `workflow/research/phase-2-fresh-clone-repro-2026-06-26.md` | process/internal | Keep internal, do not public-root | No | Audit planning notes. |
| `workflow/research/phase-2.md` | process/internal | Keep internal, do not public-root | No | Prior workflow phase notes. |
| `workflow/research/phase-3.md` | process/internal | Keep internal, do not public-root | No | Prior workflow phase notes. |
| `workflow/research/phase-4.md` | process/internal | Keep internal, do not public-root | No | Prior workflow phase notes. |
| `workflow/research/polish-SYNTHESIS.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-code-inventory.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-hypothesis-stress-test.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-phase-1.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-tuning.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-ui.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/polish-verification-scoring.md` | process/internal | Keep internal, do not public-root | No | Prior polish research. |
| `workflow/research/qol-fixture-path.md` | process/internal | Keep internal, do not public-root | No | Prior QoL research. |
| `workflow/research/qol-live-scripts.md` | process/internal | Keep internal, do not public-root | No | Prior QoL research. |
| `workflow/research/qol-server.md` | process/internal | Keep internal, do not public-root | No | Prior QoL research. |
| `workflow/research/role-weighting-design.md` | process/internal | Keep internal, do not public-root | No | Prior design research. |
| `workflow/research/stress-test.md` | process/internal | Keep internal, do not public-root | No | Prior stress-test notes. |
| `workflow/research/ui-wiring.md` | process/internal | Keep internal, do not public-root | No | Prior UI investigation. |

## Deleted Tracked Paths

These paths are still tracked by Git but currently missing from the worktree. If the Node fixture harness is the final capstone submission, remove these from the index in the final commit rather than restoring them by accident.

| Path | Category | Decision | Public repo? | Reason / risk |
| --- | --- | --- | --- | --- |
| `config/council.yaml.example` | deleted legacy config | Remove from index | No | Legacy Python config no longer present. |
| `council/__init__.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/__main__.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/cache.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/chat_ui.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/cli.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/config.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/engine.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/entrance.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/exceptions.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/health_check.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/logging_config.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/prompts.py` | deleted legacy source | Remove from index | No | Legacy Python package removed from active project. |
| `council/providers/__init__.py` | deleted legacy source | Remove from index | No | Legacy Python provider package removed from active project. |
| `council/providers/anthropic_provider.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/providers/base.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/providers/gemini_provider.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/providers/huggingface_provider.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/providers/openai_provider.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/providers/xai_provider.py` | deleted legacy source | Remove from index | No | Legacy live provider code no longer active. |
| `council/setup_helper.py` | deleted legacy source | Remove from index | No | Legacy Python setup helper removed. |
| `council/web.py` | deleted legacy source | Remove from index | No | Legacy Python web path removed. |
| `requirements-dev.txt` | deleted legacy dependency manifest | Remove from index | No | Python dependency path no longer active. |
| `requirements.txt` | deleted legacy dependency manifest | Remove from index | No | Python dependency path no longer active. |
| `scripts/e2e-backend-smoke.mjs` | deleted legacy script | Remove from index | No | No longer present in current Node fixture path. |
| `scripts/e2e-batch-smoke.mjs` | deleted legacy script | Remove from index | No | No longer present in current Node fixture path. |
| `scripts/research-K-investigator-comparison.mjs` | deleted research script | Remove from index | No | Internal research script removed. |
| `scripts/research-instrumented-smoke.mjs` | deleted research script | Remove from index | No | Internal research script removed. |
| `tests/test_engine.py` | deleted legacy test | Remove from index | No | Python test no longer applies. |

## Root Cleanup Recommendations

Moved to `docs/process/` during Phase 3:

- `docs/process/CAPSTONE_CONVERSION_REPORT.md`
- `docs/process/FINAL_SUBMISSION_POLISH_REPORT.md`
- `docs/process/FINAL_COUNCIL_SUBMISSION_CHECK.md`
- `docs/process/PUBLIC_RELEASE_REVIEW.md`
- `docs/process/QUALITY_OF_LIFE_BASELINE.md`
- `docs/process/MULTI_AGENT_INVESTIGATION_REPORT.md`
- `docs/process/COUNCIL_EVALUATION_REPORT.md`

Keep uncommitted or ignored before public release:

- `JUDGE_GRADE_AUDIT_REPORT.md`
- `PRE_COMMIT_PACKAGING_REHEARSAL.md`
- `importantprompt.txt`
- `.claude/`
- `workflow/`

Safe root cleanup path:

1. Public-safe process reports worth preserving were moved to `docs/process/`.
2. `.gitignore` now ignores `.claude/`, `workflow/`, and `importantprompt.txt`.
3. Public links in `README.md`, `COURSE_CONCEPTS.md`, and `submission_assets/EVALUATION_SUMMARY.md` were updated.
4. Remove deleted legacy paths from the index during the final commit if the Node fixture harness remains the final project.

## Publication Verdict

Not ready for public release yet.

The core public project files are strong, and the largest root-clutter issue has been reduced. Remaining public-release issues: deleted tracked legacy files must be staged as removals, source-package test dependency on Git metadata needs a fix or documentation, active audit reports need a final keep/move decision, and one npm high-severity dependency advisory needs review. These are mostly safe cleanup/release-hygiene issues rather than core demo blockers.
