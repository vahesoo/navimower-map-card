/*
 * Navimower Map Card 0.3.0-beta4 sections-grid defaults.
 *
 * New cards default to Home Assistant's automatic content height and full
 * section width. Existing cards with explicit layout settings remain under
 * Home Assistant's control and can still be resized manually.
 */

export const NAVIMOWER_MAP_CARD_V033_VERSION = "0.3.0-beta4";

export function defaultGridOptions() {
  return {
    columns: "full",
    min_columns: 3,
    min_rows: 5,
  };
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV033Patched) return;
  Card.__navimowerV033Patched = true;

  Card.prototype.getGridOptions = function navimowerDefaultGridOptions() {
    return defaultGridOptions();
  };

  console.info("[Navimower Map Card] 0.3.0-beta4 automatic-height full-width grid defaults enabled");
}

if (globalThis.customElements) patchCard();
