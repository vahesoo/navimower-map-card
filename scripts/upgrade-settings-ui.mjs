import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.4-beta8: native Home Assistant Settings rows and single-dialog flow.";
if (source.includes(marker)) {
  console.log("Native Settings UI upgrade already applied");
  process.exit(0);
}

if (!source.includes("schedule source, custom queue and inline settings enabled")) {
  throw new Error("Expected beta6 Settings runtime hook was not found");
}

const patch = String.raw`

// 0.3.4-beta8: native Home Assistant Settings rows and single-dialog flow.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower034Beta8Patched) return;
  Card.__navimower034Beta8Patched = true;

  const proto = Card.prototype;
  const slots = Array.from({ length: 12 }, (_, index) => "settings_entity_" + (index + 1));

  function updateNativeRows(card, root) {
    root.querySelectorAll("[data-beta8-row]").forEach((row) => {
      row.hass = card._hass;
    });
  }

  function closeNativeSettings(card) {
    card._beta8SettingsOpen = false;
    card._beta6SettingsOpen = false;
    card._beta5SettingsOpen = false;
    card._beta8SettingsEntityKey = null;
    card._beta8SettingsRenderToken = (card._beta8SettingsRenderToken || 0) + 1;
    card._renderDialog();
  }

  async function renderNativeSettings(card) {
    const host = card._modalHostEl;
    if (!host) return;

    const entities = slots.map((key) => card._config?.[key]).filter(Boolean);
    const entityKey = entities.join("|");
    const existing = host.querySelector("[data-beta8-settings-root]");
    if (existing && card._beta8SettingsEntityKey === entityKey) {
      updateNativeRows(card, existing);
      return;
    }

    card._beta5SettingsOpen = false;
    card._beta6SettingsOpen = false;
    const token = (card._beta8SettingsRenderToken || 0) + 1;
    card._beta8SettingsRenderToken = token;
    card._beta8SettingsEntityKey = entityKey;

    host.innerHTML =
      '<div class="nm-backdrop nm-beta8-settings" data-beta8-settings-root>' +
        '<div class="nm-dialog nm-beta8-dialog">' +
          '<style>' +
            '.nm-beta8-dialog{width:min(92vw,680px);max-height:min(86vh,820px);display:flex;flex-direction:column;overflow:hidden;}' +
            '.nm-beta8-settings-list{overflow:auto;padding:4px 0 12px;}' +
            '.nm-native-row-wrap{padding:4px 8px;border-bottom:1px solid var(--divider-color);}' +
            '.nm-native-row-wrap:last-child{border-bottom:0;}' +
            '.nm-native-row-wrap>.nm-native-entity-row{display:block;width:100%;}' +
            '.nm-native-fallback{display:block;width:100%;padding:14px 12px;border:0;border-bottom:1px solid var(--divider-color);background:transparent;color:var(--primary-text-color);text-align:left;font:inherit;}' +
            '.nm-native-loading,.nm-native-empty{padding:20px 12px;color:var(--secondary-text-color);}' +
          '</style>' +
          '<div class="nm-schedule-dialog-head">' +
            '<div class="nm-schedule-dialog-title">Settings</div>' +
            '<button class="nm-schedule-close" type="button" data-beta8-settings-close><ha-icon icon="mdi:close"></ha-icon></button>' +
          '</div>' +
          '<div class="nm-beta8-settings-list" data-beta8-settings-list>' +
            (entities.length ? '<div class="nm-native-loading">Loading Home Assistant controls…</div>' : '<div class="nm-native-empty">No settings selected in the visual editor.</div>') +
          '</div>' +
        '</div>' +
      '</div>';

    host.querySelector("[data-beta8-settings-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeNativeSettings(card);
    });

    if (!entities.length) return;
    const list = host.querySelector("[data-beta8-settings-list]");
    if (!list) return;

    try {
      const helpers = await globalThis.loadCardHelpers?.();
      if (!helpers || typeof helpers.createRowElement !== "function") {
        throw new Error("Home Assistant createRowElement helper is unavailable");
      }
      if (!card._beta8SettingsOpen || card._beta8SettingsRenderToken !== token || !list.isConnected) return;

      list.textContent = "";
      for (const entityId of entities) {
        const wrapper = document.createElement("div");
        wrapper.className = "nm-native-row-wrap";
        const row = helpers.createRowElement({ entity: entityId });
        row.classList.add("nm-native-entity-row");
        row.dataset.beta8Row = entityId;
        row.hass = card._hass;
        wrapper.append(row);
        list.append(wrapper);
      }
    } catch (error) {
      console.warn("[Navimower Map Card] native Settings rows unavailable", error);
      if (!card._beta8SettingsOpen || card._beta8SettingsRenderToken !== token || !list.isConnected) return;
      list.textContent = "";
      for (const entityId of entities) {
        const state = card._hass?.states?.[entityId];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nm-native-fallback";
        button.textContent = (state?.attributes?.friendly_name || entityId) + " — " + (state?.state || "unavailable");
        button.addEventListener("click", () => {
          card.dispatchEvent(new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: { entityId },
          }));
        });
        list.append(button);
      }
    }
  }

  const previousDialog = proto._renderDialog;
  proto._renderDialog = function (...args) {
    if (this._beta8SettingsOpen) {
      void renderNativeSettings(this);
      return;
    }
    return previousDialog?.apply(this, args);
  };

  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");
  if (previousHass?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: previousHass.get,
      set(value) {
        previousHass.set.call(this, value);
        if (this._beta8SettingsOpen) void renderNativeSettings(this);
      },
    });
  }

  const previousEnsure = proto._ensureDom;
  proto._ensureDom = function (...args) {
    const result = previousEnsure?.apply(this, args);
    if (!this.__beta8SettingsCapture) {
      this.__beta8SettingsCapture = true;
      this.addEventListener("click", (event) => {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const settingsButton = path.find((node) => node?.classList?.contains?.("nm-settings-button"));
        if (!settingsButton) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        this._beta5SettingsOpen = false;
        this._beta6SettingsOpen = false;
        this._beta6ManagedOpen = false;
        this._scheduleDialogOpen = false;
        this._mowDialogOpen = false;
        this._beta8SettingsOpen = true;
        this._renderDialog();
      }, { capture: true });
    }
    return result;
  };

  console.info("[Navimower Map Card] 0.3.4-beta8 native Home Assistant Settings rows enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied native Home Assistant Settings UI upgrade");
