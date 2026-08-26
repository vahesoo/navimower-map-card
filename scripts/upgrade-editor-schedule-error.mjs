import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta11: real color defaults, combined schedule state and mower error pulse.";
if (source.includes(marker)) {
  console.log("Beta11 editor/status visual patch already applied");
  process.exit(0);
}
if (!source.includes("0.3.5-beta10: organized editor groups and configurable header buttons.")) {
  throw new Error("Expected beta10 editor organization marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta11EditorScheduleError) return;
  Card.__navimower035Beta11EditorScheduleError = true;

  const COLOR_DEFAULTS = {
    zone_fill_color: "#81c784",
    zone_stroke_color: "#43a047",
    trail_color: "#43a047",
    off_limit_color: "#FF5A00",
    vf_off_color: "#2F80ED",
    channel_color: "#686868",
    gate_area_color: "#8e24aa",
    dock_color: "#37474f",
    custom_area_color: "#8e24aa",
  };
  const COLOR_LABELS = {
    zone_fill_color: "Zone fill color",
    zone_stroke_color: "Zone border color",
    trail_color: "Trail color",
    off_limit_color: "Off limit color",
    vf_off_color: "VF off color",
    channel_color: "Channel color",
    gate_area_color: "Gate area color",
    dock_color: "Dock color",
    custom_area_color: "Custom area color",
  };
  const COLOR_FIELDS = new Set(Object.keys(COLOR_DEFAULTS));

  function walk(items, callback) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item);
      if (Array.isArray(item?.schema)) walk(item.schema, callback);
    }
  }

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm === "function") {
    Card.getConfigForm = function beta11GetConfigForm(...args) {
      const form = previousGetConfigForm.apply(this, args);
      if (!form || !Array.isArray(form.schema)) return form;

      walk(form.schema, (field) => {
        if (!COLOR_FIELDS.has(field?.name)) return;
        const text = field?.selector?.text;
        if (!text || text.type !== "color") return;

        // Home Assistant ha-form supports a field-level default. Supplying the
        // same defaults used by the runtime prevents an absent config value
        // from being rendered as the browser's misleading black color input.
        field.default = COLOR_DEFAULTS[field.name];

        // Remove the beta10 prefix workaround. Every color returns to one
        // uniform native layout: one normal label region and one color input.
        const { prefix: _prefix, ...rest } = text;
        field.selector = { ...field.selector, text: rest };
      });

      const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
      form.computeLabel = (schema, data) => {
        if (COLOR_FIELDS.has(schema?.name)) return COLOR_LABELS[schema.name];
        return baseComputeLabel?.(schema, data) || schema?.name || "";
      };
      return form;
    };
  }

  const proto = Card.prototype;

  function state(card, entityId) {
    return entityId ? card?._hass?.states?.[entityId] || null : null;
  }

  function schedulerIds(card) {
    const cached = card?._beta10SchedulerEntities || card?._beta6SchedulerEntities || card?._beta5SchedulerEntities || {};
    const frontend = card?._mapPayload?.frontend?.entities || card?._mapPayload?.frontend_entities || {};
    return {
      status: cached.status || frontend.schedule_status || null,
      managedSwitch: cached.managedSwitch || frontend.managed_schedule || null,
      nativeSwitch: cached.nativeSwitch || frontend.native_schedule || card?._scheduleSwitchEntity?.() || null,
    };
  }

  function managedScheduleEnabled(card) {
    const ids = schedulerIds(card);
    const status = state(card, ids.status);
    if (typeof status?.attributes?.enabled === "boolean") return status.attributes.enabled;
    return String(state(card, ids.managedSwitch)?.state || "").trim().toLowerCase() === "on";
  }

  function syncCombinedScheduleButton(card) {
    const button = card?._scheduleButtonEl;
    if (!button) return;
    const nativeOn = card?._scheduleEnabled?.() === true;
    const managedOn = managedScheduleEnabled(card);
    const active = nativeOn || managedOn;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    const parts = [];
    if (nativeOn) parts.push("Native On");
    if (managedOn) parts.push("Navimower On");
    if (!parts.length) parts.push("Off");
    button.title = `Mowing schedule · ${parts.join(" · ")}`;
  }

  const previousRenderShell = proto._renderShell;
  proto._renderShell = function beta11RenderShell(...args) {
    const result = previousRenderShell?.apply(this, args);
    syncCombinedScheduleButton(this);
    return result;
  };

  // Include the managed scheduler in the lightweight live snapshot so its
  // state change invalidates the shell just like a native schedule change.
  const previousLiveSnapshot = proto._liveSnapshot;
  if (typeof previousLiveSnapshot === "function") {
    proto._liveSnapshot = function beta11LiveSnapshot(...args) {
      const snapshot = previousLiveSnapshot.apply(this, args) || {};
      const ids = schedulerIds(this);
      const managedSwitch = state(this, ids.managedSwitch);
      const status = state(this, ids.status);
      const managed = managedScheduleEnabled(this);
      return {
        ...snapshot,
        scheduleEnabled: Boolean(snapshot.scheduleEnabled === true || managed),
        scheduleUpdated: [
          snapshot.scheduleUpdated || "",
          managedSwitch?.state || "",
          managedSwitch?.last_updated || "",
          status?.attributes?.enabled ?? "",
          status?.last_updated || "",
        ].join("|"),
      };
    };
  }

  function mowerError(card) {
    const entityId = card?._mowerEntity?.() || card?._resolved?.mower_entity || card?._config?.entity || null;
    const mower = state(card, entityId);
    if (!mower) return false;
    const values = [mower.state, mower.attributes?.activity, mower.attributes?.state]
      .map((value) => String(value || "").trim().toLowerCase());
    return values.some((value) => value === "error" || value.includes("error"));
  }

  function ensureErrorPulseStyle(card) {
    if (!card || card.__beta11ErrorPulseStyle) return;
    card.__beta11ErrorPulseStyle = true;
    const style = document.createElement("style");
    style.textContent = `
      .nm-h2-mower.nm-mower-error-pulse {
        transform-box: fill-box;
        transform-origin: center;
        animation: nm-mower-error-pulse 1.15s ease-in-out infinite;
      }
      @keyframes nm-mower-error-pulse {
        0%, 100% { filter: drop-shadow(0 1px 2px rgba(0,0,0,.38)) drop-shadow(0 0 0 rgba(244,67,54,0)); }
        50% { filter: drop-shadow(0 1px 2px rgba(0,0,0,.38)) drop-shadow(0 0 13px rgba(244,67,54,.95)) drop-shadow(0 0 5px rgba(244,67,54,1)); }
      }
    `;
    card.appendChild(style);
  }

  function syncMowerErrorPulse(card) {
    ensureErrorPulseStyle(card);
    card?._mowerGroup?.classList?.toggle("nm-mower-error-pulse", mowerError(card));
  }

  const previousRenderMower = proto._renderMower;
  proto._renderMower = function beta11RenderMower(...args) {
    const result = previousRenderMower?.apply(this, args);
    syncMowerErrorPulse(this);
    return result;
  };

  const previousEnsure = proto._ensureDom;
  proto._ensureDom = function beta11EnsureDom(...args) {
    const result = previousEnsure?.apply(this, args);
    ensureErrorPulseStyle(this);
    syncCombinedScheduleButton(this);
    syncMowerErrorPulse(this);
    return result;
  };

  console.info("[Navimower Map Card] 0.3.5-beta11 color defaults, combined schedule state and mower error pulse enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied beta11 editor defaults and status visuals patch");
