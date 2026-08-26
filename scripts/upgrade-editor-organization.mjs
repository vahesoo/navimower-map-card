import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta10: organized editor groups and configurable header buttons.";
if (source.includes(marker)) {
  console.log("Editor organization patch already applied");
  process.exit(0);
}

if (!source.includes("0.3.5-beta8: native-only color labels in the visual editor.")) {
  throw new Error("Expected beta8 visual editor marker was not found");
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta10EditorOrganization) return;
  Card.__navimower035Beta10EditorOrganization = true;

  const BUTTON_FIELDS = [
    "show_history_button",
    "show_notifications_button",
    "show_schedule_button",
    "show_settings_button",
  ];
  const CUSTOM_FIELDS = [
    "show_custom_areas",
    "custom_area_fill_opacity",
    "custom_area_stroke_width",
    "custom_area_color",
  ];
  const MOVE_FIELDS = [...BUTTON_FIELDS, ...CUSTOM_FIELDS];
  const LABELS = {
    show_history_button: "Show History button",
    show_notifications_button: "Show Notifications button",
    show_schedule_button: "Show Schedule button",
    show_settings_button: "Show Settings button",
    show_custom_areas: "Show custom areas",
    custom_area_fill_opacity: "Custom area fill opacity",
    custom_area_stroke_width: "Custom area border width",
    custom_area_color: "Custom area color",
  };
  const SAFE_SWATCH_LABELS = {
    custom_area_color: "Custom area",
    vf_off_color: "VF off",
    gate_area_color: "Gate area",
  };

  const previousStub = typeof Card.getStubConfig === "function" ? Card.getStubConfig.bind(Card) : null;
  if (previousStub) {
    Card.getStubConfig = function beta10StubConfig(...args) {
      return {
        ...previousStub(...args),
        show_history_button: true,
        show_notifications_button: true,
        show_schedule_button: true,
        show_settings_button: true,
      };
    };
  }

  const proto = Card.prototype;
  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta10SetConfig(config) {
      const next = { ...config };
      for (const key of BUTTON_FIELDS) {
        if (next[key] === undefined) next[key] = true;
      }
      const result = previousSetConfig.call(this, next);
      if (next.show_history_button === false && this._historyDayOffset !== null) {
        this._historyDayOffset = null;
        this._historyMenuOpen = false;
        this._historyBarRenderKey = null;
      }
      syncHeaderVisibility(this);
      return result;
    };
  }

  function walk(items, callback, parent = null) {
    for (const item of Array.isArray(items) ? items : []) {
      callback(item, parent);
      if (Array.isArray(item?.schema)) walk(item.schema, callback, item);
    }
  }

  function collect(items, names) {
    const wanted = new Set(names);
    const found = new Map();
    walk(items, (item) => {
      if (wanted.has(item?.name) && !found.has(item.name)) found.set(item.name, item);
    });
    return found;
  }

  function remove(items, names) {
    const unwanted = new Set(names);
    for (const item of Array.isArray(items) ? items : []) {
      if (!Array.isArray(item?.schema)) continue;
      item.schema = item.schema.filter((child) => !unwanted.has(child?.name));
      remove(item.schema, names);
    }
  }

  function sectionContaining(items, fieldName) {
    let result = null;
    const search = (list, topSection = null) => {
      for (const item of Array.isArray(list) ? list : []) {
        const section = topSection || item;
        if (item?.name === fieldName) {
          result = section;
          return;
        }
        if (Array.isArray(item?.schema)) search(item.schema, section);
        if (result) return;
      }
    };
    search(items);
    return result;
  }

  function gridIn(section) {
    if (!section) return null;
    if (Array.isArray(section.schema)) {
      const directGrid = section.schema.find((item) => item?.type === "grid" && Array.isArray(item.schema));
      if (directGrid) return directGrid;
      if (section.type === "grid") return section;
    }
    return null;
  }

  function booleanField(name) {
    return { name, selector: { boolean: {} } };
  }

  function numericField(name) {
    if (name === "custom_area_fill_opacity") {
      return { name, selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } };
    }
    return { name, selector: { number: { min: 1, max: 12, step: 1, mode: "box" } } };
  }

  const previousGetConfigForm = Card.getConfigForm;
  if (typeof previousGetConfigForm === "function") {
    Card.getConfigForm = function beta10GetConfigForm(...args) {
      const form = previousGetConfigForm.apply(this, args);
      if (!form || !Array.isArray(form.schema)) return form;

      const captured = collect(form.schema, MOVE_FIELDS);
      remove(form.schema, MOVE_FIELDS);
      form.schema = form.schema.filter((item) => item?.name !== "custom_area_appearance");

      const displayed = sectionContaining(form.schema, "show_zone_labels")
        || sectionContaining(form.schema, "show_map_legend")
        || form.schema[0];
      const appearance = sectionContaining(form.schema, "trail_opacity")
        || sectionContaining(form.schema, "mower_scale")
        || form.schema.find((item) => item?.name === "appearance");
      const colors = form.schema.find((item) => item?.name === "map_colors")
        || sectionContaining(form.schema, "trail_color");

      const displayedGrid = gridIn(displayed);
      const appearanceGrid = gridIn(appearance);
      const colorsGrid = gridIn(colors);

      if (displayedGrid?.schema) {
        displayedGrid.schema.push(
          captured.get("show_custom_areas") || booleanField("show_custom_areas"),
          ...BUTTON_FIELDS.map((name) => captured.get(name) || booleanField(name)),
        );
      }
      if (appearanceGrid?.schema) {
        appearanceGrid.schema.push(
          captured.get("custom_area_fill_opacity") || numericField("custom_area_fill_opacity"),
          captured.get("custom_area_stroke_width") || numericField("custom_area_stroke_width"),
        );
      }
      if (colorsGrid?.schema) {
        colorsGrid.schema.push(
          captured.get("custom_area_color") || { name: "custom_area_color", selector: { text: { type: "color" } } },
        );
      }

      walk(form.schema, (field) => {
        const label = SAFE_SWATCH_LABELS[field?.name];
        if (!label) return;
        const text = field?.selector?.text;
        if (!text || text.type !== "color") return;
        field.selector = {
          ...field.selector,
          text: { ...text, prefix: label },
        };
      });

      const baseComputeLabel = typeof form.computeLabel === "function" ? form.computeLabel : null;
      form.computeLabel = (schema, data) => {
        if (SAFE_SWATCH_LABELS[schema?.name]) return "";
        if (LABELS[schema?.name]) return LABELS[schema.name];
        return baseComputeLabel?.(schema, data) || schema?.name || "";
      };
      return form;
    };
  }

  function syncHeaderVisibility(card) {
    if (!card?._config || !card?._domReady) return;
    const showHistory = card._config.show_history_button !== false;
    const showNotifications = card._config.show_notifications_button !== false;
    const showSchedule = card._config.show_schedule_button !== false;
    const showSettings = card._config.show_settings_button !== false;

    if (!showHistory) {
      card._historyMenuOpen = false;
      card._historyDayOffset = null;
      if (card._historyBarEl) {
        card._historyBarEl.hidden = true;
        card._historyBarEl.innerHTML = "";
      }
    }
    if (card._historyButtonEl) card._historyButtonEl.style.display = showHistory ? "" : "none";
    if (card._notificationButtonEl) card._notificationButtonEl.style.display = showNotifications ? "" : "none";
    const notification = card.querySelector?.(".nm-notification-button");
    if (notification) notification.style.display = showNotifications ? "" : "none";
    if (card._scheduleButtonEl) card._scheduleButtonEl.style.display = showSchedule ? "" : "none";
    const settings = card.querySelector?.(".nm-settings-button");
    if (settings) settings.style.display = showSettings ? "" : "none";
  }

  const previousEnsure = proto._ensureDom;
  proto._ensureDom = function beta10EnsureDom(...args) {
    const result = previousEnsure?.apply(this, args);
    syncHeaderVisibility(this);
    return result;
  };

  const previousRenderShell = proto._renderShell;
  proto._renderShell = function beta10RenderShell(...args) {
    const result = previousRenderShell?.apply(this, args);
    syncHeaderVisibility(this);
    return result;
  };

  const previousRenderHistoryBar = proto._renderHistoryBar;
  proto._renderHistoryBar = function beta10RenderHistoryBar(...args) {
    if (this._config?.show_history_button === false) {
      this._historyMenuOpen = false;
      this._historyDayOffset = null;
      if (this._historyBarEl) {
        this._historyBarEl.hidden = true;
        this._historyBarEl.innerHTML = "";
      }
      syncHeaderVisibility(this);
      return;
    }
    const result = previousRenderHistoryBar?.apply(this, args);
    syncHeaderVisibility(this);
    return result;
  };

  console.info("[Navimower Map Card] 0.3.5-beta10 organized editor controls and header visibility enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied editor organization and header visibility patch");
