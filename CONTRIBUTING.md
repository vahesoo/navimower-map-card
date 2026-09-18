# Contributing

Issues and pull requests are welcome.

## Runtime layout rule

Navimower Map Card intentionally has exactly one runtime JavaScript file in each runtime directory:

```text
src/navimower-map-card.js
dist/navimower-map-card.js
```

`src/navimower-map-card.js` is the cumulative source of the current development line. Every beta is built on the previous tested runtime in this same file. Historical beta/stable implementations belong in Git commits, tags, releases, release notes and regression fixtures, not in version-specific runtime files on `main`.

Do **not** add files such as `navimower-map-card-vNNN.js`, `navimower-map-card-*-bN.js`, loader chains or other version-specific runtime modules for cache busting. HACS uses the stable `navimower-map-card.js` filename for prereleases and stable releases.

`scripts/check-runtime-layout.mjs` enforces this rule in CI. `scripts/build.mjs` also refuses to build when `src/` contains additional JavaScript runtime files and recreates `dist/` from the single source file.

If a future technical requirement genuinely needs more than one runtime JavaScript file, change the architecture deliberately: update the layout guard, build script, tests and this documentation in the same change, and explain the reason in that release's notes. Do not bypass the guard only to create another beta loader.

## Historical upgrade scripts

The repository still contains historical `upgrade-*` and beta preparation scripts because they are useful development history and some regressions exercise their patch/idempotence contracts.

They are **not** the active release builder. A current release must consume the already cumulative `src/navimower-map-card.js` instead of replaying the historical beta chain.

The active release preparation is intentionally limited to:

```text
node scripts/sync-version.mjs && node scripts/build.mjs
```

This synchronizes the runtime version marker from `package.json` and builds the committed cumulative source into a deterministic minified `dist/` runtime with pinned esbuild.

Do not add an old or new beta upgrade script back into `prepare-release`. If an implementation change is needed, land the actual cumulative runtime change in `src/`, add/update permanent regressions, and keep release preparation independent from the path used to develop that feature.

## Release discipline

Card releases are cumulative. Make normal implementation, regression and documentation commits first. Change `package.json` to the intended prerelease/stable version only when the candidate state is ready for CI.

The package-version change on `main` triggers the generic publish workflow. That workflow:

1. validates release metadata;
2. runs the deterministic `prepare-release` step;
3. verifies that preparation touches only generated runtime files;
4. runs the read-only regression suite;
5. commits generated source/dist version synchronization when needed;
6. publishes the matching tag and GitHub release.

A stable release should therefore be the final tested beta plus only intentional stable-version/documentation cleanup. There is no separate step that merges/replays earlier beta runtime files.

Before calling a release complete, verify the publish workflow, final `main` commit, tag target and GitHub release target all agree.

## Documentation discipline

README and `docs/` should describe the **current effective behavior**, not every temporary development experiment.

Historical details such as temporary thresholds, frontend compatibility workarounds or earlier beta architecture belong in release notes when the final behavior has superseded them. Current docs may mention those transitions when they prevent confusion, but the normal user path should describe what the latest runtime actually does.

When a frontend feature depends on a Navimower integration capability, document that boundary explicitly. Do not move integration responsibilities such as mower commands, georeferencing, scheduler execution or Gate occupancy into browser documentation as if the card owns them.

## Local checks

The project has no browser runtime dependencies. The build downloads the pinned `esbuild@0.25.10` tool through `npx` when needed.

For a normal source/documentation change run:

```bash
npm run build
npm test
```

For a release candidate also run the same preparation that CI uses:

```bash
npm run prepare-release
npm test
```

`npm test` must be read-only. After the build/preparation step, `dist/navimower-map-card.js` must remain the deterministic minified build of `src/navimower-map-card.js`; CI smoke-tests both source and production runtimes.

Please test UI changes in at least:

- a desktop browser;
- Android Chrome or the Home Assistant Companion App;
- a dashboard using Sections view.

For Multi mower, underlay or Gate-area editor changes, also exercise the corresponding Single/Multi modes and member/service scoping instead of relying only on source-level tests.
