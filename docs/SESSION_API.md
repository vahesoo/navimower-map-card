# Navimower Map/History API contract

Navimower Map Card 0.3.6 treats the Navimower integration as the source of truth for mower-local map geometry, the current mowing cycle and retained completed-session history. The browser does not rebuild completed mowing history from Home Assistant Recorder.

## Base map

The normal Map API payload contains the mower's stable/local map geometry and current frontend metadata needed by the card, including zones and the geometry/metadata available for the selected mower.

With Navimower 0.4.4 the card can request a lightweight first response without waiting for the expensive current-cycle render:

```text
include_current_cycle=0
```

The exact endpoint path is integration-owned. The important contract is that this request returns the ordinary base-map data while omitting the current-cycle artifact from the blocking response.

Older supported integrations keep working because the default Map API response remains backward compatible. If `current_cycle_render` is already included with the base payload, the card consumes it and does not require a second artifact before rendering.

## Current-cycle artifact

For the phased path the card requests the compact current-cycle artifact independently:

```text
current_cycle_only=1
```

The integration decides where each zone's current confirmed mowing cycle begins. The card must not infer reset/cycle boundaries from browser timestamps or route shape.

A representative prepared artifact includes a mowed-area SVG path such as:

```text
current_cycle_render.mowed_area.path_d
```

The card renders the integration-prepared geometry directly. Pause, charging, Home Assistant restart or a non-reset continuation can remain part of the same integration-owned cycle. A confirmed reset/new cycle removes only the older default-map mowing area for the affected zone; historical sessions remain retained separately.

## Live route vs completed mowing area

A short live/fallback route may still be rendered from current active route data when available, but completed mowing swaths are not reconstructed in JavaScript from retained point arrays.

The integration owns trail/session lifecycle and backend-prepared completed artifacts. This keeps long mowing sessions and large histories from turning the dashboard into the history-processing backend.

## History session index

History uses the integration's retained session index. Each session has an integration-owned identity and time range. The card requests/render-highlights completed-session artifacts only when needed for the selected History day/session.

The 0.3.6 runtime intentionally does not impose the earlier hidden eight-session-per-mower limit. All retained sessions belonging to the selected Home Assistant calendar day remain eligible for display.

Calendar-day membership is resolved in Home Assistant's configured time zone rather than assuming the browser/device time zone.

Temporary session-render failures are retryable. The runtime uses a bounded cache/retry window rather than permanently caching a failed render as `null`.

Asynchronous session selection is last-request-wins: a late response for an older selection must not replace a newer user selection.

## Session render archive

Completed-session route/mowed-area rendering comes from Navimower's backend-prepared archive rather than from Home Assistant Recorder.

The card may keep a bounded browser cache of prepared render responses, but that cache is presentation acceleration only. Navimower retained history remains authoritative.

## Zone details

Clickable zone labels can open a zone-details panel. The Map API/integration can supply values such as:

```json
{
  "cut_height": 30,
  "zone_details": [
    {
      "id": 13,
      "name": "Zone 5",
      "last_mowed_at": "2026-09-14T12:54:00+03:00",
      "last_completed_at": "2026-09-13T18:16:00+03:00",
      "cutting_height_mm": 35
    }
  ]
}
```

Current zone progress comes from integration-provided coverage/current-zone data. `last_mowed_at` and `last_completed_at` are integration-owned timestamps; the card does not guess them from Recorder history.

For cutting height, the card also understands decoded map-zone height settings when supplied by the integration. An explicit zone value is displayed directly; the integration/top-level cut-height fallback may be used where the decoded map semantics indicate inheritance.

If a field is not provided, the UI should show it as unavailable rather than manufacturing a historical value.

## Internal zone IDs

Map actions use the integration's internal zone IDs from map data, for example `map.zones[].id`.

A display label such as `Zone 2` is not a promise that the command ID is numeric `2`. The Mow dialog passes the actual internal IDs to `navimower.mow`; current Navimower versions also validate explicit IDs server-side when known map zones are available.

## Multi mower

The Navimower Site API supplies member identity, member ordering and mower-local -> common-site transforms. Each member's map/current-cycle/history remains scoped to that mower/config entry.

The card may request member maps, current-cycle artifacts and session metadata in parallel with bounded concurrency, but a member's session ID is never treated as globally unique by itself. Multi-mower selection and interaction are namespaced by member/config-entry identity.

Provider-specific site origins used for geographic underlays are presentation metadata and do not change session/map-local coordinates.

See [MULTI_MOWER_AND_UNDERLAYS.md](MULTI_MOWER_AND_UNDERLAYS.md).

## Request lifecycle

Current 0.3.6 code generation-checks asynchronous Site, member-map, session-index, current-cycle and selected-session responses. If the card disconnects or its configured mower changes, a late response from the earlier generation is ignored.

The base map and primary mower controls are intentionally useful before optional History/current-cycle details finish loading.

## Compatibility

- Navimower 0.4.3 provides the stable 0.3.5-era backend current-cycle/history baseline.
- Navimower 0.4.4 provides the phased `include_current_cycle=0` / `current_cycle_only=1` contract used by the optimized 0.3.6 path.
- Older supported combined Map API responses remain usable through the compatibility path.
- The recommended stable pair is Navimower `0.4.4` with Map Card `0.3.6`.
