# Changelog

This changelog lists stable releases. Detailed prerelease/beta history remains available in GitHub Releases and under `.github/release-notes/`.

## 0.3.7 - 2026-09-26

Stable cumulative release from the tested 0.3.7 beta line through `0.3.7-beta28`. The stable promotion keeps the tested runtime behavior and updates release metadata/documentation.

### LiDAR terrain and elevation overlay

- Add selectable LiDAR terrain/elevation overlays with configurable opacity for mowers that expose a validated terrain resource through Navimower.
- Support LiDAR per mower inside the existing Multi-mower Site view, including mixed LiDAR/non-LiDAR sites.
- Use integration-provided resource capability instead of hard-coded mower-model guesses.

### Prepared backend rendering and trail semantics

- Progressively consume Navimower 0.4.5 prepared static/layout, current-cycle, live-route, short-tail and retained History resources.
- Render confirmed cutting separately from travel/transit so non-cutting movement does not paint a mowing-width trail.
- Keep compatibility fallbacks for older supported backend responses.

### History, orientation and viewport

- Keep History session selection as a non-destructive highlight over the surrounding current/day mowing context.
- Make the session glow click-driven so normal rerenders do not replay the pulse.
- Add Native, North-up and Custom scene orientation while keeping mower-local geometry, labels, dock artwork, legend and existing underlays aligned.
- Preserve user pan/zoom across backend map refreshes and add optional 30-second interaction-owned auto-reset.

### Resume, weather and UI

- Consume Navimower's backend-owned Smart Resume contract and call `navimower.continue_task` instead of inferring resumability from mower activity.
- Show integration-composed states such as **Raining** and **Rain delay** while preserving canonical mower activity for controls.
- Rename the user-facing Settings dialog/button to **Quick settings** while keeping existing YAML/internal keys compatible.

### Runtime and compatibility

- Consolidate the cumulative card runtime into one canonical source with a deterministic minified production build.
- Existing 0.3.6 features remain: Multi-mower Site view, OpenStreetMap, Google Satellite and Maa- ja Ruumiamet Ortofoto/Hübriid.
- Existing card YAML remains compatible.
- Navimower integration `0.4.5` is the matching stable backend release.

## 0.3.6 - 2026-09-14

Stable cumulative release from the tested 0.3.6 beta line through `0.3.6-beta23`. There is no intentional runtime behavior change from beta23.

### Multi-mower site view

- Add opt-in Multi mower site rendering using Navimower's Site API and integration-provided mower-local -> common-site transforms.
- Keep mower controls, Schedule discovery/actions, zones and History/session identity scoped to the correct mower.
- Merge notifications for convenience while preserving mower/account ownership for read actions.
- Prioritize active/anchor members, bound parallel loading and reject stale asynchronous responses after card/config changes.

### Map underlays and georeference

- Add OpenStreetMap, Estonia Ortofoto/Hübriid and authenticated Google Satellite underlays.
- Use integration-owned provider reference frames and provider-specific Multi mower site origins instead of mower-model-specific frontend offsets.
- Keep provider credentials/session secrets on the Home Assistant backend; they are not card configuration and are not exposed to card JavaScript.
- Add presentation-only East/North/Rotation calibration for small residual imagery alignment corrections.
- Keep mower-local SVG geometry authoritative and usable when an optional underlay is unavailable.

### Map/history performance and resilience

- Use phased base-map/current-cycle loading so the map and primary controls can render before optional current-cycle/History artifacts finish.
- Keep completed-session/current-cycle mowed-area rendering backend-prepared instead of rebuilding retained swaths in the browser.
- Use Home Assistant's configured time zone for History calendar-day membership and retain all sessions for the selected day.
- Add bounded render caches/retries and last-request-wins generation checks for Site, member-map, current-cycle and History requests.

### Gate areas

- Render exact integration-owned Gate-area polygons in Single and Multi mower views while retaining legacy rectangle fallback.
- Add a visual Gate-area editor with vertex drag, edge insertion, rename/delete, 3-64 point support and self-intersection protection.
- Keep editor coordinates mower-local even when editing a member inside a transformed Multi mower site.
- Persist through `navimower.set_gate_area` / `navimower.delete_gate_area`; occupancy remains integration-owned and cannot depend on the browser being open.

### UI and compatibility

- Keep current Schedule, Notifications, Settings, History, mower-artwork and visibility behavior while expanding the 0.3.6 feature set.
- Refresh public documentation around the frontend/backend privacy boundary and interoperability without changing existing screenshots/images or Navimower branding.
- Existing card YAML remains compatible.
- Navimower integration `0.4.4` is the matching stable backend release.

## 0.3.5 - 2026-08-27

### Stable baseline

- Promote the tested 0.3.5 beta series without changing the final prerelease runtime behavior.
- Use Navimower's integration-owned Map API and backend-prepared current-cycle rendering.
- Add persistent Custom Area rendering and Visual Editor controls.
- Add the Navimower Schedule view with native Home Assistant time controls and Custom queue editing.
- Add the configurable Settings dialog with Home Assistant entity controls.
- Improve scheduler/device discovery, mobile dialog behavior, editor organization, visibility handling and update performance.
- Keep current-cycle/history rendering separated so completed cycle data does not require browser-side swath reconstruction.
- Designed for Navimower integration `0.4.3` or newer.

## 0.3.3 - 2026-08-19

### Fixed

- Promote the field-tested `i_dark` mower artwork correction to stable.
- Rebuild the manual i-series dark artwork directly from the supplied 60 px source asset while preserving its transparent embedded PNG.

### Packaging

- Keep the stable release on the single `navimower-map-card.js` HACS runtime with source/distribution byte parity and no extra SVG/PNG runtime assets.

## 0.3.2 - 2026-08-19

### Added

- Add model-aware mower artwork with automatic H1/H2, i-series, i2 LiDAR, X3 and X4 selection.
- Add manual `mower_icon` override in YAML and the visual editor, including separate light/dark i-series artwork.
- Add configurable `history_days` from 1 to 31, defaulting to Today plus the two preceding calendar days.

### Changed

- History always offers the configured calendar-day range, including dates without sessions, and shows all sessions from the selected day.
- `show_session_legend` controls only the session-time row; legacy `session_count` no longer limits History.
- README and YAML examples document the current Resume, Notifications, History, VisionFence and mower-artwork options.

### Fixed

- Automatic mower artwork no longer flashes the H1/H2 fallback while Home Assistant is still resolving an X3, X4 or i-series model.
- Manual mower-artwork overrides remain immediate while `auto` waits only when the model is genuinely unresolved.

## 0.3.1 - 2026-08-12

### Notifications and controls

- Add the integrated Notifications panel with unread state, expandable rows, Mark as read and Mark all as read actions backed by Home Assistant services.
- Add configurable notification row count and optional mark-read-on-open behavior while keeping refreshed integration state authoritative.
- Add a dedicated Resume control when the installed Navimower integration exposes `navimower.resume`, keeping Resume separate from a new Mow action.

### UI and runtime cleanup

- Refine the card header/editor layout and keep Live trail point cap scoped to the active/fallback trail.
- Flatten the historical patch-loader chain into one cumulative source/runtime file and enforce source/dist byte parity.
- Keep existing map, history, daily-trail, VF-off, Schedule and mower-control behavior compatible.

## 0.3.0 - 2026-08-06

### Completed-session rendering

- Use compact completed-session render archives from Navimower integration `0.4.0`.
- Render completed blade-on routes as prepared mowed-area footprints while keeping dock travel, pauses and inter-zone movement as separate strokes.
- Load History from the retained session index and request only the completed renders needed for the selected day.
- Use lightweight initial map requests that can skip completed-session and daily-trail geometry.

### Map presentation

- Add independent zoom-independent outline-width controls for zone, Off-limit, VF-off, Channel, Gate area and dock geometry.
- Keep zone markers a constant on-screen size and add complete marker scaling.
- Default newly created cards to Home Assistant Sections automatic height and full width.
- Improve schedule-save confirmation and keep validation/service errors visible without closing the dialog.

### Compatibility

- Recommended backend: Navimower integration `0.4.0` or later.
- Existing YAML keys and visual settings remain compatible.

## Earlier releases

Detailed historical changes remain available in GitHub Releases and the versioned files under `.github/release-notes/`.
