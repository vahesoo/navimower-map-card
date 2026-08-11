/*
 * Navimower Map Card 0.3.1-beta4 title/header hotfix.
 *
 * Beta3 moved the title and header actions into two logical rows, but the
 * stable core still writes `display:flex` inline on .nm-header from
 * _renderShell(). Inline style wins over beta3's stylesheet rule, so the title
 * can be squeezed away beside the action row. Reassert the two-row layout
 * after every shell render and keep the configured title text/visibility
 * authoritative.
 */

export const NAVIMOWER_MAP_CARD_V038U_VERSION = "0.3.1-beta4";

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === false) return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return Boolean(value);
}

export function titleHeaderState(config = {}) {
  const title = String(config?.title ?? "").trim();
  return {
    title,
    show: booleanValue(config?.show_title, true) && Boolean(title),
  };
}

export function enforceTwoRowHeader(card) {
  if (!card?._domReady) return false;
  const header = card.querySelector?.(".nm-header");
  const title = card.querySelector?.(".nm-title");
  const actions = card.querySelector?.(".nm-header-actions");
  if (!header || !title || !actions) return false;

  const state = titleHeaderState(card?._config);
  title.textContent = state.title;
  title.hidden = !state.show;

  // The core sets this parent to inline flex. Use inline block here so the
  // intended beta3 two-row layout wins deterministically.
  header.style.display = "block";
  header.classList.toggle("nm-header-without-title", !state.show);
  return true;
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV038UPatched) return;
  Card.__navimowerV038UPatched = true;

  const proto = Card.prototype;

  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function titleHotfixEnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      enforceTwoRowHeader(this);
      return result;
    };
  }

  const originalRenderShell = proto._renderShell;
  if (typeof originalRenderShell === "function") {
    proto._renderShell = function titleHotfixRenderShell(...args) {
      const result = originalRenderShell.apply(this, args);
      enforceTwoRowHeader(this);
      return result;
    };
  }

  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function titleHotfixSetConfig(config) {
      const result = originalSetConfig.call(this, config);
      enforceTwoRowHeader(this);
      return result;
    };
  }

  console.info("[Navimower Map Card] 0.3.1-beta4 title header hotfix enabled");
}

if (globalThis.customElements) patchCard();
