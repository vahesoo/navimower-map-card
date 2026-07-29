[SESSION_API.md](https://github.com/user-attachments/files/30509802/SESSION_API.md)
# Navimower session API contract

Navimower Map Card 0.1.0 works with the current map API payload and also supports an optional `sessions` list for exact previous-session times and trails.

## Existing fields

```json
{
  "trail": [[1.2, 3.4], [1.3, 3.5]],
  "trail_session": 19,
  "trail_active": true
}
```

## Recommended additional fields

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

The integration should own session boundaries. The card deliberately does not query Home Assistant Recorder or infer historical sessions from state gaps.
