# Navimower map API contract

Navimower Map Card 0.1.1 works with the current map API payload and supports optional session-history and per-zone detail fields. The integration should own these records; the card deliberately does not rebuild historical mowing data from Home Assistant Recorder.

## Existing trail fields

```json
{
  "trail": [[1.2, 3.4], [1.3, 3.5]],
  "trail_session": 19,
  "trail_active": true
}
```

## Recommended session fields

```json
{
  "trail_started_at": "2026-07-29T12:38:00+03:00",
  "sessions": [
    {
      "id": 18,
      "started_at": "2026-07-29T08:32:00+03:00",
      "ended_at": "2026-07-29T09:17:00+03:00",
      "active": false,
      "points": [[1.0, 2.0], [1.1, 2.1]]
    },
    {
      "id": 19,
      "started_at": "2026-07-29T12:38:00+03:00",
      "ended_at": null,
      "active": true,
      "points": [[1.2, 3.4], [1.3, 3.5]]
    }
  ]
}
```

All timestamps should be ISO 8601 strings. `points` is optional for completed sessions; when omitted, the card still displays the time range.

## Recommended zone-detail fields

Zone labels open a detail panel. The integration can populate it with a `zone_details` list:

```json
{
  "cut_height": 30,
  "zone_details": [
    {
      "id": 13,
      "name": "Zone 5",
      "last_mowed_at": "2026-07-29T12:54:00+03:00",
      "last_completed_at": "2026-07-28T18:16:00+03:00",
      "cutting_height_mm": 35
    },
    {
      "id": 24,
      "name": "Zone 6",
      "last_mowed_at": "2026-07-29T13:12:00+03:00",
      "last_completed_at": "2026-07-29T13:28:00+03:00",
      "cutting_height_mm": 30
    }
  ]
}
```

The progress percentage continues to come from `coverage.zones[].pct`. For cutting height, the card also understands the decoded map field `map.zones[].boundary.height_set`: an explicit value is shown directly, while `256` inherits the top-level `cut_height` value.

Until the integration provides zone-history timestamps, the detail panel shows **Not available** for last-mowed and last-completed times rather than guessing from browser history.
