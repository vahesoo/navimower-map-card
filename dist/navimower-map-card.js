/*
 * Navimower Map Card
 * Version 0.1.0
 *
 * Private-cloud Navimower map geometry with live MQTT position, trail,
 * channels, sessions, visual configuration, and touch-friendly zoom/pan.
 * No external JavaScript dependencies.
 */

const NAVIMOWER_MAP_CARD_VERSION = "0.1.0";
const VIEW_SIZE = 1000;
const DEFAULTS = Object.freeze({
  title: "Navimower Map",
  entity: null,
  mower_entity: null,
  auto_entities: true,
  map_entity: null,
  x_entity: null,
  y_entity: null,
  heading_entity: null,
  status_entity: null,
  battery_entity: null,
  zone_entity: null,
  trail_length: 10000,
  session_count: 6,
  show_status: true,
  show_zone: true,
  show_battery: true,
  show_position: false,
  show_zone_labels: true,
  show_channels: true,
  show_tunnels: true,
  show_map_legend: true,
  show_session_legend: true,
  enable_zoom: true,
  initial_zoom: 1,
  initial_focus: "map",
  remember_view: false,
  max_zoom: 8,
  zone_fill_color: "#81c784",
  zone_fill_opacity: 0.22,
  zone_stroke_color: "#43a047",
  trail_color: "#43a047",
  trail_opacity: 0.4,
  obstacle_color: "#616161",
  no_mow_color: "#bdbdbd",
  channel_color: "#8e24aa",
  tunnel_color: "#039be5",
  mower_body_color: "#263238",
  mower_accent_color: "#ff6d00",
  dock_color: "#37474f",
  map_legend_opacity: 0.58,
  zone_label_font_size: 20,
  mower_scale: 1,
  dock_scale: 1,
});

const LABELS = Object.freeze({
  title: "Title",
  entity: "Mower entity",
  auto_entities: "Auto-detect related Navimower entities",
  show_status: "Show status",
  show_zone: "Show physical zone",
  show_battery: "Show battery",
  show_position: "Show X/Y position",
  show_zone_labels: "Show zone labels",
  show_channels: "Show channels",
  show_tunnels: "Show tunnels",
  show_map_legend: "Show map legend",
  show_session_legend: "Show session times",
  session_count: "Maximum sessions shown",
  enable_zoom: "Enable zoom and pan",
  initial_zoom: "Initial zoom",
  initial_focus: "Initial focus",
  remember_view: "Remember last view in this browser",
  max_zoom: "Maximum zoom",
  map_legend_opacity: "Map legend background opacity",
  zone_label_font_size: "Zone label font size",
  mower_scale: "Mower marker scale",
  dock_scale: "Dock marker scale",
  zone_fill_color: "Zone fill color",
  zone_fill_opacity: "Zone fill opacity",
  zone_stroke_color: "Zone border color",
  trail_color: "Trail color",
  trail_opacity: "Trail opacity",
  obstacle_color: "Obstacle color",
  no_mow_color: "No-mow color",
  channel_color: "Channel color",
  tunnel_color: "Tunnel color",
  mower_body_color: "Mower body color",
  mower_accent_color: "Mower accent color",
  dock_color: "Dock color",
  map_entity: "Map data sensor",
  x_entity: "Position X sensor",
  y_entity: "Position Y sensor",
  heading_entity: "Heading sensor",
  status_entity: "Mower status entity",
  battery_entity: "Battery sensor",
  zone_entity: "Current physical zone sensor",
  trail_length: "Maximum trail points",
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBoolean(value, fallback) {
  return value === undefined || value === null ? fallback : Boolean(value);
}

function entityObjectId(entityId) {
  if (!entityId || typeof entityId !== "string" || !entityId.includes(".")) return null;
  return entityId.split(".").slice(1).join(".");
}

function dateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

class NavimowerMapCard extends HTMLElement {
  static getStubConfig() {
    return {
      entity: "",
      title: DEFAULTS.title,
      auto_entities: DEFAULTS.auto_entities,
      show_status: DEFAULTS.show_status,
      show_zone: DEFAULTS.show_zone,
      show_battery: DEFAULTS.show_battery,
      show_position: DEFAULTS.show_position,
      show_zone_labels: DEFAULTS.show_zone_labels,
      show_channels: DEFAULTS.show_channels,
      show_tunnels: DEFAULTS.show_tunnels,
      show_map_legend: DEFAULTS.show_map_legend,
      show_session_legend: DEFAULTS.show_session_legend,
      session_count: DEFAULTS.session_count,
      enable_zoom: DEFAULTS.enable_zoom,
      initial_zoom: DEFAULTS.initial_zoom,
      initial_focus: DEFAULTS.initial_focus,
      remember_view: DEFAULTS.remember_view,
      max_zoom: DEFAULTS.max_zoom,
      map_legend_opacity: DEFAULTS.map_legend_opacity,
      zone_label_font_size: DEFAULTS.zone_label_font_size,
      zone_fill_color: DEFAULTS.zone_fill_color,
      zone_fill_opacity: DEFAULTS.zone_fill_opacity,
      zone_stroke_color: DEFAULTS.zone_stroke_color,
      trail_color: DEFAULTS.trail_color,
      trail_opacity: DEFAULTS.trail_opacity,
      obstacle_color: DEFAULTS.obstacle_color,
      no_mow_color: DEFAULTS.no_mow_color,
      channel_color: DEFAULTS.channel_color,
      tunnel_color: DEFAULTS.tunnel_color,
      mower_body_color: DEFAULTS.mower_body_color,
      mower_accent_color: DEFAULTS.mower_accent_color,
      dock_color: DEFAULTS.dock_color,
      mower_scale: DEFAULTS.mower_scale,
      dock_scale: DEFAULTS.dock_scale,
      trail_length: DEFAULTS.trail_length,
    };
  }

  static getConfigForm() {
    const entitySelector = (domain) => ({ entity: domain ? { domain } : {} });
    const colorField = (name) => ({ name, selector: { text: {} } });
    return {
      schema: [
        {
          type: "grid",
          name: "general",
          flatten: true,
          column_min_width: "220px",
          schema: [
            { name: "entity", required: true, selector: entitySelector("lawn_mower") },
            { name: "title", selector: { text: {} } },
            { name: "auto_entities", selector: { boolean: {} } },
          ],
        },
        {
          type: "expandable",
          name: "display",
          title: "Displayed information",
          flatten: true,
          schema: [
            {
              type: "grid",
              name: "display_grid",
              flatten: true,
              column_min_width: "200px",
              schema: [
                { name: "show_status", selector: { boolean: {} } },
                { name: "show_zone", selector: { boolean: {} } },
                { name: "show_battery", selector: { boolean: {} } },
                { name: "show_position", selector: { boolean: {} } },
                { name: "show_zone_labels", selector: { boolean: {} } },
                { name: "show_channels", selector: { boolean: {} } },
                { name: "show_tunnels", selector: { boolean: {} } },
                { name: "show_map_legend", selector: { boolean: {} } },
                { name: "show_session_legend", selector: { boolean: {} } },
                { name: "session_count", selector: { number: { min: 1, max: 24, step: 1, mode: "box" } } },
              ],
            },
          ],
        },
        {
          type: "expandable",
          name: "zoom",
          title: "Zoom and initial view",
          flatten: true,
          schema: [
            {
              type: "grid",
              name: "zoom_grid",
              flatten: true,
              column_min_width: "200px",
              schema: [
                { name: "enable_zoom", selector: { boolean: {} } },
                { name: "initial_zoom", selector: { number: { min: 1, max: 8, step: 0.1, mode: "box" } } },
                {
                  name: "initial_focus",
                  selector: {
                    select: {
                      options: [
                        { value: "map", label: "Whole map" },
                        { value: "mower", label: "Mower" },
                        { value: "dock", label: "Charging station" },
                      ],
                    },
                  },
                },
                { name: "remember_view", selector: { boolean: {} } },
                { name: "max_zoom", selector: { number: { min: 2, max: 16, step: 1, mode: "box" } } },
              ],
            },
          ],
        },
        {
          type: "expandable",
          name: "appearance",
          title: "Appearance",
          flatten: true,
          schema: [
            {
              type: "grid",
              name: "appearance_grid",
              flatten: true,
              column_min_width: "200px",
              schema: [
                { name: "map_legend_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
                { name: "zone_label_font_size", selector: { number: { min: 12, max: 36, step: 1, mode: "box" } } },
                { name: "zone_fill_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
                { name: "trail_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },
                { name: "mower_scale", selector: { number: { min: 0.5, max: 2.5, step: 0.1, mode: "box" } } },
                { name: "dock_scale", selector: { number: { min: 0.5, max: 2.5, step: 0.1, mode: "box" } } },
                colorField("zone_fill_color"),
                colorField("zone_stroke_color"),
                colorField("trail_color"),
                colorField("obstacle_color"),
                colorField("no_mow_color"),
                colorField("channel_color"),
                colorField("tunnel_color"),
                colorField("mower_body_color"),
                colorField("mower_accent_color"),
                colorField("dock_color"),
              ],
            },
          ],
        },
        {
          type: "expandable",
          name: "advanced",
          title: "Advanced entity overrides",
          flatten: true,
          schema: [
            { name: "map_entity", selector: entitySelector("sensor") },
            { name: "x_entity", selector: entitySelector("sensor") },
            { name: "y_entity", selector: entitySelector("sensor") },
            { name: "heading_entity", selector: entitySelector("sensor") },
            { name: "status_entity", selector: entitySelector("lawn_mower") },
            { name: "battery_entity", selector: entitySelector("sensor") },
            { name: "zone_entity", selector: entitySelector("sensor") },
            { name: "trail_length", selector: { number: { min: 100, max: 50000, step: 100, mode: "box" } } },
          ],
        },
      ],
      computeLabel: (schema) => LABELS[schema.name] || schema.name || "",
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._resolved = {};
    this._resolutionKey = null;
    this._resolutionPromise = null;
    this._mapPayload = null;
    this._mapKey = null;
    this._loadingMap = false;
    this._loadError = null;
    this._failedMapKey = null;
    this._retryAfter = 0;
    this._layout = null;
    this._trail = [];
    this._trailSession = null;
    this._lastPointKey = null;
    this._sessionFirstSeen = null;
    this._view = { scale: 1, cx: VIEW_SIZE / 2, cy: VIEW_SIZE / 2 };
    this._initialViewApplied = false;
    this._pointers = new Map();
    this._panStart = null;
    this._pinchStart = null;
    this._domReady = false;
  }

  setConfig(config) {
    if (!config || !(config.entity || config.mower_entity || config.status_entity || config.map_entity)) {
      throw new Error("Navimower Map Card: select a mower entity");
    }
    const previousEntity = this._config?.entity || this._config?.mower_entity || this._config?.status_entity;
    const incoming = { ...config };
    if (!incoming.entity && incoming.mower_entity) incoming.entity = incoming.mower_entity;
    this._config = { ...DEFAULTS, ...incoming };
    this._config.auto_entities = normalizeBoolean(incoming.auto_entities, DEFAULTS.auto_entities);
    this._resolutionKey = null;
    this._resolved = {};
    this._mapKey = null;
    this._layout = null;
    this._initialViewApplied = false;
    if (previousEntity !== this._config.entity) {
      this._mapPayload = null;
      this._trail = [];
      this._trailSession = null;
      this._lastPointKey = null;
    }
    this._ensureDom();
    this._renderShell();
    if (this._hass) {
      this._resolveEntities();
      this._maybeLoadMap();
      this._updateLive();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._ensureDom();
    this._resolveEntities();
    this._maybeLoadMap();
    this._updateLive();
  }

  getCardSize() {
    return this._config?.show_session_legend === false ? 7 : 8;
  }

  getGridOptions() {
    return {
      rows: 8,
      columns: 6,
      min_rows: 5,
      min_columns: 3,
    };
  }

  disconnectedCallback() {
    this._pointers.clear();
    this._panStart = null;
    this._pinchStart = null;
  }

  _ensureDom() {
    if (this._domReady) return;
    this.innerHTML = `
      <ha-card>
        <div class="nm-header"><div class="nm-title"></div></div>
        <div class="nm-wrap">
          <svg class="nm-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="Navimower map">
            <g class="nm-static"></g>
            <g class="nm-history"></g>
            <g class="nm-trail"></g>
            <g class="nm-dynamic"></g>
            <g class="nm-message"></g>
          </svg>
          <div class="nm-zoom-controls">
            <button type="button" class="nm-zoom-in" aria-label="Zoom in" title="Zoom in"><ha-icon icon="mdi:plus"></ha-icon></button>
            <button type="button" class="nm-zoom-out" aria-label="Zoom out" title="Zoom out"><ha-icon icon="mdi:minus"></ha-icon></button>
            <button type="button" class="nm-zoom-reset" aria-label="Reset map view" title="Reset map view"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button>
          </div>
        </div>
        <div class="nm-footer"></div>
        <div class="nm-sessions"></div>
      </ha-card>
      <style>
        :host { display: block; }
        ha-card { padding: 12px; overflow: hidden; }
        .nm-header { display: flex; align-items: center; min-height: 26px; margin: 0 2px 8px; }
        .nm-title { font-size: 1.05rem; font-weight: 600; color: var(--primary-text-color); }
        .nm-wrap { position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden;
          border-radius: 10px; background: var(--secondary-background-color); }
        .nm-map { width: 100%; height: 100%; display: block; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
        .nm-zoom-controls { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column;
          gap: 6px; z-index: 2; }
        .nm-zoom-controls button { width: 36px; height: 36px; border: 0; border-radius: 10px;
          display: grid; place-items: center; cursor: pointer; color: var(--primary-text-color);
          background: color-mix(in srgb, var(--card-background-color) 78%, transparent);
          box-shadow: 0 1px 4px rgba(0,0,0,.22); backdrop-filter: blur(3px); }
        .nm-zoom-controls button:active { transform: scale(.96); }
        .nm-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 9px 2px 0;
          color: var(--secondary-text-color); font-size: .92rem; }
        .nm-footer .nm-value { color: var(--primary-text-color); font-weight: 600; }
        .nm-footer button { appearance: none; border: 0; padding: 0; margin: 0; background: none;
          color: inherit; font: inherit; cursor: pointer; }
        .nm-sessions { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 8px 2px 0;
          color: var(--secondary-text-color); font-size: .84rem; }
        .nm-session { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .nm-session-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
        .nm-session-note { opacity: .75; }
        @media (max-width: 480px) {
          ha-card { padding: 10px; }
          .nm-zoom-controls button { width: 34px; height: 34px; }
          .nm-footer { font-size: .88rem; gap: 5px 11px; }
          .nm-sessions { font-size: .81rem; }
        }
      </style>`;

    this._titleEl = this.querySelector(".nm-title");
    this._svgEl = this.querySelector(".nm-map");
    this._staticEl = this.querySelector(".nm-static");
    this._historyEl = this.querySelector(".nm-history");
    this._trailEl = this.querySelector(".nm-trail");
    this._dynamicEl = this.querySelector(".nm-dynamic");
    this._messageEl = this.querySelector(".nm-message");
    this._footerEl = this.querySelector(".nm-footer");
    this._sessionsEl = this.querySelector(".nm-sessions");
    this._zoomControlsEl = this.querySelector(".nm-zoom-controls");

    this.querySelector(".nm-zoom-in")?.addEventListener("click", () => this._zoomAtCenter(1.35));
    this.querySelector(".nm-zoom-out")?.addEventListener("click", () => this._zoomAtCenter(1 / 1.35));
    this.querySelector(".nm-zoom-reset")?.addEventListener("click", () => this._applyInitialView(true));
    this._svgEl?.addEventListener("wheel", (event) => this._onWheel(event), { passive: false });
    this._svgEl?.addEventListener("dblclick", (event) => {
      if (!this._config?.enable_zoom) return;
      event.preventDefault();
      this._applyInitialView(true);
    });
    this._svgEl?.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this._svgEl?.addEventListener("pointermove", (event) => this._onPointerMove(event));
    this._svgEl?.addEventListener("pointerup", (event) => this._onPointerUp(event));
    this._svgEl?.addEventListener("pointercancel", (event) => this._onPointerUp(event));
    this._domReady = true;
  }

  _renderShell() {
    if (!this._domReady || !this._config) return;
    this._titleEl.textContent = this._config.title || "";
    this._titleEl.parentElement.style.display = this._config.title ? "flex" : "none";
    this._zoomControlsEl.style.display = this._config.enable_zoom ? "flex" : "none";
    this._sessionsEl.style.display = this._config.show_session_legend ? "flex" : "none";
    this._syncTouchAction();
  }

  _state(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : null;
  }

  _number(entityId) {
    const state = this._state(entityId);
    if (!state || ["unknown", "unavailable", "none", ""].includes(state.state)) return null;
    return finiteNumber(state.state);
  }

  _text(entityId, fallback = "—") {
    const state = this._state(entityId);
    if (!state || ["unknown", "unavailable", "none", ""].includes(state.state)) return fallback;
    return state.state;
  }

  _explicitEntities() {
    const c = this._config || {};
    return {
      mower_entity: c.entity || c.mower_entity || c.status_entity || null,
      status_entity: c.status_entity || c.entity || c.mower_entity || null,
      map_entity: c.map_entity || null,
      x_entity: c.x_entity || null,
      y_entity: c.y_entity || null,
      heading_entity: c.heading_entity || null,
      battery_entity: c.battery_entity || null,
      zone_entity: c.zone_entity || null,
    };
  }

  _resolveEntities() {
    if (!this._config || !this._hass) return;
    const mower = this._config.entity || this._config.mower_entity || this._config.status_entity || "";
    const key = [mower, this._config.auto_entities, this._config.map_entity, this._config.x_entity,
      this._config.y_entity, this._config.heading_entity, this._config.battery_entity,
      this._config.zone_entity].join("|");
    if (key === this._resolutionKey) return;
    this._resolutionKey = key;
    this._resolved = this._resolveEntitiesByName(this._explicitEntities());
    if (!this._config.auto_entities || !mower || !this._hass.callWS) return;
    this._resolutionPromise = this._resolveEntitiesFromRegistry(mower, key);
  }

  _resolveEntitiesByName(base) {
    const result = { ...base };
    if (!this._config?.auto_entities || !this._hass) return result;
    const mowerId = entityObjectId(result.mower_entity);
    if (!mowerId) return result;
    const candidates = {
      map_entity: [`sensor.${mowerId}_map_data`, `sensor.${mowerId.replace(/_mower$/, "")}_map_data`],
      x_entity: [`sensor.${mowerId}_position_x`, `sensor.${mowerId.replace(/_mower$/, "")}_position_x`],
      y_entity: [`sensor.${mowerId}_position_y`, `sensor.${mowerId.replace(/_mower$/, "")}_position_y`],
      heading_entity: [`sensor.${mowerId}_heading`, `sensor.${mowerId.replace(/_mower$/, "")}_heading`],
      battery_entity: [`sensor.${mowerId}_battery`, `sensor.${mowerId.replace(/_mower$/, "")}_battery`],
      zone_entity: [`sensor.${mowerId}_current_physical_zone`, `sensor.${mowerId.replace(/_mower$/, "")}_current_physical_zone`],
    };
    for (const [key, list] of Object.entries(candidates)) {
      if (result[key]) continue;
      result[key] = list.find((entityId) => this._hass.states[entityId]) || null;
    }
    return result;
  }

  async _resolveEntitiesFromRegistry(mowerEntity, resolutionKey) {
    try {
      const registry = await this._hass.callWS({ type: "config/entity_registry/list" });
      if (resolutionKey !== this._resolutionKey || !Array.isArray(registry)) return;
      const mowerEntry = registry.find((entry) => entry.entity_id === mowerEntity);
      if (!mowerEntry?.device_id) return;
      const related = registry.filter((entry) => entry.device_id === mowerEntry.device_id && !entry.disabled_by);
      const suffixes = {
        map_entity: ["_map_data", ".map_data"],
        x_entity: ["_position_x", ".position_x"],
        y_entity: ["_position_y", ".position_y"],
        heading_entity: ["_heading", ".heading"],
        battery_entity: ["_battery", ".battery"],
        zone_entity: ["_current_physical_zone", ".current_physical_zone"],
      };
      const resolved = { ...this._resolved };
      for (const [key, patterns] of Object.entries(suffixes)) {
        if (this._config[key]) continue;
        const match = related.find((entry) => {
          const entityId = String(entry.entity_id || "");
          const uniqueId = String(entry.unique_id || "");
          return patterns.some((pattern) => entityId.endsWith(pattern) || uniqueId.endsWith(pattern));
        });
        if (match) resolved[key] = match.entity_id;
      }
      resolved.mower_entity = mowerEntity;
      resolved.status_entity = this._config.status_entity || mowerEntity;
      this._resolved = resolved;
      this._mapKey = null;
      this._maybeLoadMap();
      this._updateLive();
    } catch (error) {
      console.debug("[Navimower Map Card] Entity registry auto-detection failed", error);
    }
  }

  _apiPath() {
    const mapState = this._state(this._resolved.map_entity);
    if (mapState?.attributes?.api_path) return mapState.attributes.api_path;
    const mowerState = this._state(this._resolved.mower_entity || this._resolved.status_entity);
    return mowerState?.attributes?.map_api_path || null;
  }

  async _maybeLoadMap() {
    if (!this._config || !this._hass || this._loadingMap) return;
    const apiPath = this._apiPath();
    if (!apiPath) {
      const mapEntity = this._resolved.map_entity || this._config.map_entity;
      this._loadError = mapEntity
        ? `Map entity has no api_path attribute: ${mapEntity}`
        : "Waiting for Navimower map entity auto-detection";
      this._renderMessage();
      return;
    }
    const mapState = this._state(this._resolved.map_entity);
    const attrs = mapState?.attributes || {};
    const key = [apiPath, attrs.map_version, attrs.map_modified_count, attrs.trail_session, mapState?.state].join("|");
    if (key === this._mapKey) return;
    if (key === this._failedMapKey && Date.now() < this._retryAfter) return;

    this._loadingMap = true;
    this._loadError = null;
    this._renderMessage();
    try {
      const path = String(apiPath).replace(/^\/api\//, "").replace(/^\/+/, "");
      const payload = await this._hass.callApi("GET", path);
      const nextPayload = payload || {};
      const payloadSession = finiteNumber(nextPayload.trail_session, finiteNumber(attrs.trail_session, 0));
      const backendTrail = this._normalizePoints(nextPayload.trail);
      if (this._trailSession === null || payloadSession !== this._trailSession) {
        this._trail = backendTrail;
        this._trailSession = payloadSession;
        this._lastPointKey = null;
        const last = this._trail.at(-1);
        if (last) this._lastPointKey = `${last[0].toFixed(3)},${last[1].toFixed(3)}`;
        this._loadSessionFirstSeen(nextPayload, attrs);
      } else if (!this._trail.length && backendTrail.length) {
        this._trail = backendTrail;
      }
      this._trimTrail();
      this._mapPayload = nextPayload;
      this._mapKey = key;
      this._failedMapKey = null;
      this._retryAfter = 0;
      this._buildLayout();
      this._renderStatic();
      this._renderHistory();
      this._initialViewApplied = false;
      this._applyInitialView(false);
    } catch (error) {
      this._loadError = `Map load failed: ${error?.message || error}`;
      this._failedMapKey = key;
      this._retryAfter = Date.now() + 30000;
    } finally {
      this._loadingMap = false;
      this._renderAllDynamic();
    }
  }

  _normalizePoints(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) => [Number(point[0]), Number(point[1])])
      .filter((point) => point.every(Number.isFinite));
  }

  _loadSessionFirstSeen(payload, attrs) {
    const explicit = payload.trail_started_at || payload.session_started_at || attrs.trail_started_at || attrs.session_started_at;
    const explicitDate = dateValue(explicit);
    if (explicitDate) {
      this._sessionFirstSeen = explicitDate.toISOString();
      return;
    }
    const storageKey = this._sessionStorageKey();
    if (!storageKey) {
      this._sessionFirstSeen = new Date().toISOString();
      return;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      const storedDate = dateValue(stored);
      if (storedDate) {
        this._sessionFirstSeen = storedDate.toISOString();
        return;
      }
      this._sessionFirstSeen = new Date().toISOString();
      localStorage.setItem(storageKey, this._sessionFirstSeen);
    } catch (_error) {
      this._sessionFirstSeen = new Date().toISOString();
    }
  }

  _sessionStorageKey() {
    const apiPath = this._apiPath();
    if (!apiPath || this._trailSession === null) return null;
    return `navimower-map-card:session:${apiPath}:${this._trailSession}`;
  }

  _viewStorageKey() {
    const identity = this._apiPath() || this._resolved.mower_entity || this._config?.entity;
    return identity ? `navimower-map-card:view:${identity}` : null;
  }

  _buildLayout() {
    if (!this._mapPayload) {
      this._layout = null;
      return;
    }
    const map = this._mapPayload.map || {};
    const zones = Array.isArray(map.zones) ? map.zones : [];
    const obstacles = Array.isArray(map.obstacles) ? map.obstacles : [];
    const noMow = Array.isArray(map.vision_off) ? map.vision_off : [];
    const tunnels = Array.isArray(map.tunnels) ? map.tunnels : [];
    const channels = Array.isArray(this._mapPayload.channels) ? this._mapPayload.channels : [];
    const station = map.station || null;
    const stable = [];
    zones.forEach((zone) => (zone.polygon || []).forEach((point) => stable.push(point)));
    obstacles.forEach((polygon) => polygon.forEach((point) => stable.push(point)));
    noMow.forEach((polygon) => polygon.forEach((point) => stable.push(point)));
    tunnels.forEach((tunnel) => (tunnel.points || []).forEach((point) => stable.push(point)));
    if (this._config.show_channels) {
      channels.forEach((channel) => {
        stable.push([channel.x_min, channel.y_min], [channel.x_min, channel.y_max],
          [channel.x_max, channel.y_min], [channel.x_max, channel.y_max]);
      });
    }
    if (station && Number.isFinite(Number(station.x)) && Number.isFinite(Number(station.y))) {
      stable.push([Number(station.x), Number(station.y)]);
    }
    const valid = stable
      .map((point) => [Number(point?.[0]), Number(point?.[1])])
      .filter((point) => point.every(Number.isFinite));
    if (!valid.length) {
      this._layout = null;
      return;
    }
    const xs = valid.map((point) => point[0]);
    const ys = valid.map((point) => point[1]);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    let spanX = Math.max(maxX - minX, 0.1);
    let spanY = Math.max(maxY - minY, 0.1);
    minX -= spanX * 0.05;
    maxX += spanX * 0.05;
    minY -= spanY * 0.05;
    maxY += spanY * 0.05;
    spanX = maxX - minX;
    spanY = maxY - minY;
    const scale = Math.min(VIEW_SIZE / spanX, VIEW_SIZE / spanY);
    const offsetX = (VIEW_SIZE - spanX * scale) / 2;
    const offsetY = (VIEW_SIZE - spanY * scale) / 2;
    this._layout = {
      map,
      zones,
      obstacles,
      noMow,
      tunnels,
      channels,
      station,
      scale,
      sx: (worldX) => offsetX + (worldX - minX) * scale,
      sy: (worldY) => offsetY + (maxY - worldY) * scale,
    };
  }

  _pointString(points) {
    if (!this._layout) return "";
    return points
      .map((point) => `${this._layout.sx(Number(point[0])).toFixed(1)},${this._layout.sy(Number(point[1])).toFixed(1)}`)
      .join(" ");
  }

  _renderStatic() {
    if (!this._staticEl) return;
    if (!this._layout) {
      this._staticEl.innerHTML = "";
      return;
    }
    const c = this._config;
    const { zones, obstacles, noMow, tunnels, channels, station, scale, sx, sy } = this._layout;
    const coverage = new Map();
    for (const item of this._mapPayload?.coverage?.zones || []) {
      coverage.set(Number(item.id), item.pct);
    }
    const out = [`<rect width="${VIEW_SIZE}" height="${VIEW_SIZE}" fill="var(--secondary-background-color)"/>`];
    const labels = [];
    for (const zone of zones) {
      const polygon = zone.polygon || [];
      if (polygon.length < 3) continue;
      out.push(`<polygon points="${this._pointString(polygon)}" fill="${escapeHtml(c.zone_fill_color)}" fill-opacity="${clamp(finiteNumber(c.zone_fill_opacity, .22), 0, 1)}" stroke="none"/>`);
      out.push(this._perimeter(polygon, zone.boundary_flags || []));
      if (c.show_zone_labels) {
        const cx = polygon.reduce((sum, point) => sum + sx(Number(point[0])), 0) / polygon.length;
        const cy = polygon.reduce((sum, point) => sum + sy(Number(point[1])), 0) / polygon.length;
        const pct = coverage.get(Number(zone.id));
        const name = zone.name || `Zone ${zone.id}`;
        labels.push([cx, cy, pct === undefined || pct === null ? name : `${name} · ${pct}%`]);
      }
    }
    obstacles.forEach((polygon) => {
      if (polygon.length >= 3) out.push(`<polygon points="${this._pointString(polygon)}" fill="${escapeHtml(c.obstacle_color)}" fill-opacity=".72" stroke="color-mix(in srgb, ${escapeHtml(c.obstacle_color)} 75%, black)" stroke-width="2"/>`);
    });
    noMow.forEach((polygon) => {
      if (polygon.length >= 3) out.push(`<polygon points="${this._pointString(polygon)}" fill="${escapeHtml(c.no_mow_color)}" fill-opacity=".34" stroke="color-mix(in srgb, ${escapeHtml(c.no_mow_color)} 70%, black)" stroke-width="2" stroke-dasharray="9 6"/>`);
    });
    if (c.show_tunnels) {
      tunnels.forEach((tunnel) => {
        const points = tunnel.points || [];
        if (points.length >= 2) {
          out.push(`<polyline points="${this._pointString(points)}" fill="none" stroke="${escapeHtml(c.tunnel_color)}" stroke-width="${Math.max(4, scale * .35).toFixed(1)}" stroke-opacity=".48" stroke-linecap="round" stroke-dasharray="12 8"/>`);
        }
      });
    }
    if (c.show_channels) {
      channels.forEach((channel) => {
        const x1 = sx(Number(channel.x_min));
        const x2 = sx(Number(channel.x_max));
        const y1 = sy(Number(channel.y_max));
        const y2 = sy(Number(channel.y_min));
        out.push(`<rect x="${Math.min(x1, x2).toFixed(1)}" y="${Math.min(y1, y2).toFixed(1)}" width="${Math.abs(x2 - x1).toFixed(1)}" height="${Math.abs(y2 - y1).toFixed(1)}" fill="${escapeHtml(c.channel_color)}" fill-opacity=".14" stroke="${escapeHtml(c.channel_color)}" stroke-width="3" stroke-dasharray="10 6"/>`);
        out.push(this._label((x1 + x2) / 2, Math.min(y1, y2) + 24, channel.name || "Channel", 19));
      });
    }
    if (station && Number.isFinite(Number(station.x)) && Number.isFinite(Number(station.y))) {
      out.push(this._station(sx(Number(station.x)), sy(Number(station.y))));
    }
    labels.forEach(([cx, cy, label]) => out.push(this._pill(cx, cy, label)));
    if (c.show_map_legend) out.push(this._legend(channels.length > 0, tunnels.length > 0));
    this._staticEl.innerHTML = out.join("");
  }

  _perimeter(polygon, flags) {
    const count = polygon.length;
    if (count < 2 || !this._layout) return "";
    const pairs = [];
    for (let index = 0; index < count - 1; index += 1) pairs.push([index, index + 1]);
    if (polygon[0][0] !== polygon[count - 1][0] || polygon[0][1] !== polygon[count - 1][1]) {
      pairs.push([count - 1, 0]);
    }
    return pairs.map(([a, b]) => {
      const solid = Number(flags[a]) === 2;
      const p1 = polygon[a];
      const p2 = polygon[b];
      return `<line x1="${this._layout.sx(Number(p1[0])).toFixed(1)}" y1="${this._layout.sy(Number(p1[1])).toFixed(1)}" x2="${this._layout.sx(Number(p2[0])).toFixed(1)}" y2="${this._layout.sy(Number(p2[1])).toFixed(1)}" stroke="${escapeHtml(this._config.zone_stroke_color)}" stroke-width="3" stroke-linecap="round"${solid ? "" : ' stroke-dasharray="10 7"'}/>`;
    }).join("");
  }

  _sessionRecords() {
    const rawSessions = Array.isArray(this._mapPayload?.sessions) ? this._mapPayload.sessions : [];
    const normalized = rawSessions.map((session, index) => ({
      id: session.id ?? session.session_id ?? index,
      started_at: session.started_at || session.start || session.start_time || null,
      ended_at: session.ended_at || session.end || session.end_time || null,
      active: Boolean(session.active || session.ended_at === null && session.started_at),
      points: this._normalizePoints(session.points || session.trail),
    })).filter((session) => session.started_at || session.points.length);
    if (!normalized.length && (this._trail.length || this._mapPayload?.trail_active)) {
      normalized.push({
        id: this._trailSession ?? 0,
        started_at: this._mapPayload?.trail_started_at || this._mapPayload?.session_started_at || this._sessionFirstSeen,
        ended_at: this._mapPayload?.trail_ended_at || null,
        active: Boolean(this._mapPayload?.trail_active ?? true),
        points: this._trail,
        approximate: !(this._mapPayload?.trail_started_at || this._mapPayload?.session_started_at),
      });
    }
    return normalized.slice(-Math.max(1, Number(this._config.session_count) || 6));
  }

  _renderHistory() {
    if (!this._historyEl || !this._layout) return;
    const sessions = this._sessionRecords();
    const drawable = sessions.filter((session) => !session.active && session.points.length >= 2);
    const width = Math.min(Math.max(.25 * this._layout.scale, 5), 28);
    this._historyEl.innerHTML = drawable.map((session, index) => {
      const opacity = clamp(0.16 + (index / Math.max(1, drawable.length - 1)) * 0.14, 0.16, 0.3);
      return `<polyline points="${this._pointString(session.points)}" fill="none" stroke="${escapeHtml(this._config.trail_color)}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity.toFixed(2)}"/>`;
    }).join("");
  }

  _updateLive() {
    if (!this._config || !this._hass) return;
    const x = this._number(this._resolved.x_entity);
    const y = this._number(this._resolved.y_entity);
    const mapState = this._state(this._resolved.map_entity);
    const mapAttrs = mapState?.attributes || {};
    const status = this._text(this._resolved.status_entity, this._mapPayload?.activity || "unknown");
    const normalizedStatus = String(status || "").toLowerCase();
    const trailActive = mapAttrs.trail_active === true
      || this._mapPayload?.trail_active === true
      || normalizedStatus === "mowing"
      || normalizedStatus.includes("edge mow");

    if (trailActive && x !== null && y !== null) {
      const key = `${x.toFixed(3)},${y.toFixed(3)}`;
      if (key !== this._lastPointKey) {
        const previous = this._trail.at(-1);
        if (!previous || Math.hypot(x - previous[0], y - previous[1]) >= 0.12) {
          this._trail.push([x, y]);
          this._trimTrail();
        }
        this._lastPointKey = key;
      }
    }
    if (this._mapPayload) {
      this._mapPayload.trail_active = trailActive;
      this._mapPayload.activity = mapAttrs.activity || this._mapPayload.activity;
      this._mapPayload.current_physical_zone = mapAttrs.current_physical_zone || this._mapPayload.current_physical_zone;
    }
    this._renderAllDynamic();
  }

  _trimTrail() {
    const cap = Math.max(100, Number(this._config?.trail_length) || 10000);
    while (this._trail.length > cap) {
      const last = this._trail.at(-1);
      this._trail = this._trail.filter((_point, index) => index % 2 === 0);
      if (this._trail.at(-1) !== last) this._trail.push(last);
    }
  }

  _renderAllDynamic() {
    this._renderShell();
    this._renderTrail();
    this._renderMower();
    this._renderFooter();
    this._renderSessions();
    this._renderMessage();
  }

  _renderTrail() {
    if (!this._trailEl || !this._layout) {
      if (this._trailEl) this._trailEl.innerHTML = "";
      return;
    }
    if (this._trail.length < 2) {
      this._trailEl.innerHTML = "";
      return;
    }
    const breakSquared = 25;
    const segments = [[]];
    let previous = null;
    for (const point of this._trail) {
      if (previous && (point[0] - previous[0]) ** 2 + (point[1] - previous[1]) ** 2 > breakSquared) {
        segments.push([]);
      }
      segments.at(-1).push(point);
      previous = point;
    }
    const width = Math.min(Math.max(.25 * this._layout.scale, 5), 28);
    const paths = segments
      .filter((segment) => segment.length >= 2)
      .map((segment) => `<polyline points="${this._pointString(segment)}" fill="none" stroke="${escapeHtml(this._config.trail_color)}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("");
    this._trailEl.innerHTML = paths ? `<g opacity="${clamp(finiteNumber(this._config.trail_opacity, .4), 0, 1)}">${paths}</g>` : "";
  }

  _renderMower() {
    if (!this._dynamicEl || !this._layout) {
      if (this._dynamicEl) this._dynamicEl.innerHTML = "";
      return;
    }
    const x = this._number(this._resolved.x_entity);
    const y = this._number(this._resolved.y_entity);
    const heading = this._number(this._resolved.heading_entity);
    this._dynamicEl.innerHTML = x !== null && y !== null
      ? this._mower(this._layout.sx(x), this._layout.sy(y), heading)
      : "";
  }

  _renderFooter() {
    if (!this._footerEl || !this._config) return;
    const parts = [];
    const mapState = this._state(this._resolved.map_entity);
    const mapAttrs = mapState?.attributes || {};
    const status = this._text(this._resolved.status_entity, mapAttrs.activity || this._mapPayload?.activity || "—");
    const zone = this._text(this._resolved.zone_entity, mapAttrs.current_physical_zone || this._mapPayload?.current_physical_zone || "—");
    const battery = this._number(this._resolved.battery_entity);
    const x = this._number(this._resolved.x_entity);
    const y = this._number(this._resolved.y_entity);
    if (this._config.show_status && status !== "—") {
      parts.push(`<span>Status: <span class="nm-value">${escapeHtml(status)}</span></span>`);
    }
    if (this._config.show_zone && zone !== "—") {
      parts.push(`<span>Zone: <span class="nm-value">${escapeHtml(zone)}</span></span>`);
    }
    if (this._config.show_battery && battery !== null) {
      parts.push(`<button type="button" class="nm-battery">Battery: <span class="nm-value">${battery.toFixed(0)}%</span></button>`);
    }
    if (this._config.show_position && x !== null && y !== null) {
      parts.push(`<span>Position: <span class="nm-value">${x.toFixed(2)}, ${y.toFixed(2)} m</span></span>`);
    }
    this._footerEl.innerHTML = parts.join("");
    this._footerEl.style.display = parts.length ? "flex" : "none";
    this._footerEl.querySelector(".nm-battery")?.addEventListener("click", () => {
      this._openMoreInfo(this._resolved.battery_entity);
    });
  }

  _renderSessions() {
    if (!this._sessionsEl || !this._config.show_session_legend) return;
    const sessions = this._sessionRecords();
    if (!sessions.length) {
      this._sessionsEl.innerHTML = "";
      this._sessionsEl.style.display = "none";
      return;
    }
    const now = new Date();
    this._sessionsEl.innerHTML = sessions.map((session, index) => {
      const start = dateValue(session.started_at);
      const end = dateValue(session.ended_at);
      const label = this._formatSessionTime(start, end, session.active, now);
      const opacity = session.active ? clamp(finiteNumber(this._config.trail_opacity, .4) + .3, .35, 1) : clamp(.28 + index * .07, .28, .65);
      const note = session.approximate ? `<span class="nm-session-note" title="Start time is when this browser first observed the session">*</span>` : "";
      return `<span class="nm-session"><span class="nm-session-dot" style="background:${escapeHtml(this._config.trail_color)};opacity:${opacity.toFixed(2)}"></span><span>${escapeHtml(label)}</span>${note}</span>`;
    }).join("");
    this._sessionsEl.style.display = "flex";
  }

  _formatSessionTime(start, end, active, now) {
    if (!start) return active ? "Current session" : "Mowing session";
    const sameDay = start.getFullYear() === now.getFullYear()
      && start.getMonth() === now.getMonth()
      && start.getDate() === now.getDate();
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
    const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    const prefix = sameDay ? "" : `${dateFormat.format(start)} `;
    const endText = active && !end ? "now" : end ? timeFormat.format(end) : "—";
    return `${prefix}${timeFormat.format(start)}–${endText}`;
  }

  _renderMessage() {
    if (!this._messageEl) return;
    let message = null;
    if (this._loadError && !this._mapPayload) message = this._loadError;
    else if (this._loadingMap && !this._mapPayload) message = "Loading map…";
    else if (!this._mapPayload) message = "Waiting for map data…";
    else if (!this._layout) message = "Map geometry is empty";
    else if (this._loadError) message = this._loadError;
    this._messageEl.innerHTML = message ? this._placeholder(message) : "";
  }

  _mower(cx, cy, headingDegrees) {
    const degrees = Number.isFinite(headingDegrees) ? -headingDegrees : 0;
    const scale = clamp(finiteNumber(this._config.mower_scale, 1), .5, 2.5);
    return `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${degrees.toFixed(1)}) scale(${scale.toFixed(2)})">
      <rect x="-23" y="-18" width="46" height="36" rx="12" fill="${escapeHtml(this._config.mower_body_color)}" stroke="#fff" stroke-width="4"/>
      <circle cx="-8" cy="-8" r="3.5" fill="#eceff1"/><circle cx="-8" cy="8" r="3.5" fill="#eceff1"/>
      <circle cx="14" cy="0" r="8" fill="${escapeHtml(this._config.mower_accent_color)}" stroke="#fff" stroke-width="2"/>
    </g>`;
  }

  _station(cx, cy) {
    const scale = clamp(finiteNumber(this._config.dock_scale, 1), .5, 2.5);
    return `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${scale.toFixed(2)})">
      <rect x="-17" y="-14" width="34" height="28" rx="6" fill="${escapeHtml(this._config.dock_color)}" stroke="#fff" stroke-width="3"/>
      <path d="M3 -10 L-6 1 H0 L-3 10 L7 -2 H1 Z" fill="#69f0ae"/>
    </g>`;
  }

  _pill(cx, cy, value) {
    const fontSize = clamp(finiteNumber(this._config.zone_label_font_size, 20), 12, 36);
    const text = escapeHtml(value);
    const width = Math.max(92, String(value).length * fontSize * .58 + 28);
    const height = fontSize + 18;
    return `<g><rect x="${(cx - width / 2).toFixed(1)}" y="${(cy - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${(height / 2).toFixed(1)}" fill="#eceff1" fill-opacity=".94" stroke="#b0bec5" stroke-width="1.5"/>
      <text x="${cx.toFixed(1)}" y="${(cy + fontSize * .34).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize.toFixed(0)}" font-weight="600" fill="#37474f">${text}</text></g>`;
  }

  _label(cx, cy, value, size = 17) {
    return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="${size}" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width="4" fill="#263238">${escapeHtml(value)}</text>`;
  }

  _legend(hasChannels, hasTunnels) {
    const rows = [
      [this._config.mower_accent_color, "Mower"],
      [this._config.trail_color, "Mowed"],
      [this._config.dock_color, "Dock"],
      [this._config.obstacle_color, "Obstacle"],
      [this._config.no_mow_color, "No-mow"],
    ];
    if (hasChannels) rows.push([this._config.channel_color, "Channel"]);
    if (hasTunnels) rows.push([this._config.tunnel_color, "Tunnel"]);
    const fontSize = 19;
    const rowHeight = 30;
    const height = rows.length * rowHeight + 18;
    const opacity = clamp(finiteNumber(this._config.map_legend_opacity, .58), 0, 1);
    let result = `<g><rect x="14" y="14" width="158" height="${height}" rx="10" fill="var(--card-background-color, #fff)" fill-opacity="${opacity.toFixed(2)}" stroke="#9e9e9e" stroke-opacity=".25"/>`;
    rows.forEach(([color, name], index) => {
      const y = 40 + index * rowHeight;
      result += `<rect x="27" y="${y - 14}" width="19" height="19" rx="3" fill="${escapeHtml(color)}"/><text x="57" y="${y + 1}" font-family="sans-serif" font-size="${fontSize}" font-weight="600" fill="var(--primary-text-color, #263238)">${escapeHtml(name)}</text>`;
    });
    return `${result}</g>`;
  }

  _placeholder(message) {
    return `<rect width="${VIEW_SIZE}" height="${VIEW_SIZE}" fill="var(--secondary-background-color)"/><text x="${VIEW_SIZE / 2}" y="${VIEW_SIZE / 2}" text-anchor="middle" font-family="sans-serif" font-size="28" fill="var(--secondary-text-color)">${escapeHtml(message)}</text>`;
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    const event = new Event("hass-action", { bubbles: true, composed: true });
    event.detail = {
      config: { entity: entityId, tap_action: { action: "more-info" } },
      action: "tap",
    };
    this.dispatchEvent(event);
  }

  _applyInitialView(force) {
    if (!this._layout || (!force && this._initialViewApplied)) return;
    if (!force && this._config.remember_view) {
      const restored = this._restoreView();
      if (restored) {
        this._initialViewApplied = true;
        this._applyViewBox();
        return;
      }
    }
    const scale = clamp(finiteNumber(this._config.initial_zoom, 1), 1, finiteNumber(this._config.max_zoom, 8));
    let cx = VIEW_SIZE / 2;
    let cy = VIEW_SIZE / 2;
    const focus = this._config.initial_focus || "map";
    if (focus === "mower") {
      const x = this._number(this._resolved.x_entity);
      const y = this._number(this._resolved.y_entity);
      if (x !== null && y !== null) {
        cx = this._layout.sx(x);
        cy = this._layout.sy(y);
      }
    } else if (focus === "dock") {
      const station = this._layout.station;
      if (station && Number.isFinite(Number(station.x)) && Number.isFinite(Number(station.y))) {
        cx = this._layout.sx(Number(station.x));
        cy = this._layout.sy(Number(station.y));
      }
    }
    this._view = { scale, cx, cy };
    this._initialViewApplied = true;
    this._clampView();
    this._applyViewBox();
    this._saveView();
  }

  _restoreView() {
    const key = this._viewStorageKey();
    if (!key) return false;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (!parsed || !Number.isFinite(parsed.scale) || !Number.isFinite(parsed.cx) || !Number.isFinite(parsed.cy)) return false;
      this._view = {
        scale: clamp(parsed.scale, 1, finiteNumber(this._config.max_zoom, 8)),
        cx: parsed.cx,
        cy: parsed.cy,
      };
      this._clampView();
      return true;
    } catch (_error) {
      return false;
    }
  }

  _saveView() {
    if (!this._config?.remember_view) return;
    const key = this._viewStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(this._view));
    } catch (_error) {
      // Storage may be unavailable in hardened browsers.
    }
  }

  _clampView() {
    const maxZoom = Math.max(1, finiteNumber(this._config?.max_zoom, 8));
    this._view.scale = clamp(finiteNumber(this._view.scale, 1), 1, maxZoom);
    const size = VIEW_SIZE / this._view.scale;
    const half = size / 2;
    this._view.cx = clamp(finiteNumber(this._view.cx, VIEW_SIZE / 2), half, VIEW_SIZE - half);
    this._view.cy = clamp(finiteNumber(this._view.cy, VIEW_SIZE / 2), half, VIEW_SIZE - half);
  }

  _applyViewBox() {
    if (!this._svgEl) return;
    this._clampView();
    const size = VIEW_SIZE / this._view.scale;
    const left = this._view.cx - size / 2;
    const top = this._view.cy - size / 2;
    this._svgEl.setAttribute("viewBox", `${left.toFixed(2)} ${top.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`);
    this._syncTouchAction();
  }

  _syncTouchAction() {
    if (!this._svgEl) return;
    this._svgEl.style.touchAction = this._config?.enable_zoom && this._view.scale > 1.001 ? "none" : "pan-y";
  }

  _zoomAtCenter(factor) {
    if (!this._config?.enable_zoom || !this._layout) return;
    this._zoomAtSvgPoint(factor, this._view.cx, this._view.cy);
  }

  _zoomAtClientPoint(factor, clientX, clientY) {
    const rect = this._svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const size = VIEW_SIZE / this._view.scale;
    const left = this._view.cx - size / 2;
    const top = this._view.cy - size / 2;
    const svgX = left + ((clientX - rect.left) / rect.width) * size;
    const svgY = top + ((clientY - rect.top) / rect.height) * size;
    this._zoomAtSvgPoint(factor, svgX, svgY);
  }

  _zoomAtSvgPoint(factor, svgX, svgY) {
    const oldScale = this._view.scale;
    const newScale = clamp(oldScale * factor, 1, finiteNumber(this._config.max_zoom, 8));
    if (Math.abs(newScale - oldScale) < .0001) return;
    const oldSize = VIEW_SIZE / oldScale;
    const oldLeft = this._view.cx - oldSize / 2;
    const oldTop = this._view.cy - oldSize / 2;
    const relX = (svgX - oldLeft) / oldSize;
    const relY = (svgY - oldTop) / oldSize;
    const newSize = VIEW_SIZE / newScale;
    this._view = {
      scale: newScale,
      cx: svgX - relX * newSize + newSize / 2,
      cy: svgY - relY * newSize + newSize / 2,
    };
    this._applyViewBox();
    this._saveView();
  }

  _onWheel(event) {
    if (!this._config?.enable_zoom || !this._layout) return;
    event.preventDefault();
    this._zoomAtClientPoint(event.deltaY < 0 ? 1.18 : 1 / 1.18, event.clientX, event.clientY);
  }

  _onPointerDown(event) {
    if (!this._config?.enable_zoom || !this._layout) return;
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this._view.scale > 1 || this._pointers.size > 1) {
      try { this._svgEl.setPointerCapture(event.pointerId); } catch (_error) { /* no-op */ }
      event.preventDefault();
    }
    if (this._pointers.size === 1) {
      this._panStart = { x: event.clientX, y: event.clientY, ...this._view };
      this._pinchStart = null;
    } else if (this._pointers.size === 2) {
      const points = [...this._pointers.values()];
      this._pinchStart = {
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) || 1,
        scale: this._view.scale,
        cx: this._view.cx,
        cy: this._view.cy,
      };
      this._panStart = null;
    }
  }

  _onPointerMove(event) {
    if (!this._pointers.has(event.pointerId) || !this._config?.enable_zoom) return;
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this._pointers.size === 1 && this._panStart && this._view.scale > 1) {
      event.preventDefault();
      const rect = this._svgEl.getBoundingClientRect();
      const visibleSize = VIEW_SIZE / this._panStart.scale;
      this._view = {
        scale: this._panStart.scale,
        cx: this._panStart.cx - ((event.clientX - this._panStart.x) / rect.width) * visibleSize,
        cy: this._panStart.cy - ((event.clientY - this._panStart.y) / rect.height) * visibleSize,
      };
      this._applyViewBox();
    } else if (this._pointers.size === 2 && this._pinchStart) {
      event.preventDefault();
      const points = [...this._pointers.values()];
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) || 1;
      const middleX = (points[0].x + points[1].x) / 2;
      const middleY = (points[0].y + points[1].y) / 2;
      this._view = { scale: this._pinchStart.scale, cx: this._pinchStart.cx, cy: this._pinchStart.cy };
      this._zoomAtClientPoint(distance / this._pinchStart.distance, middleX, middleY);
    }
  }

  _onPointerUp(event) {
    this._pointers.delete(event.pointerId);
    try { this._svgEl.releasePointerCapture(event.pointerId); } catch (_error) { /* no-op */ }
    if (this._pointers.size === 1) {
      const point = [...this._pointers.values()][0];
      this._panStart = { x: point.x, y: point.y, ...this._view };
      this._pinchStart = null;
    } else if (this._pointers.size === 0) {
      this._panStart = null;
      this._pinchStart = null;
      this._saveView();
    }
  }
}

if (!customElements.get("navimower-map-card")) {
  customElements.define("navimower-map-card", NavimowerMapCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "navimower-map-card")) {
  window.customCards.push({
    type: "navimower-map-card",
    name: "Navimower Map Card",
    description: "Private-cloud Navimower map with live pose, trail, sessions, channels, and zoom.",
    preview: true,
    getEntitySuggestion: (_hass, entityId) => {
      if (!entityId || entityId.split(".")[0] !== "lawn_mower") return null;
      return {
        config: {
          type: "custom:navimower-map-card",
          ...NavimowerMapCard.getStubConfig(),
          entity: entityId,
        },
      };
    },
  });
}

console.info(`%c NAVIMOWER-MAP-CARD %c v${NAVIMOWER_MAP_CARD_VERSION} `,
  "color: white; background: #43a047; font-weight: 700; padding: 2px 6px; border-radius: 3px 0 0 3px;",
  "color: #263238; background: #eceff1; font-weight: 700; padding: 2px 6px; border-radius: 0 3px 3px 0;");
