# Changelog

All notable changes to this project are documented here.

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
