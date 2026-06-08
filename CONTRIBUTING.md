# Contributing

Thanks for helping improve Claude Code Skills Hub.

Most users do not need to deploy this project locally. The public site is intended to be the main product surface:

[http://39.104.27.129/skills/](http://39.104.27.129/skills/)

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

