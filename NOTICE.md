# Notice

Claude Code Skills Hub is an index, browser, batch installer, and ccswitch ZIP exporter for Claude Code skills.

## Ownership

- The website code, sync scripts, admin tool, and UI implementation in this repository are maintained by this project.
- The indexed skill content is third-party content collected from upstream repositories.
- This project does not claim ownership of third-party skill files, names, descriptions, or source code.

## Third-party skill content

Each skill page shows:

- upstream repository
- upstream path
- original description
- a license note for the source repository

When a packaged ZIP is exported, it contains files mirrored from the upstream skill folder where available. If a README-like skill does not include `SKILL.md`, the sync script adds a minimal `SKILL.md` wrapper so ccswitch can import it.

## License posture

The platform code is intended to be open source so other developers can improve the website.

Third-party skill content remains under the license, terms, or notices of its upstream repository. Some sources include per-skill `LICENSE.txt` files, one source declares AGPL-3.0, and one source did not expose a unified top-level license during inspection.

If you are an upstream author and want content removed or attribution changed, open an issue in this repository.

