# Multi mower and map underlays

Navimower Map Card can combine validated mower maps into one site view and can place optional geographic imagery behind both Single and Multi mower maps. The integration owns site membership, transforms and geographic reference data; the card owns presentation.

## Enabling Multi mower

Multi mower is opt-in and defaults to off:

```yaml
type: custom:navimower-map-card
entity: lawn_mower.my_mower
auto_entities: true
multi_mower: true
```

The configured mower remains the site anchor. Other members are discovered from the Navimower Site API, so a second mower entity is not manually configured in the card.

Multi mower requires validated Site API metadata. If the integration does not expose a usable multi-mower site, the card falls back to its normal Single mower behavior instead of inventing a local alignment.

## Site geometry and member order

Navimower supplies each member's mower-local -> common-site transform. Mower-local geometry remains untouched and is rendered inside that transform.

The card uses the integration's stable west-to-east member ordering for member controls and related UI. This is presentation order only; it does not change mower identity or map coordinates.

Each mower keeps its own:

- current-cycle map data;
- live trail and mower pose;
- controls;
- Schedule discovery/action scope;
- zones and zone details;
- History/session identity.

Zone/session interaction is namespaced with mower/config-entry identity so identical numeric zone or session IDs on two mower maps cannot collide.

## Multi mower controls and Schedule

Each mower gets its own control group. Mow, Resume, Pause, Dock and Schedule calls are targeted to that member.

The global Single mower Schedule header control is not reused as an ambiguous site-wide action. In Multi mower mode Schedule access belongs to the member control group. If a mower has no Navimower-managed Schedule, it must not borrow another member's scheduler entities; native-schedule fallback also remains member-scoped.

The browser does not execute either scheduler. It only presents integration/vendor state and sends Home Assistant actions.

## Multi mower History and notifications

History rows are grouped/scoped by mower. Selected-session identity includes mower/config-entry identity as well as the session ID.

The card uses Home Assistant's configured time zone when deciding which retained sessions belong to a selected calendar day. All retained sessions for that day remain eligible; there is no hidden eight-session-per-mower display cap.

Notifications are the deliberate exception to separate visual grouping: the dialog may merge member notification feeds newest-first for convenience. Each message is still associated with its originating mower, and read actions remain targeted to the correct mower/account context. Multi mower keeps its own paging state so Home Assistant refreshes cannot snap the dialog back to Single mower paging state.

## Prioritized site loading

A Multi mower site does not wait for every optional artifact before first paint.

The runtime:

- requests member base maps before deferred session metadata;
- prioritizes active mowers, then the anchor, then idle members;
- limits member-map, session-index and History-render concurrency;
- renders completed member maps incrementally;
- updates mower markers selectively when only live position/heading changes;
- rejects stale async responses after card generation/config changes.

This keeps a two- or multi-mower dashboard responsive even when retained history is large.

## Map underlay choices

The Visual Editor exposes one Map underlay selector with these current choices:

- **None**
- **OpenStreetMap**
- **Ortofoto** — Maa- ja Ruumiamet, Estonia
- **Hübriid** — Maa- ja Ruumiamet, Estonia
- **Google Satellite**

Underlays are non-authoritative presentation layers. Navimower's mower-local SVG map remains usable when an underlay is unavailable, still learning, outside provider coverage or temporarily fails.

### OpenStreetMap

OpenStreetMap uses the normal public raster provider and displays its attribution on the map. It requires a validated geographic reference but no Google key.

### Estonia Ortofoto and Hübriid

Ortofoto and Hübriid are exposed for Estonian sites. The card uses Maa- ja Ruumiamet imagery and attribution and guards runtime rendering to supported Estonia coverage.

The normal orthophoto base has a bounded raster zoom. At closer card zoom levels the runtime can request detailed WMS imagery for the visible area after interaction settles. The previous image remains visible until the replacement loads; a temporary detail failure does not intentionally blank the working base imagery.

Hübriid composes the orthophoto presentation with the hybrid overlay and uses the matching detailed provider layers.

### Google Satellite

Google Satellite uses Navimower's authenticated backend. A Google Map Tiles API key and vendor session token are not card configuration and are not exposed to JavaScript.

The card receives backend-provided authenticated tile/viewport paths and availability metadata, requests protected responses through Home Assistant, and displays Google attribution/copyright returned by the backend.

Google viewport metadata may constrain imagery zoom. The card chooses a supported zoom covering the relevant viewport rather than treating every overlapping `maxZoom` rectangle as one global minimum.

## Provider reference frames

Newer Navimower integrations advertise each underlay's required reference frame together with `frontend.georeference_frames`.

Current policy is integration-owned:

- **OpenStreetMap** -> `web_wgs84`
- **Google Satellite** -> `web_wgs84`
- **Ortofoto** -> `regional_cartographic`
- **Hübriid** -> `regional_cartographic`

If the preferred frame is not yet trustworthy, the card may use the integration's advertised active fallback rather than inventing a mower-model offset.

The card does not apply X3/H/i-series-specific datum policy. Historical frontend Google cartographic correction remains only as update-order compatibility for integrations predating provider-frame metadata.

## Provider frames in Multi mower

Multi mower uses Navimower-provided `underlay_origins` for provider-specific site placement. Changing the selected provider moves the geographic underlay reference for the **whole site** while member mower maps remain fixed relative to one another.

A provider-frame change must never be implemented by independently shifting individual mower polygons.

## Manual underlay calibration

The card supports optional visual fine tuning after the integration-provided provider frame is resolved:

| Setting | Range | Step |
| --- | ---: | ---: |
| East offset | -10.0 m ... +10.0 m | 0.1 m |
| North offset | -10.0 m ... +10.0 m | 0.1 m |
| Rotation | -5.0° ... +5.0° | 0.1° |

The correction applies only to the selected underlay. Translation is interpreted in geographic East/North directions and rotation is applied around the map/site centre so a small visual angle correction does not create an arbitrary large origin shift.

These values are browser/card presentation settings. They do not modify the integration's georeference, mower-local geometry or calibration state.

## Single vs background Multi metadata

A card may have Multi Site metadata available even while it is configured/displaying Single mower mode. Single-mower provider availability and frame selection must use the anchor mower's Single map metadata while Single mode is visible. Background/stale Multi metadata must not suppress or redirect a Single mower underlay.

Likewise, Multi site metadata becomes authoritative for site-underlay placement only while the Multi map layer is actually active.

## Compatibility summary

| Capability | Navimower integration |
| --- | --- |
| Stable 0.3.5 Single mower feature baseline | 0.4.3+ |
| Multi mower Site API | 0.4.4-beta4+ |
| Google Satellite backend | 0.4.4-beta22+ with configured key |
| Provider reference frames / provider site origins | 0.4.4-beta23+ |
| Phased current-cycle API used by current performance path | 0.4.4-beta28+ |
| Exact Gate-area polygons | 0.4.4-beta32+ |
| Gate-area write services | 0.4.4-beta34+ |

For the complete current 0.3.6 prerelease feature set, use the latest Navimower 0.4.4 beta; `0.4.4-beta36` is the recommended companion for `0.3.6-beta22`.

## Troubleshooting alignment

When the background looks wrong, identify which layer is actually misaligned:

1. If mower, dock and zones are wrong relative to each other, investigate mower-local pose/map data rather than underlay calibration.
2. If mower + zones + dock remain correct together but all are shifted against imagery, inspect Navimower georeference/provider-frame health.
3. If only one provider is shifted, compare its advertised reference frame and attribution/provider behavior before moving mower-local geometry.
4. If a small residual imagery shift remains after the integration frame is healthy, use the card's East/North/Rotation presentation controls.
5. If Multi members move relative to each other, do not compensate with per-member underlay offsets; inspect Site API transforms/origins instead.
