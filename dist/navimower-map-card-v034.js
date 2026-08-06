/*
 * Navimower Map Card 0.3.0-beta6 editor and schedule refinements.
 *
 * Adds synchronized manual HEX fields, keeps the schedule dialog visible after
 * successful saves, and treats Home Assistant supplied card configuration as
 * immutable so frozen editor objects are never modified in place.
 */

export const NAVIMOWER_MAP_CARD_V034_VERSION = "0.3.0-beta6";
export const SCHEDULE_CLOSE_DELAY_MS = 2500;

export const COLOR_FIELDS = Object.freeze([
  Object.freeze({ key: "map_background_color", label: "Map background", defaultValue: "", allowBlank: true }),
  Object.freeze({ key: "zone_fill_color", label: "Zone fill", defaultValue: "#81C784" }),
  Object.freeze({ key: "zone_stroke_color", label: "Zone border", defaultValue: "#43A047" }),
  Object.freeze({ key: "trail_color", label: "Mowed area", defaultValue: "#43A047" }),
  Object.freeze({ key: "off_limit_color", label: "Off-limit", defaultValue: "#FF5A00" }),
  Object.freeze({ key: "vf_off_color", label: "VF-off", defaultValue: "#2F80ED" }),
  Object.freeze({ key: "channel_color", label: "Channel", defaultValue: "#686868" }),
  Object.freeze({ key: "gate_area_color", label: "Gate area", defaultValue: "#8E24AA" }),
  Object.freeze({ key: "dock_color", label: "Dock", defaultValue: "#37474F" }),
]);

export function normalizeHexColor(value, { allowBlank = false } = {}) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return allowBlank ? "" : null;
  const match = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = [...digits].map((digit) => `${digit}${digit}`).join("");
  }
  return `#${digits.toUpperCase()}`;
}

export function normalizeColorEditorConfig(config = {}, previous = {}) {
  const normalized = { ...(config || {}) };
  for (const field of COLOR_FIELDS) {
    const current = normalizeHexColor(config?.[field.key], field);
    const prior = normalizeHexColor(previous?.[field.key], field);
    normalized[field.key] = current !== null
      ? current
      : prior !== null
        ? prior
        : field.defaultValue;
  }
  return normalized;
}

function findSchema(node, name) {
  if (!node || typeof node !== "object") return null;
  if (node.name === name) return node;
  const children = Array.isArray(node.schema) ? node.schema : [];
  for (const child of children) {
    const match = findSchema(child, name);
    if (match) return match;
  }
  return null;
}

function manualHexField(field) {
  return {
    name: field.key,
    navimower_hex: true,
    selector: { text: {} },
  };
}

export function extendColorConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  const appearanceGrid = findSchema(next, "appearance_grid");
  if (appearanceGrid && Array.isArray(appearanceGrid.schema)) {
    for (const field of COLOR_FIELDS) {
      if (appearanceGrid.schema.some(
        (item) => item?.name === field.key && item?.navimower_hex === true,
      )) continue;
      const pickerIndex = appearanceGrid.schema.findIndex(
        (item) => item?.name === field.key && item?.navimower_hex !== true,
      );
      appearanceGrid.schema.splice(
        pickerIndex >= 0 ? pickerIndex + 1 : appearanceGrid.schema.length,
        0,
        manualHexField(field),
      );
    }
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  next.computeLabel = (schema) => {
    if (schema?.navimower_hex === true) {
      const field = COLOR_FIELDS.find((item) => item.key === schema?.name);
      if (field) {
        return field.allowBlank
          ? `${field.label} HEX (blank = theme)`
          : `${field.label} HEX`;
      }
    }
    return originalComputeLabel?.(schema) || schema?.name || "";
  };
  return next;
}

export function scheduleSaveSucceeded(card) {
  const dirty = (card?._scheduleDraft || []).some(
    (day) => day?._dirty || day?._saving,
  );
  const failed = Object.values(card?._scheduleStatus || {}).some(
    (status) => status?.kind === "error",
  );
  return !dirty && !failed;
}

function patchScheduleCloseDelay(proto) {
  const currentSaveAll = proto?._saveAllScheduleChanges;
  if (typeof currentSaveAll !== "function") return;

  proto._saveAllScheduleChanges = async function delayedScheduleDialogClose(...args) {
    if (this._v034ScheduleCloseTimer) {
      clearTimeout(this._v034ScheduleCloseTimer);
      this._v034ScheduleCloseTimer = null;
    }

    const renderDialog = this._renderDialog;
    let suppressedSuccessfulClose = false;
    if (typeof renderDialog === "function") {
      this._renderDialog = (...renderArgs) => {
        if (this._scheduleDialogOpen === false) {
          suppressedSuccessfulClose = true;
          return undefined;
        }
        return renderDialog.apply(this, renderArgs);
      };
    }

    let result;
    try {
      result = await currentSaveAll.apply(this, args);
    } finally {
      if (typeof renderDialog === "function") this._renderDialog = renderDialog;
    }

    if (suppressedSuccessfulClose && scheduleSaveSucceeded(this)) {
      this._scheduleDialogOpen = true;
      renderDialog?.call(this);
      this._v034ScheduleCloseTimer = setTimeout(() => {
        this._v034ScheduleCloseTimer = null;
        if (!this._scheduleDialogOpen || !scheduleSaveSucceeded(this)) return;
        this._scheduleDialogOpen = false;
        renderDialog?.call(this);
      }, SCHEDULE_CLOSE_DELAY_MS);
    }
    return result;
  };
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV034Patched) return;
  Card.__navimowerV034Patched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function colorStubConfig() {
    return normalizeColorEditorConfig(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function colorConfigForm() {
    return extendColorConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function colorSetConfig(config) {
      const normalized = normalizeColorEditorConfig(config, this._config || {});
      return originalSetConfig.call(this, normalized);
    };
  }

  patchScheduleCloseDelay(proto);

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function colorDisconnectedCallback(...args) {
    if (this._v034ScheduleCloseTimer) {
      clearTimeout(this._v034ScheduleCloseTimer);
      this._v034ScheduleCloseTimer = null;
    }
    return originalDisconnected?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.0-beta6 immutable editor config handling enabled");
}

if (globalThis.customElements) patchCard();
