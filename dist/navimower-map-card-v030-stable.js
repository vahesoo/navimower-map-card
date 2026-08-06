/*
 * Navimower Map Card
 * Version 0.3.0
 *
 * Stable HACS loader with a filename not used by any beta release.
 */

import "./navimower-map-card-core.js";
import "./navimower-map-card-v030.js";
import "./navimower-map-card-v031.js";
import "./navimower-map-card-v032.js";
import "./navimower-map-card-v033.js";
import "./navimower-map-card-v034s.js";

const NAVIMOWER_MAP_CARD_VERSION = "0.3.0";

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
