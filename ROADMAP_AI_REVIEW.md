# AI Review Roadmap

This document describes the next private backend stage. It is intentionally separate from the public static website.

## Goal

Build a maintainer-led review system that can:

- accept public skill submissions
- accept proof screenshots from submitters
- use DeepSeek to review skill quality and description accuracy
- optionally search upstream context before writing review notes
- let maintainers approve, reject, edit, or promote skills
- publish approved skills back into the static website

## Phase 1: private backend shell

Add a private backend service with:

- SQLite database
- authenticated admin API
- submission API with rate limits
- file upload handling
- review queue
- DeepSeek API client behind environment variables

Suggested private data tables:

- `submissions`
- `submission_proofs`
- `ai_reviews`
- `maintainer_reviews`
- `approved_sources`
- `description_reviews`
- `abuse_events`

## Phase 2: public submission form

Public users can submit:

- skill name
- GitHub repo URL
- skill folder path if known
- short description
- why it is useful
- proof screenshot
- optional contact

Public users cannot publish directly.

All submissions enter `pending` status.

## Phase 3: AI review with DeepSeek

For each pending item, DeepSeek should produce structured JSON:

```json
{
  "is_skill": true,
  "risk": "low",
  "usefulness_score": 0,
  "common_score": 0,
  "description_zh": "",
  "description_en": "",
  "capability_zh": "",
  "audience_zh": "",
  "scenarios_zh": [],
  "evidence": [],
  "concerns": []
}
```

Review rules:

- do not invent capabilities
- quote or cite upstream evidence when possible
- distinguish proven capability from guess
- mark missing license or unclear source
- flag suspicious repos, binary-heavy packages, obfuscated scripts, or missing `SKILL.md`

## Phase 4: maintainer approval

Admin UI should support:

- list pending submissions
- open proof screenshot safely
- view AI review
- edit descriptions
- approve source
- reject source
- mark as common / featured
- write maintainer note

Only approved records are included in static generation.

## Phase 5: publish approved changes

Approved changes should update:

- `data/sources.json`
- `data/description-overrides.json`
- optional `data/featured-skills.json`
- regenerated `data/skills.json`
- regenerated `public/skill-files/*.json`

Publishing should run as a controlled maintainer action, not directly from public submission.

## Security controls

- no public admin route
- admin through SSH tunnel or VPN
- rate limit public submissions
- CAPTCHA or proof-of-work if abuse starts
- max screenshot size
- image MIME validation
- reject SVG uploads for proof images
- daily DeepSeek spend cap
- queue worker concurrency cap
- audit log for approve/reject/promote

## Open source split

Recommended split:

- public repo: static website, sync scripts, attribution docs
- private repo or private server folder: submission backend, DeepSeek integration, secrets, moderation logs

If the backend code is ever opened, keep secrets and private review data out of the repository.

