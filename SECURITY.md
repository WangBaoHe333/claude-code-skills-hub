# Security

This project has two surfaces:

- public static site: `/skills/`
- private maintainer tools: local-only services accessed through SSH tunnel

## Current admin access

The admin service listens only on the server loopback address:

```text
127.0.0.1:8787
```

The public Nginx route `/skills-admin/` returns `404`.

To access the admin UI, open an SSH tunnel from the maintainer machine:

```bash
ssh -i /Users/wbh/Downloads/文档/hbw.pem -L 8787:127.0.0.1:8787 root@39.104.27.129
```

Then open the local URL stored in:

```text
.secrets/admin-access.txt
```

Do not commit `.secrets/`.

## Secret handling

Never commit:

- DeepSeek API keys
- admin tokens
- SSH private keys
- server IP allowlists
- uploaded proof screenshots
- moderation logs containing personal data

Secrets should live in server environment files or local `.secrets/`.

## Future backend rules

When user submissions and AI review are added:

- require rate limits on every public POST endpoint
- limit screenshot upload size and MIME type
- store screenshots outside the public web root
- strip file names and user-controlled paths
- queue AI review jobs instead of running them directly in request handlers
- cap DeepSeek spend with daily limits
- log abuse signals, not full private payloads
- keep maintainer approval required before publishing
- never let public users write directly to `data/sources.json`

## Recommended access model

- public users: submit skill source and proof
- AI reviewer: creates a private review report
- maintainers: approve, reject, edit description, promote to common
- sync job: publishes approved changes to static site

