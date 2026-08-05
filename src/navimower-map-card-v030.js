/*
 * Navimower Map Card 0.3.0-beta1 compatibility layer.
 *
 * Completed sessions are rendered from the Navimower 0.4 session-render API.
 * The 0.2.2 card remains the stable UI core; only the active session retains
 * its live polyline. Completed-session route points are never drawn as a
 * fallback by this layer.
 */

export const NAVIMOWER_MAP_CARD_V030_VERSION = "0.3.0-beta1";

const SESSION_INDEX_CACHE = new Map();
const SESSION_RENDER_CACHE = new Map();
const LIGHTWEIGHT_MAP_CACHE = new Map();
const LATEST_LIGHTWEIGHT_MAP_CACHE = new Map();
const MAP_CACHE_LIMIT = 10;
const MAP_CACHE_FRESH_MS = 45000;
const INDEX_CACHE_FRESH_MS = 30000;
const MAX_HISTORY_DAYS = 31;

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cacheSet(cache, key, value, limit = MAP_CACHE_LIMIT) {
  if (!key) return;
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActiveSession(session) {
  return Boolean(session?.active || (session?.ended_at === null && session?.started_at));
}

function sessionId(session, fallback = "") {
  return String(session?.id ?? session?.session_id ?? fallback);
}

function stripQuery(path) {
  return String(path || "").split(/[?#]/, 1)[0];
}

function apiCallPath(path) {
  return String(path || "").replace(/^\/api\//, "").replace(/^\/+/, "");
}

function withLightweightMapQuery(path) {
  if (!path) return path;
  const text = String(path);
  const separator = text.includes("?") ? "&" : "?";
  return `${text}${separator}include_sessions=0&include_daily_trails=0`;
}

export function deriveSessionPaths(mapApiPath) {
  const mapPath = stripQuery(mapApiPath);
  const match = mapPath.match(/^(.*\/navimower)\/map\/([^/]+)$/);
  if (!match) {
    return {
      mapPath,
      lightweightMapPath: withLightweightMapQuery(mapPath),
      sessionsPath: null,
      renderTemplate: null,
    };
  }
  const [, root, entryId] = match;
  return {
    mapPath,
    lightweightMapPath: withLightweightMapQuery(mapPath),
    sessionsPath: `${root}/sessions/${entryId}`,
    renderTemplate: `${root}/session-render/${entryId}/{session_id}`,
  };
}

export function sanitizeMapPayload(payload) {
  const next = { ...(payload || {}) };
  if (Array.isArray(next.sessions)) {
    next.sessions = next.sessions.map((session) => {
      if (!session || typeof session !== "object" || isActiveSession(session)) {
        return session;
      }
      const clean = { ...session };
      delete clean.points;
      delete clean.segments;
      delete clean.trail;
      return clean;
    });
  }
  // Completed history is supplied by the compact session-render API. Keeping
  // schema-v5 daily line trails here would reintroduce the expensive fallback.
  delete next.daily_trails;
  return next;
}

export function layoutMatrix(layout) {
  if (!layout || typeof layout.sx !== "function" || typeof layout.sy !== "function") {
    return null;
  }
  const e = finite(layout.sx(0));
  const f = finite(layout.sy(0));
  const x1 = finite(layout.sx(1));
  const y1 = finite(layout.sy(1));
  if (![x1, y1, e, f].every(Number.isFinite)) return null;
  const a = x1 - e;
  const d = y1 - f;
  return { a, d, e, f, value: `matrix(${a} 0 0 ${d} ${e} ${f})` };
}

function renderFingerprint(render) {
  return String(render?.fingerprint || render?.session_fingerprint || "");
}

function renderSignature(session) {
  return [
    sessionId(session),
    session?.point_count ?? "",
    session?.ended_at_ms ?? session?.ended_at ?? "",
    session?.sequence ?? "",
  ].join(":");
}

function validArchive(render) {
  if (!render || typeof render !== "object") return false;
  const area = String(render?.mowed_area?.path_d || "").trim();
  const travel = String(render?.travel?.path_d || "").trim();
  return Boolean(area || travel);
}

export function archiveSvg(render, layout, color, opacity, id) {
  if (!validArchive(render)) return "";
  const matrix = layoutMatrix(layout);
  if (!matrix) return "";
  const safeColor = escapeHtml(color || "#43a047");
  const safeId = escapeHtml(id);
  const safeOpacity = clamp(finite(opacity, 0.55), 0, 1).toFixed(2);
  const areaPath = String(render?.mowed_area?.path_d || "").trim();
  const travelPath = String(render?.travel?.path_d || "").trim();
  const travelWidth = Math.max(0.02, finite(render?.travel?.stroke_width_m, 0.08));
  const parts = [];
  if (areaPath) {
    parts.push(`<path class="nm-session-area" d="${escapeHtml(areaPath)}" fill="${safeColor}" fill-rule="evenodd" clip-rule="evenodd"/>`);
  }
  if (travelPath) {
    parts.push(`<path class="nm-session-travel" d="${escapeHtml(travelPath)}" fill="none" stroke="${safeColor}" stroke-width="${travelWidth}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  return `<g class="nm-session-archive" data-session-id="${safeId}" opacity="${safeOpacity}" transform="${matrix.value}">${parts.join("")}</g>`;
}

function localDayStart(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Number(offset || 0));
  return date;
}

export function sessionsForDay(sessions, dayOffset, limit = 6) {
  const start = localDayStart(dayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return (Array.isArray(sessions) ? sessions : [])
    .filter((session) => {
      const sessionStart = asDate(session?.started_at || session?.start || session?.start_time);
      const sessionEnd = asDate(session?.ended_at || session?.end || session?.end_time)
        || (isActiveSession(session) ? new Date() : sessionStart);
      return sessionStart && sessionEnd && sessionStart < end && sessionEnd >= start;
    })
    .slice(-Math.max(1, Number(limit) || 6));
}

function normalizeIndexSessions(payload) {
  return (Array.isArray(payload?.sessions) ? payload.sessions : [])
    .filter((session) => session && (session.id !== undefined || session.session_id !== undefined))
    .map((session) => ({ ...session }))
    .sort((left, right) => {
      const leftStamp = finite(left.started_at_ms, asDate(left.started_at)?.getTime() || 0);
      const rightStamp = finite(right.started_at_ms, asDate(right.started_at)?.getTime() || 0);
      return leftStamp - rightStamp;
    });
}

function baseApiPath(card, originalApiPath) {
  const current = card._v030BaseApiPath || originalApiPath?.call(card);
  return stripQuery(current);
}

function resetArchiveState(card) {
  card._v030Generation = (card._v030Generation || 0) + 1;
  card._v030BaseApiPath = null;
  card._v030SessionIndex = null;
  card._v030RenderTemplate = null;
  card._v030IndexLoading = false;
  card._v030IndexRevision = null;
  card._v030Renders = new Map();
  card._v030RenderLoading = new Set();
  card._v030RenderUnavailable = new Map();
  card._v030HistoryBarKey = null;
}

function ensureState(card) {
  if (!(card._v030Renders instanceof Map)) card._v030Renders = new Map();
  if (!(card._v030RenderLoading instanceof Set)) card._v030RenderLoading = new Set();
  if (!(card._v030RenderUnavailable instanceof Map)) card._v030RenderUnavailable = new Map();
  if (!Number.isFinite(card._v030Generation)) card._v030Generation = 0;
}

async function loadSessionIndex(card, originalApiPath, force = false) {
  ensureState(card);
  const derived = deriveSessionPaths(baseApiPath(card, originalApiPath));
  if (!derived.sessionsPath || !card._hass?.callApi || card._v030IndexLoading) return;
  const cached = SESSION_INDEX_CACHE.get(derived.sessionsPath);
  if (!force && cached && Date.now() - cached.cachedAt < INDEX_CACHE_FRESH_MS) {
    card._v030SessionIndex = cached.sessions.map((session) => ({ ...session }));
    card._v030RenderTemplate = cached.renderTemplate || derived.renderTemplate;
    card._historyBarRenderKey = null;
    card._historyRenderKey = null;
    card._sessionsRenderKey = null;
    card._queueRender?.({ history: true, sessions: true, shell: true });
    return;
  }

  const generation = card._v030Generation;
  card._v030IndexLoading = true;
  try {
    const payload = await card._hass.callApi("GET", apiCallPath(derived.sessionsPath));
    if (generation !== card._v030Generation) return;
    const sessions = normalizeIndexSessions(payload);
    const renderTemplate = payload?.session_render_api_path_template || derived.renderTemplate;
    card._v030SessionIndex = sessions;
    card._v030RenderTemplate = renderTemplate;
    SESSION_INDEX_CACHE.set(derived.sessionsPath, {
      sessions: sessions.map((session) => ({ ...session })),
      renderTemplate,
      cachedAt: Date.now(),
    });
    card._historyBarRenderKey = null;
    card._historyRenderKey = null;
    card._sessionsRenderKey = null;
    card._queueRender?.({ history: true, sessions: true, shell: true });
  } catch (error) {
    if (generation === card._v030Generation) {
      card._v030IndexError = String(error?.message || error);
      console.debug("[Navimower Map Card] Session index unavailable", error);
    }
  } finally {
    if (generation === card._v030Generation) card._v030IndexLoading = false;
  }
}

function renderEntry(card, session) {
  ensureState(card);
  const id = sessionId(session);
  const signature = renderSignature(session);
  const entry = card._v030Renders.get(id);
  return entry?.signature === signature ? entry.render : null;
}

function renderEndpoint(card, session, originalApiPath) {
  const derived = deriveSessionPaths(baseApiPath(card, originalApiPath));
  const template = card._v030RenderTemplate || derived.renderTemplate;
  if (!template) return null;
  return String(template).replace("{session_id}", encodeURIComponent(sessionId(session)));
}

async function loadSessionRender(card, session, originalApiPath) {
  ensureState(card);
  if (!session || isActiveSession(session)) return null;
  const id = sessionId(session);
  const signature = renderSignature(session);
  const current = renderEntry(card, session);
  if (current) return current;
  if (card._v030RenderLoading.has(id)) return null;
  const unavailable = card._v030RenderUnavailable.get(id);
  if (unavailable?.signature === signature && Date.now() - unavailable.at < 60000) return null;

  const endpoint = renderEndpoint(card, session, originalApiPath);
  if (!endpoint || !card._hass?.callApi) return null;
  const cacheKey = `${stripQuery(endpoint)}|${signature}`;
  const cached = SESSION_RENDER_CACHE.get(cacheKey);
  if (cached && validArchive(cached)) {
    card._v030Renders.set(id, { signature, render: cached });
    return cached;
  }

  const generation = card._v030Generation;
  card._v030RenderLoading.add(id);
  card._sessionsRenderKey = null;
  card._queueRender?.({ sessions: true });
  try {
    const payload = await card._hass.callApi("GET", apiCallPath(endpoint));
    if (generation !== card._v030Generation) return null;
    const render = payload?.render || payload;
    if (!validArchive(render)) throw new Error("Session render is empty");
    SESSION_RENDER_CACHE.set(cacheKey, render);
    card._v030Renders.set(id, { signature, render });
    card._v030RenderUnavailable.delete(id);
    card._historyRenderKey = null;
    card._sessionsRenderKey = null;
    card._queueRender?.({ history: true, sessions: true });
    return render;
  } catch (error) {
    if (generation === card._v030Generation) {
      card._v030RenderUnavailable.set(id, { signature, at: Date.now() });
      console.debug(`[Navimower Map Card] Completed session ${id} render unavailable`, error);
    }
    return null;
  } finally {
    if (generation === card._v030Generation) {
      card._v030RenderLoading.delete(id);
      card._sessionsRenderKey = null;
      card._queueRender?.({ sessions: true });
    }
  }
}

function loadVisibleRenders(card, sessions, originalApiPath) {
  for (const session of sessions || []) {
    if (!isActiveSession(session) && !renderEntry(card, session)) {
      void loadSessionRender(card, session, originalApiPath);
    }
  }
}

function historyDayOffsets(sessions) {
  const today = localDayStart(0).getTime();
  const offsets = new Set([0]);
  for (const session of sessions || []) {
    const start = asDate(session?.started_at || session?.start || session?.start_time);
    if (!start) continue;
    start.setHours(0, 0, 0, 0);
    const offset = Math.round((today - start.getTime()) / 86400000);
    if (offset >= 0 && offset <= 366) offsets.add(offset);
  }
  return [...offsets].sort((a, b) => a - b).slice(0, MAX_HISTORY_DAYS);
}

function markStableSvgStrokes(card) {
  const details = card._detailsEl;
  if (!details?.querySelectorAll) return;
  details.querySelectorAll("line").forEach((element) => {
    element.setAttribute("vector-effect", "non-scaling-stroke");
    element.setAttribute("stroke-width", "2.5");
  });
  details.querySelectorAll("polygon,polyline,rect,path").forEach((element) => {
    element.setAttribute("vector-effect", "non-scaling-stroke");
  });
}

function injectV030Styles(card) {
  if (card._v030StyleInstalled || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset.navimowerV030 = "true";
  style.textContent = `
    :host { min-width: 0 !important; max-width: 100% !important; overflow: hidden !important; box-sizing: border-box !important; }
    ha-card { width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; overflow: hidden !important; }
    .nm-wrap { width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
    .nm-map { max-width: 100% !important; }
    .nm-history-bar { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: thin; padding-bottom: 2px; }
    .nm-history-choice { flex: 0 0 auto; }
    .nm-session-archive-highlight { pointer-events: none; animation: nm-session-area-pulse 600ms ease-in-out 3 forwards; }
    @keyframes nm-session-area-pulse { 0%, 100% { opacity: .08; } 50% { opacity: 1; filter: drop-shadow(0 0 7px var(--nm-highlight-color)); } }
  `;
  card.appendChild(style);
  card._v030StyleInstalled = true;
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV030Patched) return;
  Card.__navimowerV030Patched = true;
  const proto = Card.prototype;

  const originalApiPath = proto._apiPath;
  proto._apiPath = function patchedApiPath() {
    const raw = originalApiPath.call(this);
    if (!raw) return raw;
    this._v030BaseApiPath = stripQuery(raw);
    return withLightweightMapQuery(raw);
  };

  const originalSetConfig = proto.setConfig;
  proto.setConfig = function patchedSetConfig(config) {
    const previous = this._config?.entity || this._config?.mower_entity || this._config?.map_entity || null;
    const result = originalSetConfig.call(this, config);
    const current = this._config?.entity || this._config?.mower_entity || this._config?.map_entity || null;
    if (!this._v030Renders || (previous && previous !== current)) resetArchiveState(this);
    return result;
  };

  const originalEnsureDom = proto._ensureDom;
  proto._ensureDom = function patchedEnsureDom() {
    const result = originalEnsureDom.call(this);
    injectV030Styles(this);
    markStableSvgStrokes(this);
    return result;
  };

  const originalApplyStaticLayers = proto._applyStaticLayers;
  proto._applyStaticLayers = function patchedApplyStaticLayers(entry) {
    const result = originalApplyStaticLayers.call(this, entry);
    markStableSvgStrokes(this);
    return result;
  };

  const originalRenderStatic = proto._renderStatic;
  proto._renderStatic = function patchedRenderStatic() {
    const result = originalRenderStatic.call(this);
    markStableSvgStrokes(this);
    return result;
  };

  proto._maybeLoadMap = async function patchedMaybeLoadMap() {
    if (!this._config || !this._hass || this._loadingMap) return;
    const apiPath = this._apiPath();
    if (!apiPath) {
      const mapEntity = this._resolved?.map_entity || this._config?.map_entity;
      this._loadError = mapEntity
        ? `Map entity has no api_path attribute: ${mapEntity}`
        : "Waiting for Navimower map entity auto-detection";
      this._queueRender?.({ message: true });
      return;
    }
    const mapState = this._state?.(this._resolved?.map_entity);
    const attrs = mapState?.attributes || {};
    const key = [apiPath, attrs.map_version, attrs.map_modified_count, attrs.trail_session,
      attrs.active_session_id, attrs.zone_states_revision, mapState?.state].join("|");
    if (key === this._mapKey) return;
    if (key === this._failedMapKey && Date.now() < this._retryAfter) return;

    const cached = LIGHTWEIGHT_MAP_CACHE.get(key);
    if (cached?.payload) {
      this._loadError = null;
      this._applyMapPayload(cached.payload, attrs, key);
      this._queueRender?.({ shell: true, history: true, trail: true, mower: true, footer: true,
        controls: true, sessions: true, message: true });
      if (Date.now() - Number(cached.cachedAt || 0) < MAP_CACHE_FRESH_MS) return;
    } else {
      const latest = LATEST_LIGHTWEIGHT_MAP_CACHE.get(stripQuery(apiPath));
      if (latest?.payload) {
        this._loadError = null;
        this._applyMapPayload(latest.payload, attrs, latest.key || key);
        this._queueRender?.({ shell: true, history: true, trail: true, mower: true, footer: true,
          controls: true, sessions: true, message: true });
      }
    }

    this._loadingMap = true;
    this._loadError = null;
    this._queueRender?.({ message: true });
    try {
      const payload = await this._hass.callApi("GET", apiCallPath(apiPath));
      const clean = sanitizeMapPayload(payload || {});
      const cachedAt = Date.now();
      cacheSet(LIGHTWEIGHT_MAP_CACHE, key, { payload: clean, cachedAt });
      cacheSet(LATEST_LIGHTWEIGHT_MAP_CACHE, stripQuery(apiPath), { payload: clean, cachedAt, key });
      this._applyMapPayload(clean, attrs, key);
    } catch (error) {
      this._loadError = `Map load failed: ${error?.message || error}`;
      this._failedMapKey = key;
      this._retryAfter = Date.now() + 30000;
    } finally {
      this._loadingMap = false;
      this._queueRender?.({ shell: true, history: true, trail: true, mower: true, footer: true,
        controls: true, sessions: true, message: true });
    }
  };

  const originalApplyMapPayload = proto._applyMapPayload;
  proto._applyMapPayload = function patchedApplyMapPayload(payload, attrs, key) {
    ensureState(this);
    const clean = sanitizeMapPayload(payload);
    const result = originalApplyMapPayload.call(this, clean, attrs, key);
    const revision = [clean?.trail_session, clean?.active_session_id, clean?.trail_active].join("|");
    const force = this._v030IndexRevision !== revision;
    this._v030IndexRevision = revision;
    void loadSessionIndex(this, originalApiPath, force);
    return result;
  };

  proto._sessionRecords = function patchedSessionRecords({ applyLimit = true } = {}) {
    ensureState(this);
    const mapSessions = Array.isArray(this._mapPayload?.sessions) ? this._mapPayload.sessions : [];
    const indexed = Array.isArray(this._v030SessionIndex) ? this._v030SessionIndex : mapSessions;
    const rows = indexed.map((session, index) => {
      const active = isActiveSession(session);
      const segments = active ? this._activeTrailSegments() : [];
      const render = active ? null : renderEntry(this, session);
      return {
        ...session,
        id: session?.id ?? session?.session_id ?? index,
        started_at: session?.started_at || session?.start || session?.start_time || null,
        ended_at: session?.ended_at || session?.end || session?.end_time || null,
        active,
        points: active ? this._trail : [],
        segments,
        render,
        drawable: active ? this._hasDrawableSegment(segments) : Boolean(render),
        renderLoading: !active && this._v030RenderLoading.has(sessionId(session, index)),
      };
    });

    // The active route can appear in the map payload before the session index
    // refresh finishes. Preserve that one route only.
    const activeMap = [...mapSessions].reverse().find(isActiveSession);
    if (activeMap && !rows.some((row) => String(row.id) === sessionId(activeMap))) {
      const segments = this._activeTrailSegments();
      rows.push({
        ...activeMap,
        id: activeMap.id ?? activeMap.session_id ?? this._trailSession ?? "active",
        active: true,
        points: this._trail,
        segments,
        render: null,
        drawable: this._hasDrawableSegment(segments),
      });
    }
    if (!rows.length && (this._trail.length || this._mapPayload?.trail_active)) {
      const segments = this._activeTrailSegments();
      rows.push({
        id: this._trailSession ?? "active",
        started_at: this._mapPayload?.trail_started_at || this._mapPayload?.session_started_at || this._sessionFirstSeen,
        ended_at: null,
        active: true,
        points: this._trail,
        segments,
        render: null,
        drawable: this._hasDrawableSegment(segments),
      });
    }
    return applyLimit ? rows.slice(-Math.max(1, Number(this._config?.session_count) || 6)) : rows;
  };

  proto._sessionsForCurrentView = function patchedSessionsForCurrentView() {
    const sessions = this._sessionRecords({ applyLimit: false });
    const offset = this._historyDayOffset === null ? 0 : this._historyDayOffset;
    return sessionsForDay(sessions, offset, this._config?.session_count);
  };

  proto._dailyTrailRecords = function noCompletedLineFallback() {
    return null;
  };

  proto._renderHistory = function patchedRenderHistory() {
    if (!this._historyEl || !this._layout) return;
    const sessions = this._sessionsForCurrentView().filter((session) => !session.active);
    loadVisibleRenders(this, sessions, originalApiPath);
    const sourceKey = sessions.map((session) => {
      const render = renderEntry(this, session);
      return `${session.id}:${renderSignature(session)}:${renderFingerprint(render)}:${Boolean(render)}`;
    }).join(";");
    const renderKey = [this._mapStaticSignature, this._historyDayOffset ?? "today", this._config.session_count,
      this._config.trail_color, this._config.trail_opacity, this._layout.scale, sourceKey].join("|");
    if (renderKey === this._historyRenderKey) return;
    this._historyRenderKey = renderKey;
    this._historyEl.innerHTML = sessions
      .map((session) => archiveSvg(renderEntry(this, session), this._layout, this._config.trail_color,
        this._config.trail_opacity, session.id))
      .join("");
  };

  const originalPulseSessionPath = proto._pulseSessionPath;
  proto._pulseSessionPath = function patchedPulseSessionPath(requestedId) {
    const session = this._sessionRecords({ applyLimit: false })
      .find((item) => String(item.id) === String(requestedId));
    if (!session || session.active) return originalPulseSessionPath.call(this, requestedId);
    const render = renderEntry(this, session);
    if (!render) {
      void loadSessionRender(this, session, originalApiPath);
      return;
    }
    if (!this._highlightEl || !this._layout) return;
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._highlightEl.innerHTML = "";
    this._sessionsEl?.querySelectorAll(".nm-session-pulsing")
      .forEach((item) => item.classList.remove("nm-session-pulsing"));
    const color = escapeHtml(this._config.trail_color);
    const svg = archiveSvg(render, this._layout, this._config.trail_color, 1, session.id)
      .replace('class="nm-session-archive"', `class="nm-session-archive nm-session-archive-highlight" style="--nm-highlight-color:${color}"`);
    this._highlightEl.innerHTML = svg;
    const button = [...(this._sessionsEl?.querySelectorAll(".nm-session[data-session-id]") || [])]
      .find((item) => String(item.dataset.sessionId) === String(requestedId));
    button?.classList.add("nm-session-pulsing");
    this._pulseTimer = setTimeout(() => {
      this._highlightEl.innerHTML = "";
      button?.classList.remove("nm-session-pulsing");
      this._pulseTimer = null;
    }, 1820);
  };

  proto._renderHistoryBar = function patchedHistoryBar() {
    if (!this._historyBarEl) return;
    const selected = this._historyDayOffset;
    const visible = this._historyMenuOpen || selected !== null;
    const sessions = this._sessionRecords({ applyLimit: false });
    const offsets = historyDayOffsets(sessions);
    if (selected !== null && !offsets.includes(Number(selected))) offsets.push(Number(selected));
    offsets.sort((a, b) => a - b);
    const historyBarKey = `${visible}|${selected ?? "today"}|${offsets.join(",")}`;
    if (historyBarKey === this._historyBarRenderKey) return;
    this._historyBarRenderKey = historyBarKey;
    this._historyBarEl.hidden = !visible;
    if (this._historyButtonEl) {
      this._historyButtonEl.classList.toggle("active", selected !== null || this._historyMenuOpen);
      this._historyButtonEl.setAttribute("aria-pressed", visible ? "true" : "false");
    }
    if (!visible) {
      this._historyBarEl.innerHTML = "";
      return;
    }
    this._historyBarEl.innerHTML = offsets.map((offset) => {
      const value = offset === 0 ? "today" : String(offset);
      const label = offset === 0 ? "Today" : this._historyDateLabel(offset);
      const active = offset === 0 ? selected === null : Number(selected) === offset;
      return `<button type="button" class="nm-history-choice${active ? " active" : ""}" data-history-offset="${value}">${escapeHtml(label)}</button>`;
    }).join("");
  };

  proto._renderSessions = function patchedRenderSessions() {
    if (!this._sessionsEl || !this._config.show_session_legend) return;
    const sessions = this._sessionsForCurrentView();
    loadVisibleRenders(this, sessions, originalApiPath);
    const renderKey = [this._historyDayOffset ?? "today", this._config.session_count,
      this._config.trail_color, this._config.trail_opacity,
      sessions.map((session) => `${session.id}:${session.active}:${session.drawable}:${session.renderLoading}`).join(";")].join("|");
    if (renderKey === this._sessionsRenderKey) return;
    this._sessionsRenderKey = renderKey;
    if (!sessions.length) {
      this._sessionsEl.innerHTML = "";
      this._sessionsEl.style.display = "none";
      return;
    }
    const now = new Date();
    this._sessionsEl.innerHTML = sessions.map((session) => {
      const start = asDate(session.started_at);
      const end = asDate(session.ended_at);
      const label = this._formatSessionTime(start, end, session.active, now);
      const opacity = clamp(finite(this._config.trail_opacity, 0.55), 0, 1);
      const loading = !session.active && this._v030RenderLoading.has(String(session.id));
      const disabled = session.drawable ? "" : " disabled";
      const title = session.drawable
        ? (session.active ? "Pulse this active session route on the map" : "Pulse this completed mowed area on the map")
        : (loading ? "Preparing completed mowed area…" : "Completed mowed area is not available yet");
      return `<button type="button" class="nm-session" data-session-id="${escapeHtml(String(session.id))}" title="${escapeHtml(title)}" aria-label="${escapeHtml(label)}. ${escapeHtml(title)}."${disabled}><span class="nm-session-dot" style="background:${escapeHtml(this._config.trail_color)};opacity:${opacity.toFixed(2)}"></span><span>${escapeHtml(label)}</span></button>`;
    }).join("");
    this._sessionsEl.style.display = "flex";
  };

  const originalSaveAll = proto._saveAllScheduleChanges;
  proto._saveAllScheduleChanges = async function patchedSaveAllScheduleChanges(...args) {
    const result = await originalSaveAll.apply(this, args);
    const dirty = (this._scheduleDraft || []).some((day) => day?._dirty || day?._saving);
    const failed = Object.values(this._scheduleStatus || {}).some((status) => status?.kind === "error");
    if (!dirty && !failed) {
      this._scheduleDialogOpen = false;
      this._renderDialog();
    }
    return result;
  };

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function patchedDisconnectedCallback() {
    this._v030Generation = (this._v030Generation || 0) + 1;
    return originalDisconnected?.call(this);
  };

  console.info("[Navimower Map Card] 0.3.0-beta1 completed-session archive support enabled");
}

if (typeof document !== "undefined" && globalThis.customElements) patchCard();
