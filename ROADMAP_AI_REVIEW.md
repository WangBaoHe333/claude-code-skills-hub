# AI Review Roadmap

This is a high-level public roadmap. The actual AI review backend, API keys, prompts, moderation logs, and proof uploads are private.

## Goal

Use AI review to help maintain the public skill index:

- check whether a submitted repository actually contains usable Claude Code skills
- compare generated descriptions with upstream evidence
- flag unclear, risky, duplicated, or low-quality submissions
- help maintainers decide whether a skill should be approved, rejected, or promoted

## Planned flow

1. A user submits a skill source and optional proof.
2. The private backend queues the submission.
3. AI creates a review report for maintainers.
4. A maintainer approves, rejects, edits, or promotes it.
5. Approved changes are synced into the public static website.

Public users will never publish directly.

## Security posture

- AI keys stay private
- admin tools stay private
- proof screenshots stay private
- human approval is required before publishing
- public endpoints will be rate-limited and abuse-protected

