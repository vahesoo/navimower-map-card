/*
 * Navimower Map Card
 * Version 0.3.1-beta4
 *
 * Beta-specific HACS loader. Every 0.3.1 beta uses a unique versioned filename
 * (0.3.1-b1, 0.3.1-b2, 0.3.1-b3, 0.3.1-b4, ...) and stable will use 0.3.1.js.
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
import "./navimower-map-card-v038u.js";

const NAVIMOWER_MAP_CARD_VERSION = "0.3.1-beta4";

const registration = globalThis.window?.customCards?.find?.(
  (card) => card.type === "navimower-map-card",
);
if (registration) {
  registration.description = "Navimower map with completed mowed areas, compact account-scoped notifications, fixed two-row title header, schedule editing, controls, and zoom.";
}

console.info(`%c NAVIMOWER-MAP-CARD %c v${NAVIMOWER_MAP_CARD_VERSION} `,
  "color: white; background: #43a047; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;",
  "color: #263238; background: #eceff1; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0;");

export { NAVIMOWER_MAP_CARD_VERSION };
