# Vendored: noVNC

This directory contains the **noVNC** HTML5 VNC client, vendored into the repo
as in-repo ESM source — **not** an npm dependency.

| Field | Value |
|-------|-------|
| Project | noVNC |
| Version | **v1.6.0** (pinned) |
| Upstream | https://github.com/novnc/noVNC |
| Source archive | https://github.com/novnc/noVNC/archive/refs/tags/v1.6.0.tar.gz |
| License | MPL-2.0 (see `LICENSE.txt`) |
| Date vendored | 2026-05-16 |

## Why this is vendored (not an npm dependency)

UI-SPEC §704 and the Plan 04-15 plan-checker **forbid** `@novnc/novnc` as a
bundled npm dependency. The noVNC RFB client is therefore vendored here as
plain in-repo ESM source so it is reviewable in the commit diff, carries no
floating npm version range, and performs no runtime fetch.

The npm package `@novnc/novnc` ships only a Babel-transpiled CommonJS `lib/`
tree; the upstream GitHub **source archive** at the `v1.6.0` tag ships the
pure-ESM `core/` tree, which imports cleanly under Vite/SvelteKit. We vendor
the source-archive `core/` (and its `../vendor/pako` zlib dependency, which
`core/inflator.js` + `core/deflator.js` import via a relative path) verbatim.

## Layout

```
src/lib/vendor/novnc/
  README.md      — this file (provenance record)
  LICENSE.txt    — noVNC MPL-2.0 license, copied verbatim from upstream
  core/          — the noVNC ESM client; entry module core/rfb.js
                   (default export `RFB`; constructor `new RFB(target, url, options)`)
  vendor/pako/   — the pako zlib codec core/{inflator,deflator}.js import
                   via the relative path `../vendor/pako/lib/zlib/...`
```

The `core/` tree and the `vendor/pako/` tree are **third-party MPL-2.0 /
upstream source** — their license headers are intact and they are NOT
linted or formatted (`src/lib/vendor/` is listed in `.eslintignore` and
`.prettierignore`, and excluded from `tsconfig.json` so `checkJs` does not
flood errors on code we do not own).

## How to refresh

To bump to a newer noVNC release:

```sh
TAG=v1.7.0   # the new release tag
curl -sL -o /tmp/novnc.tar.gz \
  "https://github.com/novnc/noVNC/archive/refs/tags/${TAG}.tar.gz"
tar xzf /tmp/novnc.tar.gz -C /tmp
rm -rf src/lib/vendor/novnc/core src/lib/vendor/novnc/vendor
cp -r /tmp/noVNC-${TAG#v}/core   src/lib/vendor/novnc/core
cp -r /tmp/noVNC-${TAG#v}/vendor src/lib/vendor/novnc/vendor
cp    /tmp/noVNC-${TAG#v}/LICENSE.txt src/lib/vendor/novnc/LICENSE.txt
```

Then update the version + date in this README and re-run
`pnpm exec svelte-check --threshold error`.
