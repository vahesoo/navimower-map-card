# Navimower Map Card

![Navimower Map Card](docs/images/navimower-map-card.svg)

A Home Assistant dashboard card for the [`Navimower`](https://github.com/vahesoo/NaviMower) custom integration.

The card renders the decoded private-cloud lawn map and overlays the live MQTT mower position, heading, current and completed mowing trails, temporary doodles, local channels, tunnels, charging station, battery, physical zone, and mowing-session times.

> [!IMPORTANT]
> This repository is for the new **Navimower** integration and uses the element name `custom:navimower-map-card`.
> The older `Navimow Map Card` repository remains available for users of the older integration.

## Features

- Private-cloud zone geometry and zone names
- Obstacles, no-mow areas, and temporary app doodles
- Tunnels and local channels
- Live MQTT X/Y position and heading
- Current-session mowing trail
- Battery, mower status, and current physical zone below the map
- Session times supplied by the integration map API; click or tap a time to pulse that session route three times
- Layered SVG rendering that keeps boundaries, obstacles, no-mow areas, tunnels, channels, the dock, and labels above mowing trails
- Interactive zone labels with progress, mowing times, and cutting height
- Configurable opacity for active and completed trails, doodles, zone labels, and the map background
- Automatic entity discovery from one `lawn_mower` entity
- Visual card editor
- Pinch zoom, mouse-wheel zoom, and pan
- Configurable initial zoom and focus
- Optional per-browser remembered map view
- Home Assistant Sections-view sizing
- Community card suggestion for `lawn_mower` entities on Home Assistant 2026.6+
- No external JavaScript dependencies

## Requirements

- Home Assistant 2026.6 or newer
- The `Navimower` custom integration with its authenticated map API
- HACS for the recommended installation method

## Installation with HACS

The repository must be public before HACS can download it.

1. Open **HACS**.
2. Open the three-dot menu and choose **Custom repositories**.
3. Add this GitHub repository URL.
4. Select category **Dashboard**.
5. Download **Navimower Map Card**.
6. Refresh the Home Assistant frontend.

HACS installs the JavaScript file from:

```text
dist/navimower-map-card.js
```

The repository name and JavaScript filename intentionally match:

```text
navimower-map-card
navimower-map-card.js
```

## Basic configuration

Only the mower entity is normally required:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.tont
```

The card attempts to discover the following entities from the same Home Assistant device:

- map data
- position X
- position Y
- heading
- battery
- current physical zone

It first uses the Home Assistant entity registry and then falls back to entity-name matching. Every detected entity can be overridden in the visual editor.

## Example with initial zoom

```yaml
type: custom:navimower-map-card
entity: lawn_mower.tont
title: Navimower Map
enable_zoom: true
initial_zoom: 1.4
initial_focus: mower
remember_view: false
```

`initial_focus` accepts:

- `map`
- `mower`
- `dock`

A double-click or double-tap resets the map to the configured initial view.

## Advanced example

```yaml
type: custom:navimower-map-card
entity: lawn_mower.tont
auto_entities: true
show_status: true
show_zone: true
show_battery: true
show_position: false
show_zone_labels: true
show_channels: true
show_tunnels: true
show_doodles: true
show_map_legend: true
show_session_legend: true
session_count: 6
enable_zoom: true
initial_zoom: 1.25
initial_focus: map
remember_view: true
max_zoom: 8
map_legend_opacity: 0.58
zone_label_font_size: 20
zone_label_opacity: 0.8
map_background_color: "#e6e6e6"
zone_fill_color: "#81c784"
zone_fill_opacity: 0.22
zone_stroke_color: "#43a047"
trail_color: "#43a047"
trail_opacity: 0.55
history_trail_min_opacity: 0.28
history_trail_max_opacity: 0.5
doodle_opacity: 0.7
channel_color: "#8e24aa"
tunnel_color: "#039be5"
dock_color: "#37474f"
```

## Manual entity overrides

Overrides take precedence over automatic discovery:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.tont
map_entity: sensor.tont_map_data
x_entity: sensor.tont_position_x
y_entity: sensor.tont_position_y
heading_entity: sensor.tont_heading
battery_entity: sensor.tont_battery
zone_entity: sensor.tont_current_physical_zone
```

The `status_entity` override normally does not need to be set because the selected mower entity is used automatically.

## Zoom behavior

- Mouse wheel: zoom at pointer position
- Two-finger pinch: zoom on mobile
- One-finger drag: pan while zoomed in
- Double-click or double-tap: configured initial view
- At 1x zoom, a one-finger vertical gesture remains available for dashboard scrolling

When `remember_view` is enabled, the last view is stored only in that browser's local storage. It is not written to Home Assistant.

## Map layer order

The SVG is drawn from bottom to top in separate layers:

1. background and zone fills
2. completed-session trails
3. current trail
4. temporary session highlight
5. zone boundaries, obstacles, no-mow areas, tunnels, channels, and charging station
6. temporary doodles
7. zone and channel labels
8. live mower marker
9. map legend and messages

This keeps important map geometry visible even where a dense mowing trail crosses it.

## Trail fading and map appearance

The active trail and completed-session fade can be tuned independently in YAML or the visual editor:

```yaml
trail_opacity: 0.55
history_trail_min_opacity: 0.28
history_trail_max_opacity: 0.5
map_background_color: "#e6e6e6"
```

`history_trail_min_opacity` is used for the oldest displayed completed session and `history_trail_max_opacity` for the newest completed session. Values are interpolated between them. Reversing the two values is safe; the card normalizes them automatically. Leaving `map_background_color` empty keeps the Home Assistant theme's `--secondary-background-color`.

## Temporary doodles

Temporary obstacles created in the Navimow app are rendered from the vendor SVG supplied by the Navimower map API. Their local center, direction, and scale are applied in map coordinates. Doodles can be hidden or faded independently:

```yaml
show_doodles: true
doodle_opacity: 0.7
```

The card sanitizes the embedded SVG and clamps extreme sizes so malformed vendor dimensions cannot cover the whole map.

## Time format

Session and zone-detail times follow the current Home Assistant user's 12-hour or 24-hour time-format preference instead of the browser's independent locale default.

## Zone details

Zone names and percentages on the map are interactive. Their combined label opacity can be adjusted with `zone_label_opacity` from `0` to `1`. Click or tap a zone label to view:

- current or last reported coverage percentage
- last time the zone was mowed
- last time the zone was completed
- cutting height

The cutting height can already be read from decoded map settings. Exact last-mowed and last-completed timestamps require the Navimower integration to provide `zone_details` in the map API payload. Until then, those rows show **Not available** instead of deriving history from the browser or Home Assistant Recorder.

See [docs/SESSION_API.md](docs/SESSION_API.md) for the map API fields supported by the card.

## Session times

The card supports a `sessions` list returned by the Navimower map API. A session may contain:

```json
{
  "id": 19,
  "started_at": "2026-07-29T12:38:00+03:00",
  "ended_at": null,
  "active": true,
  "points": [[1.2, 3.4], [1.3, 3.5]]
}
```

When the integration does not yet provide `sessions` or an exact `trail_started_at`, the card displays the current session using the time when that browser first observed the current `trail_session`. Such an approximate start time is marked with `*`.

Click or tap any session time that has route points. The corresponding route is redrawn in a temporary highlight layer and pulses three times, then disappears so every trail returns to its normal appearance. Other sessions are not dimmed or recolored.

Exact previous-session times and trails therefore depend on the Navimower integration session-history API. The card supports that payload and does not reconstruct mowing history from Home Assistant Recorder.

## Moving from the bundled card

During development, Navimower bundled a card at:

```text
/local/navimower/navimower-map-card.js
```

After this separate HACS repository has been tested and the bundled card has been removed from the integration:

1. Remove the old `/local/navimower/navimower-map-card.js` resource from **Settings → Dashboards → Resources**.
2. Keep the HACS resource for `/hacsfiles/navimower-map-card/navimower-map-card.js`.
3. Clear the frontend cache once if Home Assistant still reports that the custom element does not exist.

Do not keep both resources active because whichever file loads first registers the same custom element name.

## Troubleshooting

### `Custom element doesn't exist: navimower-map-card`

Confirm that HACS created a JavaScript module resource for:

```text
/hacsfiles/navimower-map-card/navimower-map-card.js
```

Then refresh the frontend. On Android, clear the Home Assistant app cache or Chrome cache if the browser still uses an older resource list.

### Map entity cannot be found

Select the mower entity in the visual editor and keep automatic discovery enabled. If the related entities have been moved to a different Home Assistant device, set the advanced overrides manually.

### Map API error

The card uses the authenticated `api_path` from the Navimower map-data sensor or `map_api_path` from the mower entity. Verify that the Navimower integration is loaded and the map-data sensor is available.

## Development

The project has no runtime dependencies.

```bash
npm test
```

Edit:

```text
src/navimower-map-card.js
```

Then rebuild the HACS distribution file:

```bash
npm run build
```

Commit both the source and generated `dist/navimower-map-card.js` file.

## Planned additions

After the map-only release is stable:

- Mow Now dialog using the Navimower integration's zone-aware mowing action
- Scheduler dialog using the integration's schedule support
- Zone ordering for Mow Now when supported by the integration

## Disclaimer

This project is not affiliated with or supported by Segway, Ninebot, Navimow, or Willand. A robot mower is a moving machine with a cutting blade. Test remote commands and automations safely.

## License

MIT License. Created by **Toomas Vähesoo**.
