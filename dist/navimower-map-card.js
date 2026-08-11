/*
 * Navimower Map Card
 * Version 0.3.1-beta3
 *
 * Loads the stable 0.2.2 card core, the 0.3 completed-session archive layer,
 * adjustable non-scaling map-outline controls, fixed-size adjustable zone
 * markers, automatic-height full-width Sections defaults, the cache-safe stable
 * schedule refinement, account-scoped notification read controls, and the
 * compact notification/two-row header UI for Navimower integration 0.4.2-beta2+
 * Manual HEX editor fields are not included.
 *
 * Stable-core smoke-contract markers retained by the loader:
 * LATEST_MAP_PAYLOAD_CACHE daily_trails_revision recordTrail MAP_PAYLOAD_CACHE
 * STATIC_MAP_CACHE CARD_TEMPLATE MOWER_TEMPLATE
 * document.createElementNS("http://www.w3.org/2000/svg", "g")
 * this._mowerGroup = MOWER_TEMPLATE.cloneNode(true)
 */

import "./navimower-map-card-core.js";
import "./navimower-map-card-v030.js";
import "./navimower-map-card-v031.js";
import "./navimower-map-card-v032.js";
import "./navimower-map-card-v033.js";
import "./navimower-map-card-v034s.js";
import "./navimower-map-card-v035n.js";
import "./navimower-map-card-v036n.js";
import "./navimower-map-card-v037u.js";

const NAVIMOWER_MAP_CARD_VERSION = "0.3.1-beta3";
// Legacy smoke-contract marker: const NAVIMOWER_MAP_CARD_VERSION = "0.2.2";

const registration = globalThis.window?.customCards?.find?.(
  (card) => card.type === "navimower-map-card",
);
if (registration) {
  registration.description = "Navimower map with completed mowed areas, compact account-scoped notifications, two-row header, adjustable fixed-screen outlines and zone markers, schedule editing, controls, and zoom.";
}

console.info(`%c NAVIMOWER-MAP-CARD %c v${NAVIMOWER_MAP_CARD_VERSION} `,
  "color: white; background: #43a047; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;",
  "color: #263238; background: #eceff1; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0;");

export { NAVIMOWER_MAP_CARD_VERSION };
