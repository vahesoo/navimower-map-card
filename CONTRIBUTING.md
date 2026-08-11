# Contributing

Issues and pull requests are welcome.

## Runtime layout rule

Navimower Map Card intentionally has exactly one runtime JavaScript file in each runtime directory:

```text
src/navimower-map-card.js
dist/navimower-map-card.js
```

`src/navimower-map-card.js` is the cumulative source of the current development line. Every beta is built directly on the previous beta in this same file. Historical beta/stable implementations belong in Git commits, tags and releases, not in version-specific runtime files on `main`.

Do **not** add files such as `navimower-map-card-vNNN.js`, `navimower-map-card-*-bN.js`, loader chains, or other version-specific runtime modules for cache busting. HACS uses the stable `navimower-map-card.js` filename for prereleases and stable releases.

`scripts/check-runtime-layout.mjs` enforces this rule in CI. `scripts/build.mjs` also refuses to build when `src/` contains additional JavaScript runtime files and recreates `dist/` from the single source file.

If a future technical requirement genuinely needs more than one runtime JavaScript file, change the architecture deliberately: update the layout guard, build script, tests and this documentation in the same change, and explain the reason in that release's notes. Do not bypass the guard only to create another beta loader.

## Release discipline

Card releases are cumulative. Make normal implementation/test/documentation commits first and change `package.json` version only after the intended release state is green. The package version bump is the automatic prerelease/stable publish trigger.

A stable release should therefore be the final tested beta plus only the intentional stable-version/documentation cleanup; there is no separate step that merges earlier beta runtime files together.

## Local checks

The project has no runtime dependencies.

```bash
npm test
```

Run `npm run build` after source changes. It replaces `dist/` and copies `src/navimower-map-card.js` to `dist/navimower-map-card.js`; the two files must be byte-for-byte identical.

Please test UI changes in at least:

- a desktop browser;
- Android Chrome or the Home Assistant Companion App;
- a dashboard using Sections view.
