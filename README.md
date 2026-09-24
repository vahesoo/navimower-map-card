# Navimower Map Card

![Navimower Map Card](docs/images/navimower-map-card.png)

A Home Assistant dashboard card for the [`Navimower`](https://github.com/vahesoo/NaviMower) custom integration. It combines the live mower map, current mowing cycle, history, notifications, mower controls, scheduling, geographic map underlays, gate-area editing and selected device settings in one responsive card.

> [!IMPORTANT]
> This card is designed for the **Navimower** integration and uses `custom:navimower-map-card`. The card is a frontend only: mower commands, schedules, notifications, map/georeference data and gate occupancy remain integration responsibilities.

## Features

- **Current cycle map** — renders the integration-prepared current-cycle mowing area and loads it independently from the lightweight base map when the installed integration supports the phased Map API.
- **History** — keeps completed sessions available by Home Assistant calendar day and highlights a selected session without mixing older cycles into the default map.
- **Live mower position** — MQTT-backed mower-local position and heading with model-aware artwork for H1/H2, i-series, i2 LiDAR, X3 and X4 families.
- **Multi mower** — optional Site API view that combines validated nearby mower maps in one site viewport while keeping each mower's controls, schedule and history correctly scoped.
- **Map underlays** — None, OpenStreetMap, Estonia Ortofoto, Estonia Hübriid and Google Satellite, using integration-owned provider reference frames where available.
- **Mower controls** — conditional Resume plus Mow, Pause and Dock controls.
- **Mow now** — select one or more map zones and choose restart/continue semantics; the card sends Navimower's internal map zone IDs, not displayed zone numbers.
- **Notifications** — retained Navimow notifications with unread state, per-message read action and Mark all as read; Multi mower merges member feeds while preserving mower/account targeting.
- **Schedule** — supports both native Navimow schedule and the integration-owned Navimower Schedule, including member-scoped access in Multi mower mode.
- **Gate areas** — renders exact mower-local gate polygons and provides a direct visual editor for creating, reshaping, renaming and deleting them.
- **Settings** — optional quick access to selected Home Assistant entities from the mower device.
- **Map geometry** — zones, Off-limit areas, VF-off areas, Channels, Gate areas, charging station and integration-defined Custom Areas.
- **Visual editor** — grouped Displayed information, Appearance, Colors, Map underlay, Notifications, Schedule and Settings controls.
- **Error feedback** — the mower icon gets a red pulsing glow while the `lawn_mower` entity reports an error.
- **Zoom, pan and orientation** — mouse wheel, pinch zoom, pan, initial focus and optional browser-side view memory. Map orientation can stay in the mower's native frame, use geographic North-up, or use a custom rotation. Normal pan/zoom is intentionally suspended while the gate-area editor is active.
- **Performance-oriented rendering** — static geometry and prepared mowing-area artifacts are reused; live mower pose changes do not rebuild every site layer.

## Requirements and compatibility

- Home Assistant 2026.6 or newer
- [`Navimower`](https://github.com/vahesoo/NaviMower) integration **0.4.3 or newer** for the 0.3.5-era Single mower feature set
- **Navimower 0.4.5-beta24 or newer is recommended for the current 0.3.7 prerelease line and Prepared Render Model path**
- HACS is recommended for installation and updates

The 0.3.6 line was developed together with the Navimower 0.4.4 line. Individual additions have narrower backend boundaries:

| Card feature | Integration support |
| --- | --- |
| Basic Single mower map/current cycle/history | 0.4.3+ |
| Multi mower Site API | 0.4.4-beta4+ |
| Google Satellite backend proxy | 0.4.4-beta22+ with a configured Google Map Tiles key |
| Provider reference frames | 0.4.4-beta23+ |
| Phased base/current-cycle Map API | 0.4.4-beta28+; older supported responses still fall back to the combined payload |
| Exact polygon Gate areas | 0.4.4-beta32+ |
| Visual Gate area Save/Delete | 0.4.4-beta34+ |
| Prepared static/layout render model | 0.4.5-beta21+; beta23/beta24 recommended for stabilized static identity/checkpoint behavior |
| Prepared live-route SVG model | 0.4.5-beta21+; beta25 recommended for 30 s backbone cadence and short-tail transport |
| Prepared History manifest/resources | 0.4.5-beta26+; beta15 consumes retained completed-session resources |

For the current prerelease pair, use Navimower 0.4.5-beta26 or newer. Older supported integrations remain usable through the card's legacy map/trail/History fallbacks, but they do not provide the beta15 Prepared History manifest/resources.

## Installation with HACS

1. Open **HACS**.
2. Open the three-dot menu and choose **Custom repositories**.
3. Add this repository as category **Dashboard**.
4. Open **Navimower Map Card** and choose **Download**.
5. Refresh the Home Assistant frontend.

HACS installs the single runtime resource automatically:

```text
dist/navimower-map-card.js
```

## Quick start

Only the anchor mower entity is normally required:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.my_mower
auto_entities: true
```

With `auto_entities: true` the card discovers the related Navimower map, position, heading, battery, zone, notification and scheduler entities from the same Home Assistant device.

### Multi mower

Multi mower remains opt-in. Enable **Multi mower** in the card editor or YAML:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.my_mower
auto_entities: true
multi_mower: true
```

The configured mower is the site anchor. Other validated members are discovered from Navimower's Site API; you do not add a second mower entity to the card. The integration supplies the common-site transforms, so the browser does not georeference every polygon or trail point itself.

See [`docs/MULTI_MOWER_AND_UNDERLAYS.md`](docs/MULTI_MOWER_AND_UNDERLAYS.md) for member scoping, load order and underlay behavior.

## Current cycle and History

The default map is **Current cycle**, not a union of every mowing session from the current day.

For every zone, the Navimower integration decides where the latest confirmed mowing cycle begins. A pause, charging stop, Home Assistant restart or `reset=false` continuation stays in the same cycle. A confirmed new cycle/reset clears only that zone's older mowing area from the default view. Older completed sessions are not deleted; they remain available under **History**.

With the phased Map API, the card first requests the lightweight map without blocking on `current_cycle_render`, then requests the compact current-cycle artifact independently. Older supported integrations that still return the artifact in the base response continue to work.

History uses Home Assistant's configured time zone for day membership. In Multi mower mode, session rows are grouped/scoped by mower and temporary history-render failures are retryable instead of being cached permanently.

The card does not reconstruct completed mowing swaths from Home Assistant Recorder. See [`docs/SESSION_API.md`](docs/SESSION_API.md) for the current frontend/backend contract.

## Mower controls

### Resume

When the installed Navimower integration reports a resumable retained task, **Resume** calls `navimower.resume`. It does not create a new mowing cycle.

### Mow

**Mow** opens the integrated Mow now dialog. You can select one or more zones, choose whether the selected work restarts or continues, or leave zones unselected to let the integration/mower use all known zones.

The card reads `map.zones[].id` and sends those **internal map zone IDs** to `navimower.mow`. A displayed label such as `Zone 2` is not assumed to mean internal ID `2`.

On mower generations that support ordered zone mowing, selection order is forwarded by the integration. First-generation H-series models can mow selected zones but do not support user-defined custom zone order; the mower chooses the order for those models.

### Pause and Dock

**Pause** pauses the mower task and **Dock** sends the mower to the charging station.

## Schedule

The Schedule UI supports two schedule sources:

- **Native schedule** — the weekly schedule stored by Navimow.
- **Navimower Schedule** — the integration-owned time-window/queue scheduler.

The card does not run a browser-side scheduler. It discovers the selected mower's schedule entities and sends changes through Home Assistant. In Multi mower mode, Schedule access lives with each mower control group and discovery/actions remain scoped to that member.

Configure the Navimower Schedule from the mower's Home Assistant device/integration options first. The card can then display and edit the current time window and custom queue through the integration-owned entities/actions.

The integration owns runtime semantics such as queue slots, repeated rounds, retained-task ownership, charging continuation and window boundaries. Updating or closing the browser cannot become the scheduler itself.

## Notifications

The Notifications button uses Navimower's retained notification feed and read actions:

```text
navimower.mark_notification_read
navimower.mark_all_notifications_read
```

In Multi mower mode the card merges member feeds newest-first and labels/routes actions to the originating mower. The card never calls the Navimow cloud directly and does not own account-level read state.

## Map underlays

Underlays are optional presentation layers behind Navimower's mower-local SVG geometry. The card currently offers:

- **None**
- **OpenStreetMap**
- **Ortofoto** — Maa- ja Ruumiamet, Estonia
- **Hübriid** — Maa- ja Ruumiamet, Estonia
- **Google Satellite**

The integration remains authoritative for local-map to geographic georeferencing. Newer Navimower versions advertise provider-specific reference frames; the card selects the requested frame and does not contain mower-model-specific datum policy.

OpenStreetMap and Google use the web/WGS84 provider frame when available. Estonia Ortofoto/Hübriid use the regional cartographic frame. Multi mower uses the integration-provided provider-specific common-site origin so changing the underlay does not move individual mower maps relative to each other.

### Manual underlay fine tuning

The visual editor can apply presentation-only fine tuning to the selected underlay:

- **East offset**: `-10.0 m` to `+10.0 m`
- **North offset**: `-10.0 m` to `+10.0 m`
- **Rotation**: `-5.0°` to `+5.0°`
- step: `0.1`

These values move/rotate the background imagery only. They do not alter mower-local X/Y, zones, dock, trails, Channels, Gate areas or Custom Areas and are not written back to Navimower's georeference.

Google credentials and tile-session secrets stay on the Home Assistant backend. The card receives only authenticated backend paths/availability metadata and displays provider attribution returned by the backend.

See [`docs/MULTI_MOWER_AND_UNDERLAYS.md`](docs/MULTI_MOWER_AND_UNDERLAYS.md) for the full rendering contract.

## Gate areas

Gate areas are mower-local safety/interlock geometry. Exact polygons are preferred; legacy `x_min/x_max/y_min/y_max` rectangles still render as a compatibility fallback.

With a compatible Navimower integration, use the pencil button on the map to edit Gate areas directly:

- the first three points of a new polygon are placed freely;
- every later normal tap is inserted into the **nearest existing polygon edge**, with no distance limit;
- midpoint **+** handles provide explicit edge insertion;
- existing vertices can be dragged or removed while at least three points remain;
- polygons support 3–64 points;
- crossing/self-intersecting geometry is highlighted and **Save** is disabled;
- existing legacy rectangles open as four-corner polygon drafts;
- Save/Delete call `navimower.set_gate_area` and `navimower.delete_gate_area` rather than modifying Home Assistant config entries directly.

Position and zoom the map before entering edit mode; normal map pan/zoom is deliberately disabled during gate editing so gestures cannot move the map while a point is being placed or dragged.

The card only renders/edits geometry. Gate occupancy and fresh-position safety remain Navimower integration responsibilities. See [`docs/GATE_AREA_EDITOR.md`](docs/GATE_AREA_EDITOR.md).

## Other map areas

The map uses Navimow/Navimower terminology:

- **Zone** — mowing area
- **Off-limit** — mapped area the mower must not enter
- **VF-off** — area where VisionFence obstacle detection is disabled
- **Channel** — route connecting mowing zones
- **Gate area** — Navimower gate/interlock geometry
- **Custom area** — integration-defined Home Assistant area overlay

Custom Areas can be shown or hidden independently. Their fill opacity, border width and color are configured under the same Appearance/Colors groups as the other mower-local geometry.

## Settings button

The optional Settings button opens the Home Assistant entities selected in the card editor. Use it for the mower settings you want available directly from the dashboard without duplicating their logic in the card.

## Visual defaults

New cards start with a clean, thin-line map style:

| Setting | Default |
| --- | ---: |
| Map background | `#ffffff` |
| Map legend opacity | `0.10` |
| Zone fill | `#81c784` / `0.20` |
| Zone border | `#43a047` / `1.5` |
| Mowed area | `#43a047` / `0.50` |
| Off-limit | `#FF5A00` / `1.5` |
| VF-off | `#2F80ED` / `1.5` |
| Channel | `#808080` / `1.5` |
| Gate area | `#8e24aa` / `1.5` |
| Dock | `#37474f` / `1.5` |
| Custom area | `#8e24aa`, fill `0.10`, border `1.5` |
| Zone label opacity | `0.75` |
| Mower scale | `1.2` |
| Dock scale | `1.1` |
| Zone marker scale | `1.1` |

All mower-local outline controls use non-scaling SVG strokes so their displayed width remains stable while the map zoom changes. See [`docs/outline-controls.md`](docs/outline-controls.md).

## Example YAML

The visual editor is recommended, but commonly used settings can also be configured in YAML:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.my_mower
auto_entities: true
multi_mower: false

show_status: true
show_zone: true
show_battery: true
show_position: false
show_zone_labels: true
show_channels: true
show_vf_off_areas: true
show_gate_areas: true
show_custom_areas: true
show_map_legend: true
show_session_legend: true

enable_zoom: true
initial_zoom: 1
initial_focus: map
map_orientation: native
# map_rotation: 12.5   # used when map_orientation: custom
remember_view: false
max_zoom: 8

map_underlay: none
underlay_opacity: 1
underlay_east_offset: 0
underlay_north_offset: 0
underlay_rotation: 0

map_background_color: "#ffffff"
map_legend_opacity: 0.10
zone_label_font_size: 20
zone_label_opacity: 0.75

zone_fill_color: "#81c784"
zone_fill_opacity: 0.20
zone_stroke_color: "#43a047"
trail_color: "#43a047"
trail_opacity: 0.50
off_limit_color: "#FF5A00"
vf_off_color: "#2F80ED"
channel_color: "#808080"
gate_area_color: "#8e24aa"
dock_color: "#37474f"
custom_area_color: "#8e24aa"
custom_area_fill_opacity: 0.10

zone_stroke_width: 1.5
off_limit_stroke_width: 1.5
vf_off_stroke_width: 1.5
channel_stroke_width: 1.5
gate_area_stroke_width: 1.5
dock_stroke_width: 1.5
custom_area_stroke_width: 1.5

mower_scale: 1.2
dock_scale: 1.1
zone_marker_scale: 1.1
```

The visual editor is the authoritative way to discover currently supported values. Map underlay opacity uses the canonical `underlay_opacity` setting.

## Visual editor

The editor groups related settings so the same type of setting stays in one place:

- **Displayed information** — map elements, Custom Areas and header-button visibility.
- **Appearance** — opacity, scale, marker and border-width controls.
- **Colors** — map and area colors.
- **Map underlay** — provider, opacity and presentation-only East/North/Rotation adjustment.
- **Notifications** — retained-notification display options.
- **Schedule button** — choose Automatic, Navimower or Native schedule view behavior.
- **Settings** — choose mower-device entities exposed by the Settings button.

## Frontend performance and lifecycle

The card deliberately keeps expensive work out of the browser where possible:

- with Navimower 0.4.5-beta21+, static map geometry/layout can come from the integration's content-addressed Prepared Render Model and is fetched only when its resource identity changes;
- beta12 consumes the content-addressed prepared live-route SVG model;
- beta14 completes the short-tail transport; with Navimower 0.4.5-beta25+, normal map refreshes request the prepared SVG backbone plus the explicit short live tail instead of retransferring the full raw trail;
- beta15 consumes Navimower 0.4.5-beta26+ ready-only Prepared History manifests and immutable content-addressed completed-session resources; Single and Multi mower views share the same browser resource cache;
- the mower marker and newest trail points remain live from Home Assistant/MQTT between 30 s prepared-backbone publications;
- older integrations keep the raw-geometry and raw-trail renderers as complete fallbacks;
- current-cycle mowing area is prepared by Navimower and can be fetched independently of the base map;
- completed History sessions use backend-prepared SVG archives;
- Multi mower requests are bounded and member maps are rendered incrementally;
- active members are prioritized before idle members;
- live position/heading updates can replace only affected mower markers instead of rebuilding the entire site;
- asynchronous Site, map, current-cycle and History responses are generation-checked so stale responses are discarded after reconnect/config changes;
- footer, controls, Schedule and Notifications use independent render fingerprints where practical.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the current runtime and integration boundary.

## Updating and cache troubleshooting

After a HACS update, Home Assistant may still have the previous JavaScript resource in browser cache. If a new editor option or visual change does not appear:

1. refresh the Home Assistant frontend;
2. on mobile, fully close and reopen the Home Assistant app if necessary;
3. on desktop, perform a hard refresh if the old card runtime is still cached.

The current card version is printed in the browser console as `NAVIMOWER-MAP-CARD`.

## Development

Navimower Map Card intentionally ships one cumulative runtime file:

```text
src/navimower-map-card.js
dist/navimower-map-card.js
```

`src/navimower-map-card.js` is the readable cumulative source of truth. `dist/navimower-map-card.js` is a deterministic minified production build generated with pinned esbuild, so HACS/browser users load substantially less JavaScript. The active release pipeline only synchronizes the package/runtime version and rebuilds that single production file; historical beta upgrade scripts are not replayed to create a new release candidate.

Run:

```bash
npm run prepare-release
npm test
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the single-runtime and release rules.

## Issues and contributions

Bug reports and feature requests are welcome in this repository's GitHub Issues. When reporting a map/rendering issue, include the Navimower integration version, Map Card version, mower model and a screenshot where possible.
