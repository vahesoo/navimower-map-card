# Gate area editor

Navimower Map Card can render and edit Navimower Gate areas directly on the mower map. Gate areas are mower-local geometry used by the integration for gate/interlock automations; the card edits their shape but does not decide whether the mower is currently inside one.

## Exact polygons and legacy rectangles

Current Navimower integrations may expose a Gate area as an exact mower-local polygon:

```text
[[x1,y1],[x2,y2],[x3,y3],...]
```

When three or more valid points are present, the polygon is the preferred rendered geometry in both Single and Multi mower views.

Older Gate areas may expose only `x_min`, `x_max`, `y_min`, `y_max`. Those rectangles remain fully supported for display. When opened in the visual editor, a legacy rectangle becomes a four-corner polygon draft; after Save, the compatible integration stores the exact polygon and derives its compatibility bounds.

## Opening the editor

A compact pencil button appears in the map's upper-right corner when Gate-area editing is available.

Before pressing the pencil button, position and zoom the map to the view you want. Normal map pan/zoom is intentionally disabled while the Gate editor is active so tap/drag gestures cannot simultaneously move the map and edit a polygon.

In Multi mower view the editor keeps the selected area's points in that mower's own local X/Y coordinate system even though the member is displayed inside a common-site transform.

## Creating a Gate area

For a new polygon:

1. Tap the map freely to place the first three corner points.
2. From the fourth point onward, tap anywhere on the editable map.
3. The editor finds the nearest existing polygon edge in screen space and inserts the tapped mower-local coordinate between that edge's endpoints.

There is no maximum screen-distance threshold after the first three points. This final behavior supersedes the temporary beta20 28 px near-edge limit.

Every existing edge also has a midpoint **+** handle. Use it when you want an explicit insertion into that edge without relying on nearest-edge selection.

## Editing an existing area

The editor supports:

- dragging existing vertices;
- inserting a vertex with an edge midpoint **+** handle;
- tapping anywhere to insert into the nearest edge;
- removing the selected vertex while at least three points remain;
- renaming the Gate area;
- deleting the Gate area with an explicit second confirmation;
- 3 to 64 polygon points.

The finished geometry is not written continuously while dragging. It is submitted when **Save** is pressed.

## Geometry validation

The frontend performs immediate checks to prevent an obviously invalid polygon from being submitted.

Self-intersecting/crossing edges are highlighted with the Home Assistant error color. **Save** is disabled and the editor asks the user to fix the crossing geometry first.

This is an early UI guard only. Navimower remains authoritative for final validation and may reject invalid, degenerate or unsupported geometry even if a frontend check did not catch it.

## Save and Delete contract

The card does not write config-entry options directly.

Save calls:

```text
navimower.set_gate_area
```

Delete calls:

```text
navimower.delete_gate_area
```

The request is scoped to the selected mower/device. Editing an existing area passes its current Gate-area identifier so the integration can replace or rename that row safely.

After a successful write, Navimower owns persistence, config-entry reload and refreshed Gate-area entities/Map API data.

## Single and Multi mower coordinate safety

Gate geometry is always stored in mower-local coordinates.

Single mower mode converts the map gesture directly through the displayed mower-local SVG transform.

Multi mower mode first resolves which site member is being edited and then converts the screen gesture back through that member's common-site transform to the member's local X/Y frame. Saving a polygon must therefore never bake the site's geographic translation/rotation into the mower-local coordinates.

## Occupancy is integration-owned

The Map Card does **not** calculate Gate-area occupancy and does not assert a binary sensor from browser pointer geometry.

Navimower integration remains authoritative and, for exact polygon Gate areas, uses mower-local point-in-polygon membership together with its fresh live-position safety rules. Stale/cloud fallback position must not become a browser-side reason to assert a physical Gate area.

This separation is intentional: closing the Home Assistant dashboard cannot change whether an automation considers the mower inside a Gate area.

## Compatibility

- Navimower `0.4.4` provides exact polygon payloads and the Gate-area Save/Delete services used by Map Card `0.3.6`.
- Older integrations continue through rectangle fallback where supported, but cannot provide the full stable visual-editor contract.
- The recommended stable pair is Navimower `0.4.4` with Map Card `0.3.6`.

## Final editor behavior vs development betas

The 0.3.6 beta series intentionally evolved the editor:

- beta18 — exact polygon rendering;
- beta19 — direct visual drawing/editing and integration write services;
- beta20 — edge-aware insertion plus self-intersection guard, temporarily requiring taps within 28 px of an edge;
- beta21 and later — keep the same edge-aware insertion and geometry guard but remove the distance limit: after the first three points, every tap targets the nearest existing edge.

Documentation for current releases describes this final behavior rather than the temporary beta20 threshold.
