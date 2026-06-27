# Scope Freeze

Date: 2026-06-26

The Council remains the capstone. This is a release audit and submission polish pass, not a new-feature pass.

## Frozen Scope Rules

- No new features unless they fix judged-submission blockers.
- No live API dependency in the official public demo.
- No course-companion pivot.
- No raw transcripts, downloaded videos, full captions, or copied course content.
- No RAG unless already present and trivial.
- No new agents unless required for demo clarity.
- No UI rewrite.
- No real provider calls in the official demo.
- Fixture/offline/no-key mode remains the official public path.
- The Council remains the project.

## Allowed Safe Fixes

- Broken links.
- Misleading wording.
- Stale docs.
- Root-doc clutter.
- Small README improvements.
- Missing caveats.
- Typo/formatting fixes.
- Checklist updates.
- Public-safe screenshot helper copy.
- Package script aliases that do not break anything.

## Escalation Rule

If a proposed change alters project behavior, depends on live providers, changes the submission story, or takes more than a small safe fix, document it as a blocker/risk instead of implementing it without explicit approval.
