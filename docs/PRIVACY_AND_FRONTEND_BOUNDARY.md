# Privacy and frontend boundary

Navimower Map Card is a Home Assistant frontend for the Navimower integration. The card renders integration-provided data and sends Home Assistant actions; it is not a second mower/account backend.

## Data and secrets that stay on the backend

The card does not require or store Navimow account credentials, account session tokens or map-provider API/session secrets as card configuration.

Where a feature needs authenticated backend access, the Navimower integration owns that access and exposes only the Home Assistant API paths, state or metadata required by the frontend.

Examples:

- mower/account communication remains in the Navimower integration;
- notification read actions are sent through Home Assistant services;
- Google Satellite uses authenticated Home Assistant backend paths while the Google API key and provider session token remain backend-owned;
- Gate-area occupancy and fresh-position safety are integration responsibilities, not browser-derived state.

## Browser-side data

The card necessarily receives the map/state data needed to render the dashboard, such as mower-local map geometry, current-cycle/history render artifacts, mower pose, zone information and selected Home Assistant entity state.

Browser-side caches and optional view memory are presentation helpers only. They do not become the source of truth for mower history, scheduler ownership, notification read state, Gate occupancy or geographic calibration.

## Public issue reports

Map Card bug reports should normally include the card version, Navimower integration version, Home Assistant version, browser/Companion App information and a description or screenshot of the frontend behavior.

Do not publish account credentials, tokens, provider API keys or other secrets in screenshots, YAML snippets, browser-console output or issue attachments. For integration/backend diagnostics, use the Navimower integration's sanitized Home Assistant Download diagnostics workflow.

Historical changelog/release-note wording is retained as release history. Current README/docs should describe the present frontend contract and interoperability boundary rather than protocol-research provenance.
