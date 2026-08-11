/*
 * Navimower Map Card
 * Version 0.3.1-beta1
 *
 * Beta-specific HACS loader with a never-before-used filename so Home Assistant
 * browsers and WebViews cannot reuse the 0.3.0 stable loader from cache.
 */

import "./navimower-map-card-core.js";
import "./navimower-map-card-v030.js";
import "./navimower-map-card-v031.js";
import "./navimower-map-card-v032.js";
import "./navimower-map-card-v033.js";
import "./navimower-map-card-v034s.js";
import "./navimower-map-card-v035n.js";

const NAVIMOWER_MAP_CARD_VERSION = "0.3.1-beta1";

const registration = globalThis.window?.customCards?.find?.(
  (card) => card.type === "navimower-map-card",
);
if (registration) {
  registration.description = "Navimower map with completed-session mowed areas, active live trail, retained-day history, read-only notifications, schedule editing, controls, and zoom.";
}

console.info(`%c NAVIMOWER-MAP-CARD %c v${NAVIMOWER_MAP_CARD_VERSION} `,
  "color: white; background: #43a047; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;",
  "color: #263238; background: #eceff1; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0;");

export { NAVIMOWER_MAP_CARD_VERSION };
