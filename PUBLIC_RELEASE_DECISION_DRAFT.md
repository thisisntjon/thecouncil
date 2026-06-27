# Public Release Decision Draft

Date: 2026-06-26

## Current Visibility

Current repo visibility: **unknown from local checkout**.

Remote configured:

```text
origin https://github.com/thisisntjon/thecouncil.git
```

No repo visibility change was attempted.

## Kaggle Access Need

Kaggle/Google capstone review likely needs either:

- a public project link,
- a public GitHub repo,
- or an access method explicitly accepted by the competition/course instructions.

Private staging is fine during preparation, but final submission should not rely on reviewers having private repo access unless Kaggle explicitly supports that.

## Release Inputs

| Item | Status | Decision impact |
| --- | --- | --- |
| License present | Yes | MIT-style `LICENSE` exists. |
| License concern | Human review | `LICENSE_REVIEW.md` says human comfort with publishing the inherited MIT-style license is still needed. |
| Package lockfile concern | Yes | `npm audit` reports one high-severity transitive `form-data` advisory through optional live-provider SDK dependencies. |
| Third-party code concern | Review | Client/server/shadow/live SDK dependencies are present; fixture demo itself is local/offline. |
| Generated fixture data concern | Low | Fixtures are public-safe simulated data, not scraped private/customer data. |
| Raw evaluation report concern | Medium | Moved to `docs/process/` and caveated; public submission should lead with summary/sample assets. |
| Deleted legacy files | Cleanup needed | Python legacy paths are deleted in worktree and should be staged as removals if Node fixture harness is final. |
| True fresh-clone proof | Pending | Must run after final safe commit from a real Git clone of the committed branch. |

## Options

### Option A - Make this repo public after cleanup

Best if the current repo history and file surface are acceptable to expose.

Required before public:

- Finish remaining audits.
- Fix or document the source-package Git-metadata test dependency.
- Resolve or accept the `form-data` advisory risk.
- Stage deleted legacy files intentionally.
- Run final validation and true committed-state fresh clone.
- Confirm license comfort.

### Option B - Create a separate clean public release repo

Best if the current repo has too much process/history/noise or uncertain inherited history.

Approach:

- Copy only the curated public release file set.
- Keep `docs/process/` optional or omit process reports.
- Commit from a clean root.
- Run true fresh-clone validation on that release repo.

### Option C - Keep private unless Kaggle confirms access

Not recommended unless the submission instructions clearly allow private access. This creates avoidable reviewer-access risk.

## Recommendation

Recommended path: **Option B unless speed is the dominant constraint; otherwise Option A after cleanup.**

The current project content is strong, but the repo has substantial process history, deleted legacy paths, optional live-provider code, and active audit artifacts. A clean public release repo would reduce reviewer distraction. If using this repo directly, complete the remaining cleanup and true clone proof before making it public.

## Human Decisions Remaining

- Confirm whether to publish this repo or create a clean public release repo.
- Confirm license comfort.
- Decide whether to include `docs/process/` in the public repo.
- Decide whether optional live-provider dependencies should stay in the default root install path.
- Capture final public screenshots/video.
- Add final public repo link and video link to Kaggle.
