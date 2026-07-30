# Changelog

All notable changes to this project are documented here.

## 0.1.9 - 2026-07-30

- Added a calendar button to the top-right corner of the map card.
- Integrated the full weekly mowing-schedule editor into the existing `navimower-map-card.js` resource.
- Added automatic discovery and an advanced override for the Navimower schedule sensor.
- Preserved per-day enable/disable, multiple 15-minute periods, per-period zone selection, and per-day Save/Discard behavior.
- Added mobile-friendly, scrollable schedule-dialog styling so the main map card keeps its compact height.
- Added smoke-test coverage for schedule-sensor discovery, schedule parsing, 15-minute snapping, midnight end-of-day handling, and `navimower.set_schedule` service payloads.

## 0.1.8 - 2026-07-30

- Unified completed-session and active mowing trails into one composited mowed-area layer.
- Applied one shared trail color and opacity to the whole layer so overlapping routes no longer become darker.
- Removed the oldest/newest historical trail opacity settings from defaults and the visual editor.
- Kept session-time route pulsing unchanged: clicking a session still highlights only that session temporarily.
- Updated session legend dots to use the same trail color and opacity as the unified mowed area.

## 0.1.7 - 2026-07-30

- Integrated Mow, Pause, and Dock controls into the bottom of the map card.
- The Mow button resumes an active paused mowing job immediately; when no resumable job exists, it opens the zone-aware Mow now dialog.
- Added ordered zone selection: selected zone numbers follow the tap order and the same ordered ID list is passed to `navimower.mow`.
- Added the `Clear previous mowing progress` option for the integration service's `reset` parameter.
- Bundled the Mow now dialog into the existing `navimower-map-card.js` resource; no separate frontend resource is required.
- Removed temporary doodle rendering and its visual-editor/YAML settings until the vendor scale can be mapped reliably.

## 0.1.6 - 2026-07-30

- Updated all active package and runtime version references to `0.1.6`.
- Added the previously missing `0.1.5` changelog entry.
- Updated the README to consistently use `Off-limit`, `VF-off`, `Channel`, and `Gate area`.
- Updated README YAML examples to use the current v0.1.5+ configuration keys and default colors.
- Replaced the first-release-only checklist with a reusable release checklist for future versions.

## 0.1.5 - 2026-07-30

- Replaced the inherited map terminology with the actual Navimow meanings: `Off-limit`, `VF-off`, `Channel`, and `Gate area`.
- Switched the card to the corrected Navimower v0.2.2 map-data schema: `off_limit_areas`, `vf_off_areas`, `channels`, and `gate_areas`.
- Changed default colors to Navimow orange for Off-limit, Navimow blue for VF-off, dark grey for Channel, and purple for Gate area.
- Updated the visual editor with the corrected visibility and color controls.
- Removed compatibility reads for the old misleading map-data field names.

## 0.1.4 - 2026-07-30

- Renamed the map legend entries from `Obstacle` and `No-mow` to the Navimow app terms `Off-limit` and `VF-off`.
- Changed both default area colors to Navimow orange (`#FF5A00`) while retaining separate solid and dashed outlines.
- Increased Off-limit and VF-off outline weight and reduced their fill opacity so the underlying map remains visible.
- Corrected doodle orientation by mirroring the private-cloud direction across the SVG Y axis instead of applying a fixed rotation offset.
- Corrected doodle size by interpreting private-cloud `scale` as world-space doodle height and converting it through the current map scale and SVG height.
- Kept doodles in the map-world coordinate system so they remain aligned when whole-map rotation is added later.

## 0.1.3 - 2026-07-30

- Added temporary doodle rendering from the Navimower map API, including sanitized vendor SVG, map-coordinate center, rotation, normalized scale, visibility control, and configurable opacity.
- Fixed zone-label tapping after mouse-wheel zoom, pinch zoom, or pan by keeping interactive labels out of the SVG pointer-capture path.
- Changed session and zone-detail time formatting to follow the Home Assistant user's 12/24-hour preference consistently across desktop and mobile.
- Added YAML and visual-editor controls for `history_trail_min_opacity` and `history_trail_max_opacity`, making completed-session fading less abrupt and fully configurable.
- Increased the default active-trail opacity and made session legend dots use the same configured fade range as the rendered routes.
- Added configurable `map_background_color`; leaving it empty continues to use the active Home Assistant theme.
- Added `show_doodles` and `doodle_opacity` controls to YAML and the visual editor.
- Expanded smoke tests and documentation for the new appearance, time-format, interaction, and doodle behavior.

## 0.1.2 - 2026-07-30
- Made each session-time entry clickable or tappable. The selected session route pulses three times in a temporary highlight layer and then returns to the unchanged normal map.
- Kept all non-selected sessions unchanged during route highlighting; no dimming, recoloring, or persistent selection state is used.
- Split SVG rendering into ordered base, history, current-trail, highlight, details, labels, mower, and UI layers.
- Moved zone boundaries, obstacles, no-mow areas, tunnels, channels, charging station, labels, and legend above mowing trails so important details are not hidden.
- Added configurable `zone_label_opacity` in YAML and the visual editor for zone names and progress percentages.
- Reused one trail-segmentation path for active, historical, and highlighted routes and expanded smoke tests for the new behavior.

## 0.1.1 - 2026-07-29

- Replaced the generic mower marker with the embedded H2 SVG artwork from the earlier Navimow Map Card.
- Replaced the charging-station marker with a hardcoded rounded-square and lightning-bolt icon.
- Removed the Mower and Dock rows from the map legend.
- Removed the visible zoom, minus, and reset controls; wheel zoom, pinch zoom, pan, and double-click reset remain available.
- Made zone labels interactive. Clicking or tapping a label opens progress, last-mowed time, last-completed time, and cutting-height details.
- Added support for optional `zone_details` data supplied by the Navimower map API.
- Added a README banner so the HACS image validation can pass.

## 0.1.0 - 2026-07-29

- Split the private-cloud map card from the Navimower integration into its own HACS dashboard repository.
- Added mower-based automatic discovery for map, position, heading, battery, and physical-zone entities.
- Added a Home Assistant visual configuration form.
- Added wheel zoom, pinch zoom, pan, reset, initial zoom, initial focus, and optional browser-side view persistence.
- Kept the current Navimower camera-inspired default palette.
- Made the map legend background more transparent by default.
- Increased the default zone-label font size.
- Added battery and session-time rows below the map.
- Added support for session history supplied by the Navimower map API.
- Added Home Assistant sections-grid sizing and 2026.6 entity suggestions.
