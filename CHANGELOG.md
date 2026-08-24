# Changelog

## 0.3.4-beta5 - 2026-08-24

### Added

- Add a gear-button Settings dialog with up to 12 user-selected Home Assistant entities configured from the visual card editor.
- Add a Navimower-managed scheduler overview using the integration's schedule-status sensor, with completed, active and upcoming zone states.
- Route the Schedule button to the managed scheduler while it is enabled; otherwise keep the native mower schedule as the configuration entry point, including when both schedulers are off.

## 0.3.4-beta4 - 2026-08-23

### Changed

- Prefer persistent `custom_areas` geometry delivered directly by Navimower 0.4.3-beta34+ Map API.
- Keep the beta3 device-scoped binary-sensor discovery as a compatibility fallback for older integration builds.

## 0.3.4-beta3 - 2026-08-23

### Fixed

- Discover Custom Area entities from their device-scoped Navimower unique IDs instead of requiring polygon attributes to already exist during the one-time Entity Registry lookup.
- Re-render Custom Area overlays as Home Assistant state updates arrive, avoiding an empty map when the card initializes before Custom Area state attributes are ready.

## 0.3.4-beta2 - 2026-08-23

### Added

- Render Navimower Custom Areas belonging to the selected mower device.
- Auto-discover Custom Area binary sensors from the mower device registry and use their polygon/name attributes.
- Add Visual Editor controls for showing/hiding Custom Areas, color, fill opacity, and border width.
- Match the Gate Area visual language by default: purple fill and dashed border.

## 0.3.4-beta1 - 2026-08-20

### Changed

- Make mowing-trail width model-aware instead of using one 25 cm visual width for every mower.
- Render the trail as the mower's confirmed cutting width plus 5 cm on each side of the route centreline to prevent small visual gaps between adjacent mowing passes.
- Use 53 cm for X4 (43 cm cutting width), 33.7 cm for X3 (23.7 cm), 31 cm for H-series (21 cm), and 28 cm for i1-series (18 cm).
- Keep the historical 25 cm width as a safe fallback for models whose cutting width is not yet mapped.
- Apply the same width calculation to live, Today/history, and session-highlight route rendering.

## 0.3.3 - 2026-08-19

### Fixed

- Promote the field-tested `i_dark` mower artwork correction from 0.3.3-beta1 to stable.
- Rebuilt the manual i-series dark artwork directly from the supplied original 60 px source asset and preserved its transparent embedded PNG instead of the earlier WebP conversion.

### Packaging

- Keep the stable release on the single `navimower-map-card.js` HACS runtime with source/distribution byte parity and no extra SVG/PNG runtime assets.

## 0.3.3-beta1 - 2026-08-19

### Fixed

- Rebuild the manual `i_dark` mower artwork from the original 60 px source asset (`16076.svg`) instead of the earlier WebP conversion.
- Preserve the source asset's transparent 2x PNG raster inside the existing single JavaScript runtime, keeping the 85x120 geometry and mower scaling/heading behavior unchanged.
- Keep automatic model selection and every other mower artwork unchanged while `mower_icon: i_dark` uses the corrected source image.

## 0.3.2 - 2026-08-19

### Added

- Model-aware mower artwork with automatic H1/H2, i-series, i2 LiDAR, X3 and X4 selection.
- Manual `mower_icon` override in YAML and the visual editor, including separate light/dark i-series artwork.
- Configurable `history_days` from 1 to 31, defaulting to Today plus the two preceding calendar days.

### Changed

- History always offers the configured calendar-day range, including dates without sessions, and shows all sessions from the selected day.
- `show_session_legend` controls only the session-time row; legacy `session_count` no longer limits History.
- README and YAML examples now document the current Resume, Notifications, History, VisionFence and mower-artwork options instead of removed beta-era settings.

### Fixed

- Automatic mower artwork no longer flashes the H1/H2 fallback while Home Assistant is still resolving an X3, X4 or i-series model.
- Manual mower-artwork overrides remain immediate while `auto` waits only when the model is genuinely unresolved.

## 0.3.2-beta2

### Fixed

- Remove the brief wrong mower-artwork flash on dashboard/page reload when **Mower icon** is set to `auto`.
- Keep automatic mower artwork hidden while the Home Assistant device model is still being resolved instead of temporarily rendering the H1/H2 fallback.
- Show the detected X3/X4/i-series/H-series artwork immediately when the model is already available from entity attributes.
- Fall back to H1/H2 only after model resolution has completed and no supported model could be identified.
- Manual `mower_icon` selections remain immediate and are not delayed by model detection.


## 0.3.2-beta1

### Added

- Model-aware mower artwork with automatic H1/H2, i-series, i2 LiDAR, X3, and X4 selection.
- Manual `mower_icon` override in YAML and the visual editor, including light/dark i-series variants.
- Configurable `history_days` (1-31), defaulting to 3 calendar days.

### Changed

- History day choices no longer depend on whether sessions exist for that date.
- All sessions for the selected History day are shown; the legacy `session_count` value no longer limits History and is removed from the visual editor.
- `show_session_legend` now only controls the session-time row.
- New mower artwork is embedded in the existing single runtime asset; no extra HACS runtime files are added.


## 0.3.1-beta6 - 2026-08-11

- Flattened the accumulated core + patch-layer chain into one cumulative `src/navimower-map-card.js` runtime while preserving the complete beta5 behavior.
- Reduced `src/` and `dist/` to exactly one JavaScript file each; `dist/navimower-map-card.js` is an exact build copy of the source.
- Changed HACS back to the stable `navimower-map-card.js` filename instead of creating a new cache-busting loader filename for every beta.
- Reworked the build so it deletes/recreates `dist/` and refuses a second source runtime JavaScript file.
- Added a permanent layout guard that rejects extra runtime files, version-specific local loader imports, or source/distribution drift.
- Documented the single-runtime rule and the explicit process required if a future architecture genuinely needs multiple runtime files.
- Made beta/stable publishing version-bump driven: implementation, tests and documentation land first; the final `package.json` version change triggers publication.
- Kept the beta line cumulative: the final tested beta remains the stable-release candidate without a later step that merges previous beta runtime files.

## 0.3.1-beta5 - 2026-08-11

- Added a dedicated **Resume** control for Navimower integration `0.4.2-beta3` and later, calling only `navimower.resume` for the selected mower.
- Show Resume only when the action exists and the mower is paused, docked, or charging; older integrations keep the previous control layout with no unsupported button.
- When Resume is visible, show **Resume** and **Mow** side by side on the primary control row while **Pause** and **Dock** remain below.
- Kept **Mow** available as a genuinely new mowing action: with the dedicated Resume action present, Mow opens the existing zone-aware dialog instead of implicitly resuming a paused task.
- Preserved the historical paused-Mow fallback on older integrations that do not expose `navimower.resume`.
- Kept docked/charging Resume explicitly model/firmware dependent; the card does not claim that a vendor-retained task exists merely because the mower is at the dock.
- Added beta5 regression coverage for service detection, paused/docked/charging eligibility, Mow/Resume separation, HACS filename, source/dist parity, and the cache-safe `navimower-map-card-0.3.1-b5.js` loader.

## 0.3.1-beta4 - 2026-08-11

- Fixed the configured card title disappearing after the beta3 two-row header change by reasserting the intended header layout after the stable core renders its inline flex style.
- Replaced Notifications Previous/Next pagination with one vertically scrollable list suitable for mouse wheel, trackpad, and touch scrolling.
- Added `notification_count`, labelled **Notifications to show**, with range 1–10 and default 5.
- Removed `notification_page_size` from the active beta configuration and visual editor instead of retaining it as a fallback.
- Kept the unread Notifications header state based on the full retained `Latest notification.recent` list even when fewer rows are displayed.
- Added the cache-safe HACS loader `navimower-map-card-0.3.1-b4.js` and beta4 regression coverage.

## 0.3.1-beta3 - 2026-08-11

- Collapsed notification bodies by default so each item initially shows only its timestamp row and title; clicking the title expands/collapses the content.
- Made an unread title click also call `navimower.mark_notification_read` for that vendor `message_id`, while the timestamp-row **Mark as read** action remains available without expanding content.
- Kept **Mark all as read** in the dialog header and removed the redundant unread dot from the compact list layout.
- Moved the configured card title onto its own row and placed History, Notifications, and Schedule on a separate wrapping action row underneath.
- Added `show_title`, default `true`, in YAML and the visual editor.
- Reworked the visual-editor General section so Mower entity/Auto-detect and Title/Show title form two balanced columns, with a dedicated external **Title** caption.
- Kept `trail_length` because it still limits the browser-side active/fallback live trail; relabelled it **Live trail point cap** and clarified that completed mowed-area history is unaffected.
- Added the cache-safe HACS loader `navimower-map-card-0.3.1-b3.js` and separate beta3 UI module; beta1/beta2 module URLs remain unchanged.

## 0.3.1-beta2 - 2026-08-11

- Added **Notifications** text before the header bell; the text and icon now share the same neutral/read versus Navimow-orange unread state.
- Added an orange **Mark all as read** action at the top center of the Notifications dialog whenever at least one retained notification is unread.
- Replaced the vendor-code text at the end of each unread timestamp row with an orange **Mark as read** action; it disappears after the refreshed `Latest notification` sensor reports that message as read.
- Use the vendor `message_id` for one-message actions and call only `navimower.mark_notification_read` / `navimower.mark_all_notifications_read`; the card never calls the private Navimow cloud directly.
- Keep Home Assistant sensor state authoritative after writes instead of optimistically changing notification `read` flags in the browser.
- Added visual-editor/YAML option `notification_mark_read_on_open`, default `false`; when enabled, opening the dialog explicitly marks all retained Device notifications read for the selected mower/account context.
- Added visual-editor/YAML option `notification_page_size`, default `3`, range `1`–`5` to match the integration's current retained recent-message limit.
- Require Navimower integration `0.4.2-beta2` or later for notification read actions; read state remains scoped to the private-cloud Navimow account used by the mower config entry.
- Added the cache-safe HACS loader `navimower-map-card-0.3.1-b2.js` and a separate beta2 notification implementation module so beta1 browser/WebView cache entries are not overwritten under the same module URL.

## 0.3.1-beta1 - 2026-08-11

- Added a read-only **Notifications** panel opened from a new bell icon in the card header.
- Auto-detect the Navimower 0.4.1 **Latest notification** sensor, including both current `*_latest_notification` and earlier `*_notification` entity-ID forms plus same-device discovery.
- Show notification date/time, title, content and vendor code when supplied by the integration.
- Display three notifications per page by default and page through the integration's retained recent messages without adding a beta1 visual-editor setting yet.
- Use the vendor `read` boolean: any retained unread message makes the bell Navimow orange (`#FF5A00`) with `mdi:bell-badge-outline`; otherwise it stays grey with `mdi:bell-outline`.
- Keep unread rows visually marked with a small orange dot while leaving vendor read state untouched; opening the panel never marks a message read.
- Treat the badge as the unread state of the sensor's retained recent set (currently up to five messages), not as a claim about older Device-feed history that is not present in Home Assistant.
- Added the versioned HACS loader `navimower-map-card-0.3.1-b1.js`; later 0.3.1 betas use matching `-bN.js` filenames and stable 0.3.1 will use `navimower-map-card-0.3.1.js` so browser/WebView module URLs change between builds.
- Recommend Navimower integration 0.4.1 or later for notification support. Existing map, history, controls and schedule behavior remain unchanged.

## 0.3.0-beta5 - 2026-08-06

- Added synchronized manual HEX fields beside every color picker in the visual editor.
- Accept three- and six-digit HEX input, normalize it to uppercase six-digit form, and reject invalid values without changing the active color.
- Keep the optional map background clearable so it can continue inheriting the Home Assistant theme.
- Keep the schedule dialog open for 2.5 seconds after a successful batch save so the Saved confirmation remains visible before automatic closing.
- Keep the schedule dialog open on validation or service errors and when another edit becomes dirty during the confirmation delay.
- Recommend Navimower integration `0.4.0-beta2` so the card's existing lightweight map query omits completed-session and legacy daily-trail payloads.
- Keep completed-session render requests fully parallel; no request queue or concurrency limiter was added.

## 0.3.0-beta1 - 2026-08-05

- Added Navimower integration `0.4.0-beta1` completed-session render archive support.
- Kept only the active session as a live polyline; completed sessions no longer fall back to historical point or daily-trail lines.
- Rendered completed blade-on routes as even-odd SVG mowed-area paths while retaining dock, pause, return, and inter-zone travel as separate strokes.
- Loaded the retained session index and only the selected day's completed render artifacts.
- Added retained-day History choices instead of the previous fixed three-day selector.
- Requested lightweight map payloads and discarded legacy completed route points before caching.
- Closed the schedule dialog after a fully successful batch save while keeping failed edits open.
- Constrained the card to its allocated dashboard width and stabilized SVG outline weight across map extents and zoom levels.
- Split the distributable into a small loader, the tested 0.2.2 core, and the 0.3 archive compatibility layer without adding dependencies.

## 0.2.2 - 2026-08-05

- Added a visual **Mower icon size** slider and kept the mower marker at a constant on-screen size while the map is zoomed.
- Replaced hexadecimal text boxes with Home Assistant native color inputs for colors that always have an explicit value; the optional map background remains clearable so it can inherit the Home Assistant theme.
- Reworked the weekly schedule editor for mobile use: edit any number of collapsed or expanded days, then save all changed days from one persistent bottom action bar.
- Added a matching global discard action, unsaved-day indicators, sequential per-day service calls, and protection against closing out the batch state before a failed day is corrected.
- Added beta-specific smoke coverage for fixed marker scaling, color selectors, global schedule saving, and source/distribution version parity.

## 0.2.1 - 2026-08-03

- Continued drawing the active route while the mower returns to the dock when the integration has `include_return_trail` enabled.
- Matched live card route collection to the backend active-session lifecycle instead of stopping as soon as the mower leaves the cutting state.
- Added revision-aware payload-cache validation so a newly opened or reconnected card does not reuse daily-trail data older than the Map data entity.
- Added a latest-payload stale-while-revalidate fallback so the base map can appear immediately while current dynamic route data is refreshed.
- Added reconnect handling and return-route regression coverage.

## 0.2.0 - 2026-08-03

- Added Map API schema v5 per-zone daily trails while retaining schema v4 session fallback.
- Replaced only the previous same-day route of a zone when a new cycle enters that zone; other zones remain visible and full sessions remain available in History.
- Added optional global mowing-schedule switch detection and `schedule_switch_entity`.
- Made the Schedule header state reflect the global switch when available and show `Configured` when only day periods are known.
- Added a Global schedule master control to the schedule dialog when a writable switch entity exists.

## 0.1.18 - 2026-08-02

- Fixed the H2 mower marker disappearing after the v0.1.17 performance refactor.
- Create the persistent mower artwork in the SVG namespace instead of cloning an XHTML `<g>` from an HTML template.
- Added a regression check for the SVG namespace-safe mower template path.

## 0.1.17 - 2026-08-02

- Added module-level caching for map API payloads and prepared static SVG layers. Returning to the same dashboard restores the base map without repeating geometry normalization, coordinate projection, zone-label collision layout, and static SVG generation.
- Added stale-while-revalidate map loading: a cached map is shown immediately and an older entry is refreshed from the integration in the background.
- Parsed and cached the card template and embedded H2 mower artwork once per loaded frontend module.
- Kept the mower SVG and Mow, Pause, and Dock controls mounted; live updates now change attributes, text, classes, and disabled states instead of rebuilding those DOM trees.
- Added relevant-entity diffing so unrelated Home Assistant state updates no longer redraw the card.
- Coalesced live render requests with `requestAnimationFrame`.
- Added render-key caching for the static map, history, live trail, footer, controls, sessions, and status message.
- Filtered completed session records that contain no drawable route, removing zero-duration restart/reset stubs from the session row and history limit.
- Kept a newly active session visible while it is collecting its first route points.
- Added `show_vf_off_areas`, enabled by default, to hide VF-off polygon fill, outline, and legend row from YAML or the visual editor.
- Map API schema v4 and existing configurations remain compatible.

## 0.1.16 - 2026-08-01

- Added automatic collision avoidance for zone markers and labels.
- Nearby zone labels are repositioned to the nearest free location instead of being drawn on top of each other.
- Added subtle leader lines from displaced labels back to their original zone anchor.
- Zone labels also avoid the map legend and visible Gate-area labels.
- Added the `avoid_zone_label_overlap` option, enabled by default and available in the visual editor.
- Updated the recommended backend version to Navimower v0.2.9.
- Map API schema v4 remains fully compatible.


## 0.1.15 - 2026-08-01

- Updated all active package and runtime version references to `0.1.15`.
- Updated the recommended backend version to Navimower v0.2.8.
- Retained the automatic cutting-height capability handling introduced in v0.1.14, including hiding unsupported or invalid height values.
- No map-data schema change is required; Navimower Map API v4 remains supported.

## 0.1.13 - 2026-07-31

- Added a three-day History selector in the card header with **Today** and the
  two preceding dates in compact `DD.MM` format.
- Today is the default live view and combines the retained routes and session
  buttons from the current calendar day, including the active trail.
- Selecting either earlier date filters both the map routes and session buttons
  to that calendar day.
- Works with Navimower v0.2.6 cycle boundaries and retained session history.
- Zone labels and details now prefer the integration's app-like active progress
  over the slower private-cloud coverage value.
- Restored the original 600 ms three-pulse speed and added `forwards` fill mode
  so the brief extra color flash after the third pulse no longer appears.


## 0.1.14 - 2026-07-31

- Hide the Cutting height row when the integration reports that automatic
  cutting-height control is unsupported or when no valid height is available.
- Reject encoded/raw values such as `316` instead of displaying them as
  millimetres when using older integration payloads.
- Keep valid inherited/global cutting heights visible on supported mowers.
- Updated the README preview to the current three-day History card layout.
- Updated the recommended backend version to Navimower v0.2.7.

All notable changes to this project are documented here.

## 0.1.12 - 2026-07-30

- Fixed the integrated Mow now dialog so zone buttons are read from the current map API location, `map.zones`.
- Restored ordered zone selection for Map API v2/v3 payloads while keeping the legacy top-level `zones` fallback.
- Added regression coverage for both current and legacy zone payload layouts.

## 0.1.11 - 2026-07-30

- Shortened the three-cycle session-route pulse by 200 ms overall for a cleaner finish without the impression of a fourth pulse starting.
- Reworked the README around the current all-in-one card: unified mowed area, integrated Mow now and Schedule dialogs, segmented sessions, automatic HACS resource handling, and current configuration options.
- Documented removed historical-trail opacity and experimental doodle settings so older YAML can be cleaned up safely.
- Removed outdated bundled-card migration guidance and clarified that active and completed routes now share one color and opacity.

## 0.1.10 - 2026-07-30

- Added `Schedule` text beside the calendar icon in the card header.
- Added schedule-state styling: Navimow orange (`#FF5A00`) when at least one enabled schedule period exists, grey when the schedule is off or unavailable.
- Added Navimower map API v3 segmented-trail support for active and completed sessions.
- Rendered each `trail_segments` / `segments` fragment separately so short pauses, reloads, and restarts do not create false connecting lines.
- Kept `trail` and `points` fallback support for older Navimower integration versions.
- Kept session-time highlighting: clicking a merged logical session pulses all of its route segments together.
- Expanded smoke tests for schedule status and multi-segment history, active trail, and session highlighting.
- Updated the README preview image with the labelled orange Schedule control.

## 0.1.9 - 2026-07-30

- Integrated the weekly schedule editor into the map card.
- Added a calendar button in the card header with automatic schedule-entity detection and an optional `schedule_entity` override.
- Added weekday enable/disable controls, multiple 15-minute mowing periods, per-period zone selection, and per-day Save/Discard actions.
- Bundled schedule editing into `navimower-map-card.js`; no separate scheduler frontend resource is required.

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