# Security

This repository contains the public website code and public attribution data.

Private maintainer systems are intentionally not documented here in operational detail.

## Public / private split

Public repository:

- static website UI
- public skill index data
- source attribution
- ccswitch ZIP export logic
- public documentation

Private maintainer side:

- admin access tokens
- DeepSeek API keys
- AI review prompts and logs
- user submission proof screenshots
- moderation decisions
- server access details
- deployment secrets

## Secret handling

Never commit:

- API keys
- admin tokens
- SSH private keys
- server credentials
- uploaded proof screenshots
- moderation logs containing personal data

Secrets should live only in private server environment files or local ignored files.

## Future backend rules

When user submissions and AI review are added:

- rate limit every public POST endpoint
- limit screenshot upload size and MIME type
- reject SVG and executable uploads
- store uploads outside the public web root
- queue AI review jobs instead of running them directly in request handlers
- cap AI API spend with daily limits
- keep maintainer approval required before publishing
- never let public users write directly to published data files

## Reporting

If you find a security issue, do not post secrets publicly. Open a GitHub issue with a minimal description and ask for a private contact channel.

