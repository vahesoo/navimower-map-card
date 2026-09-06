import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta16: prioritized phased loading and selective multi-mower updates.";
if (source.includes(marker)) {
  console.log("Beta16 runtime pipeline already applied");
  process.exit(0);
}

const replaceOnce = (before, after, label) => {
  const index = source.indexOf(before);
  if (index < 0) throw new Error("Missing beta16 source anchor: " + label);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error("Ambiguous beta16 source anchor: " + label);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
};

const replaceBlock = (start, end, replacement, label) => {
  const from = source.indexOf(start);
  if (from < 0) throw new Error("Missing beta16 block start: " + label);
  const to = source.indexOf(end, from + start.length);
  if (to < 0) throw new Error("Missing beta16 block end: " + label);
  source = source.slice(0, from) + replacement + source.slice(to);
};

replaceOnce(
  '  const SESSION_REFRESH_MS = 30_000;\n  const SESSION_RENDER_LIMIT_PER_MOWER = 8;',
  '  const SESSION_REFRESH_MS = 30_000;\n  const MULTI_REQUEST_CONCURRENCY = 2;\n  const MULTI_RENDER_RETRY_MS = 30_000;\n  const MULTI_RENDER_CACHE_LIMIT = 96;',
  "multi request constants",
);

replaceOnce(
  '    }).slice(-SESSION_RENDER_LIMIT_PER_MOWER);',
  '    });',
  "remove hidden per-mower session limit",
);

replaceOnce(
  '    return `${text}${separator}include_sessions=0&include_daily_trails=0`;',
  '    return `${text}${separator}include_sessions=0&include_daily_trails=0&include_current_cycle=0`;',
  "single lightweight map query",
);

replaceOnce(
  '    return text + separator + "include_sessions=0&include_" + "daily" + "_trails=0";',
  '    return text + separator + "include_sessions=0&include_" + "daily" + "_trails=0&include_current_cycle=0";',
  "multi lightweight map query",
);

const dateBlockStart = '  const sessionsForDay036 = (sessions, offset) => {';
const dateBlockEnd = '\n\n  const apiPath036 =';
replaceBlock(dateBlockStart, dateBlockEnd, String.raw`  const dateKeyInZone036 = (value, timeZone) => {
    const date = date036(value);
    if (!date) return null;
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: timeZone || undefined,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return values.year + "-" + values.month + "-" + values.day;
    } catch (_error) {
      const local = new Date(date);
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      return local.toISOString().slice(0, 10);
    }
  };

  const selectedDayKey036 = (card, offset) => {
    const timeZone = card?._hass?.config?.time_zone || card?._hass?.locale?.time_zone || undefined;
    const todayKey = dateKeyInZone036(new Date(), timeZone);
    if (!todayKey) return null;
    const [year, month, day] = todayKey.split("-").map(Number);
    const selected = new Date(Date.UTC(year, month - 1, day - Math.max(0, Number(offset) || 0)));
    return selected.toISOString().slice(0, 10);
  };

  const sessionsForDay036 = (card, sessions, offset) => {
    const timeZone = card?._hass?.config?.time_zone || card?._hass?.locale?.time_zone || undefined;
    const selected = selectedDayKey036(card, offset);
    if (!selected) return [];
    return (Array.isArray(sessions) ? sessions : []).filter((session) => {
      const from = date036(session?.started_at ?? session?.start ?? session?.start_time ?? session?.started_at_ms);
      const to = date036(session?.ended_at ?? session?.end ?? session?.end_time ?? session?.ended_at_ms) || (session?.active ? new Date() : from);
      const fromKey = dateKeyInZone036(from, timeZone);
      const toKey = dateKeyInZone036(to, timeZone);
      return Boolean(fromKey && toKey && fromKey <= selected && toKey >= selected);
    });
  };`, "HA-timezone session day selection");

source = source.replaceAll(
  'sessionsForDay036(memberState036(card, member.entry_id).sessions, offset)',
  'sessionsForDay036(card, memberState036(card, member.entry_id).sessions, offset)',
);
source = source.replaceAll(
  'sessionsForDay036(memberState.sessions, card._historyDayOffset)',
  'sessionsForDay036(card, memberState.sessions, card._historyDayOffset)',
);

const callApiAnchor = String.raw`  const callApi036 = async (card, path) => {
    if (!path || !card?._hass?.callApi) return null;
    return await card._hass.callApi("GET", apiPath036(path));
  };`;
replaceOnce(callApiAnchor, callApiAnchor + String.raw`

  const currentGeneration036 = (card) => Number(card?._multi036Generation || 0);

  const generationMatches036 = (card, generation) =>
    currentGeneration036(card) === Number(generation);

  const runLimited036 = async (items, limit, worker) => {
    const queue = [...(items || [])];
    const count = Math.max(1, Math.min(Number(limit) || 1, queue.length || 1));
    await Promise.all(Array.from({ length: count }, async () => {
      while (queue.length) {
        const item = queue.shift();
        await worker(item);
      }
    }));
  };

  const scheduleIdle036 = (callback) => {
    if (typeof globalThis.requestIdleCallback === "function") {
      return globalThis.requestIdleCallback(() => callback(), { timeout: 800 });
    }
    return globalThis.setTimeout(callback, 0);
  };

  const currentCyclePath036 = (path) => {
    const clean = String(path || "").split(/[?#]/, 1)[0];
    return clean ? clean + "?current_cycle_only=1" : null;
  };

  const cacheMultiRender036 = (card, key, render) => {
    if (!(card._multi036RenderCache instanceof Map)) card._multi036RenderCache = new Map();
    card._multi036RenderCache.delete(key);
    card._multi036RenderCache.set(key, render);
    while (card._multi036RenderCache.size > MULTI_RENDER_CACHE_LIMIT) {
      card._multi036RenderCache.delete(card._multi036RenderCache.keys().next().value);
    }
  };

  async function refreshMemberCurrentCycle036(card, member, generation) {
    const state = memberState036(card, member.entry_id);
    if (state.map?.current_cycle_render || state.currentCycleLoading) return;
    if (state.currentCycleRetryAt && Date.now() < state.currentCycleRetryAt) return;
    const path = currentCyclePath036(memberMapPath036(member));
    if (!path || !card?._hass?.callApi) return;
    state.currentCycleLoading = true;
    try {
      const payload = await callApi036(card, path);
      if (!generationMatches036(card, generation) || !memberById036(card, member.entry_id)) return;
      const render = payload?.current_cycle_render;
      if (render?.scope === "current_cycle" && state.map) {
        state.map = { ...state.map, current_cycle_render: render };
        state.currentCycleRetryAt = 0;
        renderMultiMap036(card, true);
      }
    } catch (error) {
      if (generationMatches036(card, generation)) {
        state.currentCycleRetryAt = Date.now() + MULTI_RENDER_RETRY_MS;
        console.debug("[Navimower Map Card] Deferred current-cycle render unavailable", member.entry_id, error);
      }
    } finally {
      if (generationMatches036(card, generation)) state.currentCycleLoading = false;
    }
  }`, "multi scheduling helpers");

replaceOnce(
  '    card._multi036SiteLoading = true;\n    try {\n      const payload = await callApi036(card, path);\n      card._multi036Site = normalizeSite036(payload);',
  '    const generation = currentGeneration036(card);\n    card._multi036SiteLoading = true;\n    try {\n      const payload = await callApi036(card, path);\n      if (!generationMatches036(card, generation)) return;\n      card._multi036Site = normalizeSite036(payload);',
  "site request generation",
);

replaceBlock(
  '  async function refreshMemberMap036(card, member, force) {',
  '\n\n  async function refreshMemberSessions036',
  String.raw`  async function refreshMemberMap036(card, member, force, generation = currentGeneration036(card)) {
    const state = memberState036(card, member.entry_id);
    const anchorEntry = anchorEntry036(card);
    if (String(member.entry_id) === String(anchorEntry) && card._mapPayload) {
      if (!generationMatches036(card, generation)) return;
      state.map = card._mapPayload;
      state.mapAt = Date.now();
      state.error = null;
      renderMultiMap036(card);
      if (!state.map?.current_cycle_render) void refreshMemberCurrentCycle036(card, member, generation);
      return;
    }
    const interval = memberIsActive036(card, member) ? MAP_REFRESH_ACTIVE_MS : MAP_REFRESH_IDLE_MS;
    if (!force && state.map && Date.now() - state.mapAt < interval) return;
    const path = memberMapPath036(member);
    if (!path) return;
    try {
      const payload = await callApi036(card, addLightweightQuery036(path));
      if (!generationMatches036(card, generation) || !memberById036(card, member.entry_id)) return;
      if (payload) state.map = payload;
      state.mapAt = Date.now();
      state.error = null;
      renderMultiMap036(card);
      if (!state.map?.current_cycle_render) void refreshMemberCurrentCycle036(card, member, generation);
    } catch (error) {
      if (generationMatches036(card, generation)) state.error = error;
    }
  }`,
  "incremental member map loading",
);

replaceBlock(
  '  async function refreshMemberSessions036(card, member, force) {',
  '\n\n  async function refreshMembers036',
  String.raw`  async function refreshMemberSessions036(card, member, force, generation = currentGeneration036(card)) {
    const state = memberState036(card, member.entry_id);
    if (!force && state.sessionsAt && Date.now() - state.sessionsAt < SESSION_REFRESH_MS) return;
    const path = memberSessionsPath036(member);
    if (!path) return;
    try {
      const payload = await callApi036(card, path);
      if (!generationMatches036(card, generation) || !memberById036(card, member.entry_id)) return;
      state.sessions = (Array.isArray(payload?.sessions) ? payload.sessions : [])
        .filter((session) => session && sessionId036(session))
        .map((session) => ({ ...session }))
        .sort((left, right) => (date036(left.started_at ?? left.started_at_ms)?.getTime() || 0) - (date036(right.started_at ?? right.started_at_ms)?.getTime() || 0));
      state.renderTemplate = payload?.session_render_api_path_template || memberRenderTemplate036(member);
      state.sessionsAt = Date.now();
      state.sessionsError = null;
    } catch (error) {
      if (generationMatches036(card, generation)) state.sessionsError = error;
    }
  }

  function scheduleMemberDetails036(card, members, force, generation) {
    if (card._multi036DeferredQueued || card._multi036DeferredLoading) return;
    card._multi036DeferredQueued = true;
    scheduleIdle036(async () => {
      card._multi036DeferredQueued = false;
      if (!generationMatches036(card, generation) || !multiActive036(card)) return;
      card._multi036DeferredLoading = true;
      try {
        await runLimited036(
          members,
          MULTI_REQUEST_CONCURRENCY,
          (member) => refreshMemberSessions036(card, member, force, generation),
        );
        if (!generationMatches036(card, generation)) return;
        card._multi036SessionsRenderKey = null;
        renderMultiSessions036(card);
        if (card._historyDayOffset !== null && card._historyDayOffset !== undefined) {
          await ensureHistoryRenders036(card);
        }
      } finally {
        if (generationMatches036(card, generation)) card._multi036DeferredLoading = false;
      }
    });
  }`,
  "deferred member detail loading",
);

replaceBlock(
  '  async function refreshMembers036(card, force = false) {',
  '\n\n  const sessionRenderEndpoint036',
  String.raw`  async function refreshMembers036(card, force = false) {
    if (!multiActive036(card) || card._multi036MembersLoading) return;
    const generation = currentGeneration036(card);
    const anchor = anchorEntry036(card);
    const members = [...(card._multi036Site?.members || [])].sort((left, right) => {
      const leftRank = memberIsActive036(card, left) ? 0 : String(left.entry_id) === String(anchor) ? 1 : 2;
      const rightRank = memberIsActive036(card, right) ? 0 : String(right.entry_id) === String(anchor) ? 1 : 2;
      return leftRank - rightRank || finite036(left.display_order, 0) - finite036(right.display_order, 0);
    });
    card._multi036MembersLoading = true;
    try {
      await runLimited036(
        members,
        MULTI_REQUEST_CONCURRENCY,
        async (member) => {
          await refreshMemberMap036(card, member, force, generation);
          if (generationMatches036(card, generation)) {
            renderMultiMap036(card);
            renderMultiControls036(card);
          }
        },
      );
      if (generationMatches036(card, generation)) renderMulti036(card);
    } finally {
      if (generationMatches036(card, generation)) card._multi036MembersLoading = false;
    }
    if (generationMatches036(card, generation)) {
      scheduleMemberDetails036(card, members, force, generation);
    }
  }`,
  "prioritized member pipeline",
);

replaceBlock(
  '  async function getSessionRender036(card, member, session) {',
  '\n\n  async function ensureHistoryRenders036',
  String.raw`  async function getSessionRender036(card, member, session) {
    if (!(card._multi036RenderCache instanceof Map)) card._multi036RenderCache = new Map();
    if (!(card._multi036RenderFailures instanceof Map)) card._multi036RenderFailures = new Map();
    const id = sessionId036(session);
    if (!id) return null;
    const key = String(member.entry_id) + ":" + id;
    if (card._multi036RenderCache.has(key)) return card._multi036RenderCache.get(key);
    const failedAt = Number(card._multi036RenderFailures.get(key) || 0);
    if (failedAt && Date.now() - failedAt < MULTI_RENDER_RETRY_MS) return null;
    const generation = currentGeneration036(card);
    try {
      const payload = await callApi036(card, sessionRenderEndpoint036(card, member, id));
      if (!generationMatches036(card, generation) || !memberById036(card, member.entry_id)) return null;
      const render = payload?.render || payload;
      if (render && (String(render?.mowed_area?.path_d || "").trim() || String(render?.travel?.path_d || "").trim())) {
        cacheMultiRender036(card, key, render);
        card._multi036RenderFailures.delete(key);
        return render;
      }
    } catch (error) {
      if (generationMatches036(card, generation)) {
        card._multi036RenderFailures.set(key, Date.now());
        console.debug("[Navimower Map Card] Multi-mower session render unavailable", key, error);
      }
    }
    return null;
  }`,
  "retryable bounded session render cache",
);

replaceOnce(
  String.raw`      await Promise.all((card._multi036Site?.members || []).flatMap((member) => {
        const sessions = sessionsForDay036(card, memberState036(card, member.entry_id).sessions, offset);
        return sessions.map((session) => getSessionRender036(card, member, session));
      }));`,
  String.raw`      const tasks = (card._multi036Site?.members || []).flatMap((member) => {
        const sessions = sessionsForDay036(card, memberState036(card, member.entry_id).sessions, offset);
        return sessions.map((session) => ({ member, session }));
      });
      await runLimited036(
        tasks,
        MULTI_REQUEST_CONCURRENCY,
        ({ member, session }) => getSessionRender036(card, member, session),
      );`,
  "bounded history render loading",
);

replaceOnce(
  '    const errorClass = ["error", "blocked", "unavailable"].includes(mowerState) ? " nm-multi-mower-error" : "";\n    return "<g class=\\"nm-multi-mower" + errorClass + "\\" transform=\\"translate(" + screen[0].toFixed(2) + " " + screen[1].toFixed(2) + ") rotate(" + degrees.toFixed(2) + ") scale(" + scale.toFixed(6) + ") translate(" + (-spec.width / 2).toFixed(2) + " " + (-spec.height / 2).toFixed(2) + ")\\">" + spec.markup + "</g>";',
  '    const errorClass = ["error", "blocked", "unavailable"].includes(mowerState) ? " nm-multi-mower-error" : "";\n    const liveKey = [x.toFixed(3), y.toFixed(3), Number.isFinite(heading) ? heading.toFixed(4) : "", mowerState, zoom.toFixed(3)].join(":");\n    return "<g class=\\"nm-multi-mower" + errorClass + "\\" data-multi-mower-entry=\\"" + esc(member.entry_id) + "\\" data-multi-live-key=\\"" + esc(liveKey) + "\\" transform=\\"translate(" + screen[0].toFixed(2) + " " + screen[1].toFixed(2) + ") rotate(" + degrees.toFixed(2) + ") scale(" + scale.toFixed(6) + ") translate(" + (-spec.width / 2).toFixed(2) + " " + (-spec.height / 2).toFixed(2) + ")\\">" + spec.markup + "</g>";',
  "addressable mower markers",
);

const renderMapAnchor = '  function renderMultiMap036(card, force = false) {';
replaceOnce(renderMapAnchor, String.raw`  const updateMultiMowers036 = (card, site, layout, liveSignature) => {
    if (!card?._multi036Layer || card._multi036LiveRenderKey === liveSignature) return;
    const existing = new Map(
      [...card._multi036Layer.querySelectorAll?.("[data-multi-mower-entry]") || []]
        .map((element) => [String(element.dataset.multiMowerEntry || ""), element]),
    );
    for (const member of site?.members || []) {
      const matrix = memberMatrix036(member, layout);
      const markup = matrix ? mowerMarkup036(card, member, matrix) : "";
      const current = existing.get(String(member.entry_id));
      if (!markup) {
        current?.remove?.();
        continue;
      }
      const holder = document.createElementNS(SVG_NS, "g");
      holder.innerHTML = markup;
      const next = holder.firstElementChild;
      if (!next) continue;
      if (current) {
        if (current.dataset.multiLiveKey !== next.dataset.multiLiveKey) current.replaceWith(next);
      } else {
        card._multi036Layer.appendChild(next);
      }
    }
    card._multi036LiveRenderKey = liveSignature;
  };

` + renderMapAnchor, "selective mower marker updater");

replaceOnce(
  '    const key = [mapSignature, liveSignature, card._historyDayOffset, card._multi036SelectedSessionKey, card?._view?.scale, card?._config?.show_zone_labels, card?._config?.avoid_zone_label_overlap, card?._config?.zone_label_font_size, card?._config?.zone_label_opacity, card?._config?.map_legend_scale, card?._config?.show_channels, card?._config?.show_vf_off_areas, card?._config?.show_gate_areas, card?._config?.show_custom_areas, card?._config?.map_background_color, card?._config?.trail_color, card?._config?.trail_opacity].join("|");\n    if (!force && key === card._multi036MapRenderKey) return;\n    card._multi036MapRenderKey = key;',
  '    const key = [mapSignature, card._historyDayOffset, card._multi036SelectedSessionKey, card?._view?.scale, card?._config?.show_zone_labels, card?._config?.avoid_zone_label_overlap, card?._config?.zone_label_font_size, card?._config?.zone_label_opacity, card?._config?.map_legend_scale, card?._config?.show_channels, card?._config?.show_vf_off_areas, card?._config?.show_gate_areas, card?._config?.show_custom_areas, card?._config?.map_background_color, card?._config?.trail_color, card?._config?.trail_opacity].join("|");\n    if (key === card._multi036MapRenderKey) {\n      updateMultiMowers036(card, site, layout, liveSignature);\n      return;\n    }\n    card._multi036MapRenderKey = key;',
  "separate structural and live render keys",
);

replaceOnce(
  '    layer.innerHTML = parts.join("");\n  }\n\n  const displayName036',
  '    layer.innerHTML = parts.join("");\n    card._multi036LiveRenderKey = liveSignature;\n  }\n\n  const displayName036',
  "store live marker signature",
);

replaceOnce(
  '    const members = card._multi036Site?.members || [];\n    host.style.setProperty("--nm-multi-columns", String(Math.max(1, members.length)));',
  String.raw`    const members = card._multi036Site?.members || [];
    const controlsKey = [
      card?._config?.show_status,
      card?._config?.show_zone,
      card?._config?.show_battery,
      card?._config?.show_position,
      ...members.map((member) => {
        const entities = memberEntities036(member);
        return [
          member.entry_id,
          state036(card, entities.mower)?.state,
          state036(card, entities.mower)?.last_updated,
          state036(card, entities.current_physical_zone)?.state,
          state036(card, entities.battery)?.state,
          state036(card, entities.managed_schedule)?.state,
          state036(card, entities.native_schedule)?.state,
          JSON.stringify(memberState036(card, member.entry_id).command || null),
        ].join(":");
      })
    ].join("|");
    if (controlsKey === card._multi036ControlsRenderKey) return;
    card._multi036ControlsRenderKey = controlsKey;
    host.style.setProperty("--nm-multi-columns", String(Math.max(1, members.length)));`,
  "multi control render fingerprint",
);

replaceOnce(
  '    const offset = card._historyDayOffset === null || card._historyDayOffset === undefined ? 0 : Math.max(0, Number(card._historyDayOffset) || 0);\n    const groups =',
  '    const offset = card._historyDayOffset === null || card._historyDayOffset === undefined ? 0 : Math.max(0, Number(card._historyDayOffset) || 0);\n    const sessionsKey = [offset, card._multi036SelectedSessionKey, ...(card._multi036Site?.members || []).map((member) => String(member.entry_id) + ":" + memberState036(card, member.entry_id).sessionsAt + ":" + memberState036(card, member.entry_id).sessions.length)].join("|");\n    if (sessionsKey === card._multi036SessionsRenderKey) return;\n    card._multi036SessionsRenderKey = sessionsKey;\n    const groups =',
  "multi session render fingerprint",
);

replaceBlock(
  '  async function selectSession036(card, entryId, sessionId, key) {',
  '\n\n  const notificationItems036',
  String.raw`  async function selectSession036(card, entryId, sessionId, key) {
    const member = memberById036(card, entryId);
    if (!member) return;
    const state = memberState036(card, entryId);
    const session = state.sessions.find((item) => sessionId036(item) === String(sessionId));
    if (!session) return;
    const generation = currentGeneration036(card);
    const requestKey = String(key);
    card._multi036PendingSelectionKey = requestKey;
    await getSessionRender036(card, member, session);
    if (
      !generationMatches036(card, generation)
      || card._multi036PendingSelectionKey !== requestKey
      || !memberById036(card, entryId)
    ) return;
    card._multi036SelectedSessionKey = requestKey;
    card._multi036MapRenderKey = null;
    card._multi036SessionsRenderKey = null;
    renderMultiSessions036(card);
    renderMultiMap036(card, true);
    if (card._multi036PulseTimer) clearTimeout(card._multi036PulseTimer);
    card._multi036PulseTimer = setTimeout(() => {
      if (
        generationMatches036(card, generation)
        && card._multi036SelectedSessionKey === requestKey
      ) {
        card._multi036SelectedSessionKey = null;
        card._multi036PendingSelectionKey = null;
        card._multi036MapRenderKey = null;
        card._multi036SessionsRenderKey = null;
        renderMultiSessions036(card);
        renderMultiMap036(card, true);
      }
      card._multi036PulseTimer = null;
    }, 1900);
  }`,
  "last-selection-wins history request",
);

replaceOnce(
  '      if (previousIdentity !== this?._config?.entity) {\n        this._multi036PreferenceLoaded = false;\n        this._multi036Site = null;\n        this._multi036Members = new Map();\n      }',
  '      if (previousIdentity !== this?._config?.entity) {\n        this._multi036Generation = currentGeneration036(this) + 1;\n        this._multi036PreferenceLoaded = false;\n        this._multi036Site = null;\n        this._multi036Members = new Map();\n        this._multi036RenderCache = new Map();\n        this._multi036RenderFailures = new Map();\n        this._multi036PendingSelectionKey = null;\n        this._multi036MapRenderKey = null;\n        this._multi036LiveRenderKey = null;\n        this._multi036ControlsRenderKey = null;\n        this._multi036SessionsRenderKey = null;\n      }',
  "multi identity generation reset",
);

const deferredPatch = String.raw`

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta16Pipeline) return;
  Card.__navimower036Beta16Pipeline = true;
  const proto = Card.prototype;
  const RETRY_MS = 30_000;

  const baseMapPath = (card) => {
    const raw = card?._v030BaseApiPath || card?._apiPath?.();
    return String(raw || "").split(/[?#]/, 1)[0];
  };

  const cyclePath = (card) => {
    const base = baseMapPath(card);
    return base ? base + "?current_cycle_only=1" : null;
  };

  const queueDeferredCycle = (card) => {
    if (!card?._hass?.callApi || card?._mapPayload?.current_cycle_render) return;
    const path = cyclePath(card);
    if (!path) return;
    const now = Date.now();
    if (card._beta16CycleRetryAt && now < card._beta16CycleRetryAt) return;
    const generation = Number(card._beta16CycleGeneration || 0);
    if (card._beta16CycleLoading === path + "|" + generation) return;
    card._beta16CycleLoading = path + "|" + generation;
    const schedule = typeof globalThis.requestIdleCallback === "function"
      ? (callback) => globalThis.requestIdleCallback(callback, { timeout: 800 })
      : (callback) => globalThis.setTimeout(callback, 0);
    schedule(async () => {
      try {
        const payload = await card._hass.callApi("GET", String(path).replace(/^\/api\//, "").replace(/^\/+/, ""));
        if (
          Number(card._beta16CycleGeneration || 0) !== generation
          || cyclePath(card) !== path
        ) return;
        const render = payload?.current_cycle_render;
        if (render?.scope === "current_cycle" && card._mapPayload) {
          card._mapPayload = { ...card._mapPayload, current_cycle_render: render };
          card._historyRenderKey = null;
          card._trailRenderKey = null;
          card._queueRender?.({ history: true, trail: true, sessions: true });
          card._beta16CycleRetryAt = 0;
        }
      } catch (error) {
        if (Number(card._beta16CycleGeneration || 0) === generation) {
          card._beta16CycleRetryAt = Date.now() + RETRY_MS;
          console.debug("[Navimower Map Card] Deferred current-cycle request unavailable", error);
        }
      } finally {
        if (card._beta16CycleLoading === path + "|" + generation) {
          card._beta16CycleLoading = null;
        }
      }
    });
  };

  const previousApply = proto._applyMapPayload;
  if (typeof previousApply === "function") {
    proto._applyMapPayload = function beta16ApplyMapPayload(...args) {
      const result = previousApply.apply(this, args);
      queueDeferredCycle(this);
      return result;
    };
  }

  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function beta16SetConfig(config) {
      const previous = this?._config?.entity || this?._config?.mower_entity || null;
      const result = previousSetConfig.call(this, config);
      const current = this?._config?.entity || this?._config?.mower_entity || null;
      if (previous !== current) {
        this._beta16CycleGeneration = Number(this._beta16CycleGeneration || 0) + 1;
        this._beta16CycleLoading = null;
        this._beta16CycleRetryAt = 0;
      }
      queueDeferredCycle(this);
      return result;
    };
  }

  const previousDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function beta16Disconnected(...args) {
    this._beta16CycleGeneration = Number(this._beta16CycleGeneration || 0) + 1;
    this._multi036Generation = Number(this._multi036Generation || 0) + 1;
    this._multi036PendingSelectionKey = null;
    return previousDisconnected?.apply(this, args);
  };

  proto._beta16PerformanceContract = () => ({
    baseMapFirst: true,
    deferredCurrentCycle: true,
    multiRequestConcurrency: 2,
    retryableSessionRenders: true,
    selectiveMowerUpdates: true,
    completeDaySessions: true,
  });

  console.info("[Navimower Map Card] 0.3.6-beta16 prioritized phased loading enabled");
})();
`;

source += deferredPatch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied beta16 prioritized runtime pipeline");
