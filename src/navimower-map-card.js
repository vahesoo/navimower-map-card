/*
 * Navimower Map Card
 * Version 0.3.0
 *
 * Loads the stable 0.2.2 card core, the 0.3 completed-session archive layer,
 * adjustable non-scaling map-outline controls, fixed-size adjustable zone
 * markers, automatic-height full-width Sections defaults, and the stable
 * schedule-dialog refinement for Navimower integration 0.4.0 and later.
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
import "./navimower-map-card-v034.js";

const NAVIMOWER_MAP_CARD_VERSION = "0.3.0";
// Legacy smoke-contract marker: const NAVIMOWER_MAP_CARD_VERSION = "0.2.2";

const registration = globalThis.window?.customCards?.find?.(
  (card) => card.type === "navimower-map-card",
);
if (registration) {
  registration.description = "Navimower map with compact completed-session mowed areas, an active live trail, retained-day history, adjustable fixed-screen outlines and zone markers, native color controls, delayed schedule-save closing, automatic-height full-width Sections defaults, controls, and zoom.";
}

console.info(`%c NAVIMOWER-MAP-CARD %c v${NAVIMOWER_MAP_CARD_VERSION} `,
  "color: white; background: #43a047; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;",
  "color: #263238; background: #eceff1; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0;");

export { NAVIMOWER_MAP_CARD_VERSION };
