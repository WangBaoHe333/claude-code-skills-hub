# Contributing

Thanks for helping improve Claude Code Skills Hub.

This is a maintainer-led project. The public repository is open so others can inspect the code, report issues, and propose improvements, but the production site and source list are maintained by the project owner.

Most users do not need to deploy this project locally. The public site is intended to be the main product surface:

[http://39.104.27.129/skills/](http://39.104.27.129/skills/)

Most contributions should start as an issue:

- wrong or unclear skill description
- missing source attribution
- ccswitch ZIP import issue
- useful Claude Code skills repository to consider
- UI bug or mobile layout issue

Pull requests are welcome for concrete fixes, but they will be reviewed before merge. Do not add new third-party sources without attribution and a clear reason.

Use local setup only if you want to improve the website, sync logic, descriptions, source discovery, or ccswitch export behavior.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

For the production `/skills/` path:

```bash
npm run build -- --base=/skills/
```

## Sync data

```bash
npm run sync:build
```

## Description quality

Do not write vague AI-style descriptions.

Good descriptions should say plainly:

- what tool or service the skill connects to
- what the original upstream description actually says
- what the user can reasonably do after installing it
- when the exact capability depends on authorization or current tool schema

If the source description is thin, prefer a conservative translation over invented details.

## Attribution

When adding or changing sources, update:

- `data/sources.json`
- `THIRD_PARTY_SOURCES.md`
- UI license/source notes if needed
