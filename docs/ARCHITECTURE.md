# Navimower Map Card architecture

Navimower Map Card is a Home Assistant frontend for the Navimower integration. The card presents integration-owned map/state data and calls Home Assistant actions; it does not implement a second mower backend in the browser.

## Responsibility boundary

The Navimower integration owns:

- Navimow account/cloud and MQTT communication;
- mower state and commands;
- map decoding and mower-local X/Y geometry;
- current-cycle and completed-session history;
- map georeferencing and provider reference frames;
- Multi mower site membership and mower-local -> common-site transforms;
- native and Navimower Schedule state/commands;
- notification/account state;
- Gate-area occupancy and fresh-position safety;
- Gate-area persistence through `navimower.set_gate_area` / `navimower.delete_gate_area`.

The Map Card owns presentation and interaction:

- rendering Single and Multi mower maps;
- showing prepared current-cycle/history artifacts;
- map pan/zoom and browser-side view state;
- dialogs, editor controls and visual configuration;
- optional geographic underlay rendering;
- Gate-area drawing/editing before a validated service call;
- routing user actions to the correct Home Assistant mower/device.

The card communicates with mower/account services only through Home Assistant and Navimower integration APIs. Navimow account credentials, account session tokens and map-provider secrets remain backend-owned and are not card configuration.

## One mower-local geometry frame

Zones, Off-limit/VF-off areas, Channels, Gate areas, Custom Areas, dock geometry, mowing trails and dense mower pose stay in the mower's local X/Y frame.

A geographic underlay is an additional presentation layer. Switching OpenStreetMap, Google Satellite, Ortofoto or Hübriid must not move mower-local geometry relative to itself. Newer integrations publish provider-ready reference frames and, for Multi mower, provider-specific site origins. The card selects those integration-owned references rather than implementing mower-model or datum-specific corrections.

Manual underlay East/North/Rotation settings are deliberately frontend-only presentation adjustments. They do not modify Navimower georeference state or mower-local coordinates.

## Single mower runtime

Single mower mode uses the configured `lawn_mower` entity as the anchor and auto-discovers related Navimower entities when `auto_entities` is enabled.

The card renders stable map geometry separately from the high-frequency live mower layer. Routine position/heading changes should not force expensive static map or completed-history reconstruction.

Current-cycle mowing geometry is integration-prepared. The browser renders the prepared artifact instead of rebuilding completed mowing swaths from Home Assistant Recorder or raw route history.

## Multi mower runtime

Multi mower is opt-in through card configuration. Navimower's Site API supplies validated nearby members, stable site ordering and precomputed mower-local -> common-site transforms.

The card keeps member state scoped by mower/config-entry identity. That boundary applies to:

- mower controls;
- Schedule discovery/actions;
- zone interaction and zone details;
- current-cycle data;
- History/session selection;
- notification actions.

Notifications may be merged for display, but read actions remain routed to the originating mower/account context.

## Prioritized and phased loading

The current 0.3.6 runtime is designed to show a useful map before optional/heavy data finishes loading.

With a compatible Navimower integration the card requests the lightweight base map with `include_current_cycle=0`, then requests the compact current-cycle artifact with `current_cycle_only=1`. Older supported integrations that include current-cycle data in the normal map response remain compatible.

In Multi mower mode:

- member base maps are prioritized before session metadata/history renders;
- active mowers are prioritized, then the anchor, then idle members;
- member-map/session/history requests use bounded concurrency;
- completed members may render incrementally instead of waiting for the entire site;
- pose-only changes can update mower markers without rebuilding every static site layer.

Temporary History render failures use bounded retry/cache behavior rather than becoming permanent blank entries.

## Async lifecycle safety

Site, member-map, session-index, current-cycle and selected-session requests are generation-checked. Results from an earlier configured mower/card generation are discarded after disconnects or identity changes.

History selection is last-request-wins so a late response cannot overwrite the user's newer selection.

Home Assistant state remains authoritative after service calls. The frontend does not pretend a mower command, notification write or Gate-area save succeeded until the integration/Home Assistant state catches up.

## Schedule and mower actions

The card is not a scheduler. Native Navimow Schedule and Navimower Schedule execution remain in the integration/mower backend.

The card opens the appropriate member-scoped Schedule UI and sends edits/actions through Home Assistant. Likewise Resume, Mow, Pause and Dock are Home Assistant/integration calls, not direct service-provider requests.

For `navimower.mow`, the card uses internal IDs from `map.zones[].id`. Display labels such as `Zone 2` are presentation text, not command IDs.

## Gate-area editor

Gate-area editing is a frontend geometry editor over integration-owned data. The card converts user gestures into mower-local polygon points, performs immediate UI validation such as self-intersection checks, then saves/deletes through Navimower services.

The integration remains authoritative for final polygon validation, config-entry persistence, entity reloads and occupancy based on fresh MQTT position.

See [GATE_AREA_EDITOR.md](GATE_AREA_EDITOR.md).

## Runtime and build layout

The repository intentionally ships one cumulative JavaScript runtime:

```text
src/navimower-map-card.js
dist/navimower-map-card.js
```

`dist/navimower-map-card.js` is the deterministic minified production build of the cumulative source. The pinned build tool reduces download and parse cost without changing the one-file HACS runtime architecture.

The active release preparation is intentionally small:

```text
node scripts/sync-version.mjs && node scripts/build.mjs
```

Historical `upgrade-*` and beta preparation scripts remain useful as development history and regression fixtures, but a new release does not replay the historical beta chain. Production source is already the cumulative runtime.

`npm test` is read-only and verifies the single-runtime layout, minified production build, release metadata, source and dist smoke behavior, current behavior contracts and historical regressions that still matter.
