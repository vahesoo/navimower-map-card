import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.5-beta2: lazy persistent scheduler runtime.";
if (source.includes(marker)) {
  console.log("Lazy persistent scheduler runtime already applied");
  process.exit(0);
}
if (!source.includes("0.3.4-beta11: responsive managed scheduler editor.")) {
  throw new Error("Expected responsive scheduler editor runtime hook was not found");
}

const patch = String.raw`

// 0.3.5-beta2: lazy persistent scheduler runtime.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta2Patched) return;
  Card.__navimower035Beta2Patched = true;

  const proto = Card.prototype;
  const REGISTRY_FALLBACK_DELAY_MS = 250;
  const SAVE_DEBOUNCE_MS = 750;
  const SAVED_FEEDBACK_MS = 1000;

  const normalizedQueue = (values) => (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter(Number.isFinite);
  const sameQueue = (left, right) => {
    const a = normalizedQueue(left);
    const b = normalizedQueue(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };
  const state = (card, entityId) => entityId ? card?._hass?.states?.[entityId] : null;

  function frontendMetadata(card) {
    const frontend = card?._mapPayload?.frontend;
    const entities = frontend?.entities;
    if (!entities || typeof entities !== "object") return null;
    return { frontend, entities };
  }

  function applyFrontendEntities(card) {
    const metadata = frontendMetadata(card);
    if (!metadata) return false;
    const { frontend, entities } = metadata;
    const map = {
      mower_entity: entities.mower,
      map_entity: entities.map_data,
      x_entity: entities.position_x,
      y_entity: entities.position_y,
      heading_entity: entities.heading,
      battery_entity: entities.battery,
      zone_entity: entities.current_physical_zone,
      schedule_entity: entities.native_schedule_data,
      schedule_switch_entity: entities.native_schedule,
    };
    card._resolved = { ...(card._resolved || {}) };
    for (const [key, entityId] of Object.entries(map)) {
      if (entityId && card._hass?.states?.[entityId]) card._resolved[key] = entityId;
    }
    if (frontend.device_id) card._deviceId = frontend.device_id;
    return true;
  }

  function schedulerIdsFromPayload(card) {
    const metadata = frontendMetadata(card);
    if (!metadata) return null;
    const { frontend, entities } = metadata;
    const status = entities.schedule_status || null;
    if (!status || !card._hass?.states?.[status]) return null;
    return {
      status,
      managedSwitch: entities.managed_schedule || null,
      nativeSwitch: entities.native_schedule || card._scheduleSwitchEntity?.() || null,
      start: entities.schedule_start || null,
      end: entities.schedule_end || null,
      deviceId: frontend.device_id || null,
      configEntryId: card._mapPayload?.entry_id || null,
      source: "map_payload_frontend",
    };
  }

  function syncSchedulerCaches(card, ids) {
    if (!ids) return;
    card._beta10SchedulerEntities = { ...ids, cachedAt: Date.now() };
    card._beta10ScheduleDeviceId = ids.deviceId || card._beta10ScheduleDeviceId || null;
    card._beta6SchedulerEntities = {
      status: ids.status || null,
      managedSwitch: ids.managedSwitch || null,
      nativeSwitch: ids.nativeSwitch || null,
      start: ids.start || null,
      end: ids.end || null,
    };
    card._beta5SchedulerEntities = { ...card._beta6SchedulerEntities };
  }

  async function schedulerIds(card) {
    const fast = schedulerIdsFromPayload(card);
    if (fast) {
      syncSchedulerCaches(card, fast);
      return fast;
    }
    if (typeof card._discoverNavimowerSchedulerEntities === "function") {
      const discovered = await card._discoverNavimowerSchedulerEntities({ force: true });
      if (discovered?.status) syncSchedulerCaches(card, discovered);
      return discovered || {};
    }
    return {};
  }

  // Stop the beta5/beta6 eager entity-registry scans. Their discover functions
  // short-circuit on a truthy cache. The new runtime resolves scheduler metadata
  // from the Map API and falls back to registry discovery only on Schedule click.
  const previousSetConfig = proto.setConfig;
  proto.setConfig = function beta2SetConfig(config) {
    if (!this._beta5SchedulerEntities) this._beta5SchedulerEntities = {};
    if (!this._beta6SchedulerEntities) this._beta6SchedulerEntities = {};
    return previousSetConfig.call(this, config);
  };

  // Core entity registry discovery remains a compatibility fallback for renamed
  // installations, but defer it briefly. Normal Navimower cards load the map via
  // name resolution first; beta44 metadata then supplies exact entity IDs and
  // cancels the large registry response before it is requested.
  const previousRegistryResolve = proto._resolveEntitiesFromRegistry;
  if (typeof previousRegistryResolve === "function") {
    proto._resolveEntitiesFromRegistry = function beta2DeferredRegistryResolve(...args) {
      if (this._beta2RegistryTimer) clearTimeout(this._beta2RegistryTimer);
      return new Promise((resolve) => {
        this._beta2RegistryResolve = resolve;
        this._beta2RegistryTimer = setTimeout(async () => {
          this._beta2RegistryTimer = null;
          this._beta2RegistryResolve = null;
          if (applyFrontendEntities(this)) {
            resolve();
            return;
          }
          try {
            resolve(await previousRegistryResolve.apply(this, args));
          } catch (error) {
            console.debug("[Navimower Map Card] deferred entity discovery failed", error);
            resolve();
          }
        }, REGISTRY_FALLBACK_DELAY_MS);
      });
    };
  }

  const previousApplyMapPayload = proto._applyMapPayload;
  if (typeof previousApplyMapPayload === "function") {
    proto._applyMapPayload = function beta2ApplyMapPayload(...args) {
      const result = previousApplyMapPayload.apply(this, args);
      const applied = applyFrontendEntities(this);
      const ids = schedulerIdsFromPayload(this);
      if (ids) syncSchedulerCaches(this, ids);
      if (applied && this._beta2RegistryTimer) {
        clearTimeout(this._beta2RegistryTimer);
        this._beta2RegistryTimer = null;
        const resolve = this._beta2RegistryResolve;
        this._beta2RegistryResolve = null;
        resolve?.();
      }
      return result;
    };
  }

  function snapshot(card) {
    const ids = card._beta2SchedulerIds || schedulerIdsFromPayload(card) || card._beta10SchedulerEntities || {};
    const statusState = state(card, ids.status);
    return { ids, statusState, attrs: statusState?.attributes || {} };
  }

  function configuredZones(card, attrs) {
    const selected = new Set(normalizedQueue(attrs.selected_zone_ids));
    const names = new Map();
    for (const row of Array.isArray(attrs.queue) ? attrs.queue : []) {
      const id = Number(row?.id);
      if (Number.isFinite(id) && row?.name) names.set(id, String(row.name));
    }
    const available = typeof card._availableMowZones === "function" ? card._availableMowZones() : [];
    for (const row of available) {
      const id = Number(row?.id);
      if (Number.isFinite(id) && row?.name) names.set(id, String(row.name));
    }
    return [...selected].map((id) => ({ id, name: names.get(id) || ("Zone " + id) }));
  }

  function ensureDraft(card, attrs, force = false) {
    const serverQueue = normalizedQueue(attrs.custom_queue);
    if (force || !Array.isArray(card._beta2ScheduleDraft)) {
      card._beta2ScheduleDraft = serverQueue.slice();
      card._beta2ScheduleServerQueue = serverQueue.slice();
      card._beta2ScheduleDirty = false;
      card._beta2ScheduleSaveState = "idle";
    } else if (!card._beta2ScheduleDirty && !sameQueue(serverQueue, card._beta2ScheduleServerQueue)) {
      card._beta2ScheduleDraft = serverQueue.slice();
      card._beta2ScheduleServerQueue = serverQueue.slice();
    }
    return card._beta2ScheduleDraft;
  }

  function markDirty(card) {
    card._beta2ScheduleDirty = !sameQueue(card._beta2ScheduleDraft, card._beta2ScheduleServerQueue);
    if (card._beta2ScheduleSaveState === "saved") card._beta2ScheduleSaveState = "idle";
  }

  function missingZones(card, attrs) {
    const present = new Set(normalizedQueue(card._beta2ScheduleDraft));
    return configuredZones(card, attrs).filter((zone) => !present.has(zone.id));
  }

  function saveLabel(card) {
    if (card._beta2ScheduleSaveState === "saving") return "Saving…";
    if (card._beta2ScheduleSaveState === "saved") return "Saved";
    if (card._beta2ScheduleSaveState === "error") return "Retry save";
    return "Save order";
  }

  function updateIndices(root) {
    root?.querySelectorAll?.("[data-beta2-row]")?.forEach?.((row, index) => {
      row.dataset.beta2Row = String(index);
      const repeat = row.querySelector?.("[data-beta2-repeat]");
      const remove = row.querySelector?.("[data-beta2-remove]");
      const drag = row.querySelector?.("[data-beta2-drag]");
      if (repeat) repeat.dataset.beta2Repeat = String(index);
      if (remove) remove.dataset.beta2Remove = String(index);
      if (drag) drag.dataset.beta2Drag = String(index);
    });
  }

  function updateControls(card, root) {
    if (!root) return;
    const { attrs } = snapshot(card);
    const draft = ensureDraft(card, attrs);
    const editable = (attrs.order_mode || "automatic") === "custom";
    const missing = missingZones(card, attrs);
    const select = root.querySelector?.("[data-beta2-add-select]");
    if (select) {
      const current = select.value;
      select.innerHTML = '<option value="">Add zone…</option>' + missing
        .map((zone) => '<option value="' + zone.id + '">' + String(zone.name).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") + '</option>')
        .join("");
      select.disabled = !editable || missing.length === 0;
      if (missing.some((zone) => String(zone.id) === current)) select.value = current;
    }
    root.querySelectorAll?.("[data-beta2-remove]")?.forEach?.((button) => {
      button.disabled = !editable || draft.length <= 1;
    });
    const save = root.querySelector?.("[data-beta2-save]");
    if (save) {
      save.disabled = !editable || !card._beta2ScheduleDirty || card._beta2ScheduleSaveState === "saving";
      save.textContent = saveLabel(card);
    }
  }

  function zoneNameMap(card, attrs) {
    return new Map(configuredZones(card, attrs).map((zone) => [zone.id, zone.name]));
  }

  function makeZoneRow(card, id, index, attrs) {
    const row = document.createElement("div");
    row.className = "nm-beta2-zone";
    row.dataset.beta2Row = String(index);
    const names = zoneNameMap(card, attrs);
    row.innerHTML =
      '<div class="nm-beta2-actions">' +
        '<ha-icon-button class="nm-beta2-repeat" data-beta2-repeat="' + index + '" title="Repeat zone"><ha-icon icon="mdi:plus"></ha-icon></ha-icon-button>' +
        '<ha-icon-button class="nm-beta2-remove" data-beta2-remove="' + index + '" title="Remove zone"><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>' +
      '</div>' +
      '<div class="nm-beta2-zone-name"></div>' +
      '<ha-icon-button class="nm-beta2-drag" data-beta2-drag="' + index + '" title="Drag to reorder"><ha-icon icon="mdi:drag"></ha-icon></ha-icon-button>';
    const name = row.querySelector(".nm-beta2-zone-name");
    if (name) name.textContent = names.get(Number(id)) || ("Zone " + id);
    return row;
  }

  function bindRow(card, root, row) {
    row.querySelector?.("[data-beta2-repeat]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const index = Number(event.currentTarget.dataset.beta2Repeat);
      const draft = card._beta2ScheduleDraft;
      if (!Array.isArray(draft) || !Number.isInteger(index) || index < 0 || index >= draft.length) return;
      draft.splice(index + 1, 0, draft[index]);
      markDirty(card);
      renderQueue(card, root);
    });
    row.querySelector?.("[data-beta2-remove]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const index = Number(event.currentTarget.dataset.beta2Remove);
      const draft = card._beta2ScheduleDraft;
      if (!Array.isArray(draft) || draft.length <= 1 || !Number.isInteger(index) || index < 0 || index >= draft.length) return;
      draft.splice(index, 1);
      markDirty(card);
      renderQueue(card, root);
    });
    const handle = row.querySelector?.("[data-beta2-drag]");
    handle?.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const index = Number(handle.dataset.beta2Drag);
      if (!Number.isInteger(index)) return;
      card._beta2DragIndex = index;
      card._beta2DragMoved = false;
      handle.setPointerCapture?.(event.pointerId);
      row.classList.add("nm-beta2-dragging");
    });
    handle?.addEventListener("pointermove", (event) => {
      if (!Number.isInteger(card._beta2DragIndex)) return;
      event.preventDefault();
      const scroll = root.querySelector?.("[data-beta2-scroll]");
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        if (event.clientY < rect.top + 54) scroll.scrollBy({ top: -18, behavior: "auto" });
        else if (event.clientY > rect.bottom - 54) scroll.scrollBy({ top: 18, behavior: "auto" });
      }
      const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("[data-beta2-row]");
      if (!target || !root.contains(target)) return;
      const from = card._beta2DragIndex;
      const to = Number(target.dataset.beta2Row);
      if (!Number.isInteger(to) || from === to) return;
      const draft = card._beta2ScheduleDraft;
      if (!Array.isArray(draft) || from < 0 || from >= draft.length || to < 0 || to >= draft.length) return;
      const [item] = draft.splice(from, 1);
      draft.splice(to, 0, item);
      const queue = root.querySelector?.("[data-beta2-queue]");
      const moving = queue?.querySelector?.('[data-beta2-row="' + from + '"]');
      const targetRow = queue?.querySelector?.('[data-beta2-row="' + to + '"]');
      if (moving && targetRow && queue) {
        if (from < to) targetRow.after(moving);
        else targetRow.before(moving);
        updateIndices(root);
      }
      card._beta2DragIndex = to;
      card._beta2DragMoved = true;
    });
    const finish = () => {
      if (Number.isInteger(card._beta2DragIndex)) {
        card._beta2DragIndex = null;
        if (card._beta2DragMoved) markDirty(card);
        card._beta2DragMoved = false;
        root.querySelectorAll?.(".nm-beta2-dragging")?.forEach?.((item) => item.classList.remove("nm-beta2-dragging"));
        updateControls(card, root);
      }
    };
    handle?.addEventListener("pointerup", finish);
    handle?.addEventListener("pointercancel", finish);
  }

  function renderQueue(card, root) {
    const queue = root?.querySelector?.("[data-beta2-queue]");
    if (!queue) return;
    const { attrs } = snapshot(card);
    const draft = ensureDraft(card, attrs);
    queue.textContent = "";
    draft.forEach((id, index) => {
      const row = makeZoneRow(card, id, index, attrs);
      queue.append(row);
      bindRow(card, root, row);
    });
    updateControls(card, root);
  }

  async function mountTimeRows(card, root) {
    const { ids } = snapshot(card);
    const list = root?.querySelector?.("[data-beta2-time-list]");
    if (!list || list.dataset.mounted === "1") return;
    const entries = [[ids.start, "Start"], [ids.end, "End"]].filter(([entityId]) => Boolean(entityId));
    if (!entries.length) {
      list.textContent = "Schedule time entities are unavailable.";
      return;
    }
    try {
      const helpers = await globalThis.loadCardHelpers?.();
      if (!helpers || typeof helpers.createRowElement !== "function") throw new Error("Home Assistant createRowElement helper is unavailable");
      if (!card._beta2ScheduleOpen || !list.isConnected) return;
      list.textContent = "";
      for (const [entityId, label] of entries) {
        const wrap = document.createElement("div");
        wrap.className = "nm-beta2-native-row";
        const row = helpers.createRowElement({ entity: entityId, name: label });
        row.dataset.beta2TimeRow = entityId;
        row.hass = card._hass;
        wrap.append(row);
        list.append(wrap);
      }
      list.dataset.mounted = "1";
    } catch (error) {
      console.warn("[Navimower Map Card] native schedule time rows unavailable", error);
      list.textContent = "";
      for (const [entityId, label] of entries) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nm-beta2-time-fallback";
        button.textContent = label + " — " + (state(card, entityId)?.state || "unavailable");
        button.addEventListener("click", () => card.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })));
        list.append(button);
      }
      list.dataset.mounted = "1";
    }
  }

  function updateDialogState(card) {
    const root = card._modalHostEl?.querySelector?.("[data-beta2-root]");
    if (!root || !card._beta2ScheduleOpen) return;
    const { statusState, attrs } = snapshot(card);
    const status = root.querySelector?.("[data-beta2-status]");
    if (status) status.textContent = statusState?.state || "unavailable";
    root.querySelectorAll?.("[data-beta2-time-row]")?.forEach?.((row) => { row.hass = card._hass; });
    const serverQueue = normalizedQueue(attrs.custom_queue);
    if (!card._beta2ScheduleDirty && !sameQueue(serverQueue, card._beta2ScheduleServerQueue)) {
      card._beta2ScheduleServerQueue = serverQueue.slice();
      card._beta2ScheduleDraft = serverQueue.slice();
      renderQueue(card, root);
    } else {
      updateControls(card, root);
    }
  }

  function closeDialog(card) {
    card._beta2ScheduleOpen = false;
    card._beta2DragIndex = null;
    card._beta2ScheduleDraft = null;
    card._beta2ScheduleServerQueue = null;
    card._beta2ScheduleDirty = false;
    card._beta2ScheduleSaveState = "idle";
    card._renderDialog();
  }

  async function saveDraft(card) {
    if (!card._beta2ScheduleDirty || card._beta2ScheduleSaveState === "saving") return false;
    const draft = normalizedQueue(card._beta2ScheduleDraft);
    if (!draft.length) return false;
    card._beta2ScheduleSaveState = "saving";
    updateDialogState(card);
    await new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_MS));
    const data = { zones: draft };
    const deviceId = card._beta2SchedulerIds?.deviceId || card._beta10ScheduleDeviceId || card._deviceId;
    if (deviceId) data.device_id = deviceId;
    try {
      await card._hass.callService("navimower", "set_schedule_queue", data);
      card._beta2ScheduleServerQueue = draft.slice();
      card._beta2ScheduleDirty = false;
      card._beta2ScheduleSaveState = "saved";
      updateDialogState(card);
      setTimeout(() => {
        if (card._beta2ScheduleSaveState === "saved") {
          card._beta2ScheduleSaveState = "idle";
          updateDialogState(card);
        }
      }, SAVED_FEEDBACK_MS);
      return true;
    } catch (error) {
      console.warn("[Navimower Map Card] custom schedule queue save failed", error);
      card._beta2ScheduleSaveState = "error";
      updateDialogState(card);
      return false;
    }
  }

  function renderPersistentDialog(card) {
    const host = card._modalHostEl;
    if (!host || !card._beta2ScheduleOpen) return;
    const existing = host.querySelector?.("[data-beta2-root]");
    if (existing) {
      updateDialogState(card);
      return;
    }
    const { statusState, attrs } = snapshot(card);
    ensureDraft(card, attrs, true);
    const editable = (attrs.order_mode || "automatic") === "custom";
    host.innerHTML =
      '<div class="nm-backdrop nm-beta2-backdrop" data-beta2-root>' +
        '<div class="nm-dialog nm-beta2-dialog">' +
          '<style>' +
            '.nm-beta2-dialog{width:min(94vw,680px);max-height:min(88vh,860px);display:flex;flex-direction:column;overflow:hidden;}' +
            '.nm-beta2-scroll{overflow-y:auto;overscroll-behavior:contain;min-height:0;padding-bottom:8px;}' +
            '.nm-beta2-section{padding:10px 16px 2px;}' +
            '.nm-beta2-section-title{font-weight:650;margin:0 0 6px;}' +
            '.nm-beta2-status{color:var(--secondary-text-color);font-size:.92em;margin-top:2px;}' +
            '.nm-beta2-native-row{padding:0;border-bottom:1px solid var(--divider-color);}' +
            '.nm-beta2-native-row:last-child{border-bottom:0;}' +
            '.nm-beta2-time-fallback{display:block;width:100%;padding:12px 4px;border:0;border-bottom:1px solid var(--divider-color);background:transparent;color:var(--primary-text-color);text-align:left;font:inherit;}' +
            '.nm-beta2-queue{display:grid;gap:6px;}' +
            '.nm-beta2-zone{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:4px;min-height:48px;padding:2px 6px;border-radius:12px;background:var(--secondary-background-color);touch-action:pan-y;}' +
            '.nm-beta2-actions{display:flex;align-items:center;gap:0;}' +
            '.nm-beta2-zone-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 4px;}' +
            '.nm-beta2-repeat{color:var(--success-color,#43a047);}' +
            '.nm-beta2-remove{color:var(--error-color,#db4437);}' +
            '.nm-beta2-drag{color:var(--secondary-text-color);touch-action:none;cursor:grab;}' +
            '.nm-beta2-dragging{opacity:.72;box-shadow:0 2px 8px rgba(0,0,0,.22);}' +
            '.nm-beta2-add{margin-top:8px;}' +
            '.nm-beta2-add select{box-sizing:border-box;width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit;}' +
            '.nm-beta2-add select:disabled{opacity:.45;}' +
            '.nm-beta2-footer{position:sticky;bottom:0;flex:0 0 auto;padding:10px 16px 14px;border-top:1px solid var(--divider-color);background:var(--card-background-color);}' +
            '.nm-beta2-save{width:100%;min-height:48px;border:0;border-radius:14px;background:var(--primary-color);color:var(--text-primary-color,#fff);font:inherit;font-weight:650;}' +
            '.nm-beta2-save:disabled{opacity:.42;}' +
          '</style>' +
          '<div class="nm-schedule-dialog-head"><div><div class="nm-schedule-dialog-title">Navimower schedule</div><div class="nm-beta2-status" data-beta2-status></div></div><button class="nm-schedule-close" type="button" data-beta2-close><ha-icon icon="mdi:close"></ha-icon></button></div>' +
          '<div class="nm-beta2-scroll" data-beta2-scroll>' +
            '<section class="nm-beta2-section"><div class="nm-beta2-section-title">Time window</div><div data-beta2-time-list>Loading Home Assistant controls…</div></section>' +
            '<section class="nm-beta2-section"><div class="nm-beta2-section-title">Custom order</div><div class="nm-beta2-queue" data-beta2-queue></div><div class="nm-beta2-add"><select data-beta2-add-select><option value="">Add zone…</option></select></div></section>' +
          '</div>' +
          '<div class="nm-beta2-footer"><button type="button" class="nm-beta2-save" data-beta2-save>Save order</button></div>' +
        '</div>' +
      '</div>';
    const root = host.querySelector("[data-beta2-root]");
    root.querySelector("[data-beta2-status]").textContent = statusState?.state || "unavailable";
    root.querySelector("[data-beta2-close]")?.addEventListener("click", () => closeDialog(card));
    root.querySelector("[data-beta2-add-select]")?.addEventListener("change", (event) => {
      const id = Number(event.currentTarget.value);
      if (!Number.isFinite(id)) return;
      const missing = new Set(missingZones(card, snapshot(card).attrs).map((zone) => zone.id));
      if (!missing.has(id)) return;
      card._beta2ScheduleDraft.push(id);
      markDirty(card);
      renderQueue(card, root);
    });
    root.querySelector("[data-beta2-save]")?.addEventListener("click", () => { void saveDraft(card); });
    renderQueue(card, root);
    void mountTimeRows(card, root);
    if (!editable) updateControls(card, root);
  }

  const previousRenderDialog = proto._renderDialog;
  proto._renderDialog = function beta2RenderDialog(...args) {
    if (this._beta2ScheduleOpen) {
      renderPersistentDialog(this);
      return;
    }
    return previousRenderDialog?.apply(this, args);
  };

  const previousOpenSchedule = proto._openScheduleDialog;
  proto._openScheduleDialog = async function beta2OpenSchedule(...args) {
    const mode = this._config?.schedule_view_mode || "auto";
    if (mode === "native") {
      this._beta2ScheduleOpen = false;
      return previousOpenSchedule?.apply(this, args);
    }
    const ids = await schedulerIds(this);
    const statusState = state(this, ids.status);
    const enabledAttr = statusState?.attributes?.enabled;
    const managedOn = typeof enabledAttr === "boolean"
      ? enabledAttr
      : String(state(this, ids.managedSwitch)?.state || "").toLowerCase() === "on";
    if (ids.status && (mode === "navimower" || (mode === "auto" && managedOn))) {
      this._beta2SchedulerIds = ids;
      this._beta2ScheduleOpen = true;
      this._beta5ManagedScheduleOpen = false;
      this._beta6ManagedOpen = false;
      this._beta8SettingsOpen = false;
      this._beta6SettingsOpen = false;
      this._scheduleDialogOpen = false;
      this._mowDialogOpen = false;
      renderPersistentDialog(this);
      return;
    }
    this._beta2ScheduleOpen = false;
    syncSchedulerCaches(this, ids);
    return previousOpenSchedule?.apply(this, args);
  };

  // Legacy hass wrappers only rebuild the managed scheduler when their old flag
  // is active. beta2 uses a separate flag and keeps its DOM stable; each HA
  // update merely refreshes native rows/status/control states.
  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");
  if (previousHass?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: previousHass.get,
      set(value) {
        previousHass.set.call(this, value);
        if (this._beta2ScheduleOpen) updateDialogState(this);
      },
    });
  }

  // Testable helpers for the draft model and metadata fast path.
  proto._beta2ApplyFrontendEntities = function () { return applyFrontendEntities(this); };
  proto._beta2SchedulerIdsFromPayload = function () { return schedulerIdsFromPayload(this); };
  proto._beta2ScheduleMissingZones = function () {
    const { attrs } = snapshot(this);
    ensureDraft(this, attrs);
    return missingZones(this, attrs);
  };
  proto._beta2ScheduleSaveDraft = function () { return saveDraft(this); };

  console.info("[Navimower Map Card] 0.3.5-beta2 lazy persistent scheduler runtime enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied lazy persistent scheduler runtime");
