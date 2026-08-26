import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta5: resilient mower artwork visibility.";
if (source.includes(marker)) {
  console.log("Mower visibility patch already applied");
  process.exit(0);
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta5MowerVisibility) return;
  Card.__navimower035Beta5MowerVisibility = true;
  const proto = Card.prototype;
  const previousRenderMower = proto._renderMower;

  const mowerEntityState = (card) => {
    const entityId = card?._resolved?.mower_entity ||
      card?._resolved?.status_entity ||
      card?._config?.entity ||
      card?._config?.mower_entity ||
      null;
    return entityId ? card?._hass?.states?.[entityId] || null : null;
  };

  const liveModel = (card) => {
    const state = mowerEntityState(card);
    return String(
      state?.attributes?.model ||
      state?.attributes?.device_model ||
      card?._mapPayload?.frontend?.model ||
      ""
    ).trim();
  };

  const syncMowerArtworkModel = (card) => {
    const configured = String(card?._config?.mower_icon || "auto").trim().toLowerCase();
    if (configured !== "auto") return;

    const model = liveModel(card);
    if (model) {
      if (card._mowerModel032 !== model || card._mowerModelResolved032 !== true) {
        card._mowerModel032 = model;
        card._mowerModelResolved032 = true;
        card._mowerArtworkKey032 = null;
        card._mowerRenderKey = null;
      }
      return;
    }

    // beta4 no longer traverses the expensive device-registry compatibility
    // chain on every closed-card update. Until a model is available, mark the
    // lookup as resolved so the existing artwork selector uses its safe H2
    // fallback instead of returning null and hiding the mower group.
    if (card._mowerModelResolved032 !== true) {
      card._mowerModelResolved032 = true;
      card._mowerArtworkKey032 = null;
      card._mowerRenderKey = null;
    }
  };

  proto._renderMower = function beta5RenderMower(...args) {
    syncMowerArtworkModel(this);
    return previousRenderMower?.apply(this, args);
  };

  // Keep this helper testable without reopening the old browser registry scan.
  proto._syncMowerArtworkModel035 = function () {
    syncMowerArtworkModel(this);
    return {
      model: this._mowerModel032 || "",
      resolved: this._mowerModelResolved032 === true,
    };
  };

  console.info("[Navimower Map Card] 0.3.5-beta5 resilient mower artwork visibility enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied resilient mower artwork visibility patch");
