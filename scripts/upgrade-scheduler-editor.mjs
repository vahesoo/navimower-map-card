import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.4-beta11: responsive managed scheduler editor.";
if (source.includes(marker)) {
  console.log("Responsive scheduler editor upgrade already applied");
  process.exit(0);
}

if (!source.includes("0.3.4-beta10: resilient Navimower scheduler discovery.")) {
  throw new Error("Expected beta10 scheduler discovery runtime hook was not found");
}
if (!source.includes("0.3.4-beta8: native Home Assistant Settings rows and single-dialog flow.")) {
  throw new Error("Expected beta8 native Home Assistant row support was not found");
}

const patch = String.raw`

// 0.3.4-beta11: responsive managed scheduler editor.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower034Beta11Patched) return;
  Card.__navimower034Beta11Patched = true;

  const proto = Card.prototype;
  const SAVE_DEBOUNCE_MS = 750;
  const SAVED_FEEDBACK_MS = 1000;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const state = (card, entityId) => entityId ? card?._hass?.states?.[entityId] : null;
  const normalizedQueue = (values) => (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter(Number.isFinite);
  const sameQueue = (left, right) => {
    const a = normalizedQueue(left);
    const b = normalizedQueue(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };

  function statusSnapshot(card) {
    const ids = card._beta10SchedulerEntities || card._beta6SchedulerEntities || {};
    const statusState = state(card, ids.status);
    const attrs = statusState?.attributes || {};
    return { ids, statusState, attrs };
  }

  function configuredZones(card, attrs) {
    const selected = new Set(normalizedQueue(attrs.selected_zone_ids));
    const names = new Map();
    for (const row of Array.isArray(attrs.queue) ? attrs.queue : []) {
      const id = Number(row?.id);
      if (Number.isFinite(id)) names.set(id, row?.name || ("Zone " + id));
    }
    const available = typeof card._availableMowZones === "function" ? card._availableMowZones() : [];
    for (const row of available) {
      const id = Number(row?.id);
      if (Number.isFinite(id)) names.set(id, row?.name || ("Zone " + id));
    }
    return [...selected].map((id) => ({ id, name: names.get(id) || ("Zone " + id) }));
  }

  function ensureDraft(card, attrs, force = false) {
    const serverQueue = normalizedQueue(attrs.custom_queue);
    if (force || !Array.isArray(card._beta11ScheduleDraft)) {
      card._beta11ScheduleDraft = serverQueue.slice();
      card._beta11ScheduleServerQueue = serverQueue.slice();
      card._beta11ScheduleDirty = false;
      card._beta11ScheduleSaveState = "idle";
      return card._beta11ScheduleDraft;
    }
    if (!card._beta11ScheduleDirty && !sameQueue(serverQueue, card._beta11ScheduleServerQueue)) {
      card._beta11ScheduleDraft = serverQueue.slice();
      card._beta11ScheduleServerQueue = serverQueue.slice();
    }
    return card._beta11ScheduleDraft;
  }

  function markDirty(card) {
    card._beta11ScheduleDirty = !sameQueue(card._beta11ScheduleDraft, card._beta11ScheduleServerQueue);
    if (card._beta11ScheduleSaveState === "saved") card._beta11ScheduleSaveState = "idle";
  }

  function missingZones(card) {
    const { attrs } = statusSnapshot(card);
    const present = new Set(normalizedQueue(card._beta11ScheduleDraft));
    return configuredZones(card, attrs).filter((zone) => !present.has(zone.id));
  }

  proto._managedScheduleMissingZones = function () {
    ensureDraft(this, statusSnapshot(this).attrs);
    return missingZones(this);
  };

  proto._managedScheduleMoveDraft = function (from, to) {
    const draft = ensureDraft(this, statusSnapshot(this).attrs);
    const source = Number(from);
    const target = Number(to);
    if (!Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0 || source >= draft.length || target >= draft.length || source === target) return false;
    const [item] = draft.splice(source, 1);
    draft.splice(target, 0, item);
    markDirty(this);
    return true;
  };

  proto._managedScheduleRepeatDraft = function (index) {
    const draft = ensureDraft(this, statusSnapshot(this).attrs);
    const at = Number(index);
    if (!Number.isInteger(at) || at < 0 || at >= draft.length) return false;
    draft.splice(at + 1, 0, draft[at]);
    markDirty(this);
    return true;
  };

  proto._managedScheduleRemoveDraft = function (index) {
    const draft = ensureDraft(this, statusSnapshot(this).attrs);
    const at = Number(index);
    if (!Number.isInteger(at) || at < 0 || at >= draft.length || draft.length <= 1) return false;
    draft.splice(at, 1);
    markDirty(this);
    return true;
  };

  proto._managedScheduleAddDraftZone = function (zoneId) {
    const id = Number(zoneId);
    if (!Number.isFinite(id)) return false;
    const allowed = new Set(this._managedScheduleMissingZones().map((zone) => zone.id));
    if (!allowed.has(id)) return false;
    ensureDraft(this, statusSnapshot(this).attrs).push(id);
    markDirty(this);
    return true;
  };

  proto._managedScheduleResetDraft = function () {
    ensureDraft(this, statusSnapshot(this).attrs, true);
  };

  proto._managedScheduleSaveDraft = async function () {
    const draft = ensureDraft(this, statusSnapshot(this).attrs).slice();
    if (!draft.length || !this._beta11ScheduleDirty || this._beta11ScheduleSaveState === "saving") return false;
    this._beta11ScheduleSaveState = "saving";
    renderManaged(this);
    if (this._beta11ScheduleSaveTimer) clearTimeout(this._beta11ScheduleSaveTimer);
    await new Promise((resolve) => {
      this._beta11ScheduleSaveTimer = setTimeout(resolve, SAVE_DEBOUNCE_MS);
    });
    const data = { zones: draft };
    const deviceId = this._beta10ScheduleDeviceId || this._mowerDeviceId?.();
    if (deviceId) data.device_id = deviceId;
    try {
      await this._hass.callService("navimower", "set_schedule_queue", data);
      this._beta11ScheduleServerQueue = draft.slice();
      this._beta11ScheduleDirty = false;
      this._beta11ScheduleSaveState = "saved";
      renderManaged(this);
      setTimeout(() => {
        if (this._beta11ScheduleSaveState === "saved") {
          this._beta11ScheduleSaveState = "idle";
          renderManaged(this);
        }
      }, SAVED_FEEDBACK_MS);
      return true;
    } catch (error) {
      console.warn("[Navimower Map Card] custom schedule queue save failed", error);
      this._beta11ScheduleSaveState = "error";
      renderManaged(this);
      return false;
    }
  };

  function queueNames(card, attrs) {
    const names = new Map(configuredZones(card, attrs).map((zone) => [zone.id, zone.name]));
    for (const row of Array.isArray(attrs.queue) ? attrs.queue : []) {
      const id = Number(row?.id);
      if (Number.isFinite(id) && row?.name) names.set(id, row.name);
    }
    return names;
  }

  function updateNativeRows(card, root) {
    root?.querySelectorAll?.("[data-beta11-time-row]")?.forEach?.((row) => { row.hass = card._hass; });
  }

  async function mountTimeRows(card, root, token) {
    const { ids } = statusSnapshot(card);
    const list = root?.querySelector?.("[data-beta11-time-list]");
    if (!list) return;
    const entities = [ids.start, ids.end].filter(Boolean);
    if (!entities.length) {
      list.innerHTML = '<div class="nm-beta11-muted">Schedule time entities are unavailable.</div>';
      return;
    }
    try {
      const helpers = await globalThis.loadCardHelpers?.();
      if (!helpers || typeof helpers.createRowElement !== "function") throw new Error("Home Assistant createRowElement helper is unavailable");
      if (!card._beta6ManagedOpen || card._beta11ScheduleRenderToken !== token || !list.isConnected) return;
      list.textContent = "";
      for (const entityId of entities) {
        const wrapper = document.createElement("div");
        wrapper.className = "nm-beta11-native-row";
        const row = helpers.createRowElement({ entity: entityId });
        row.dataset.beta11TimeRow = entityId;
        row.hass = card._hass;
        wrapper.append(row);
        list.append(wrapper);
      }
    } catch (error) {
      console.warn("[Navimower Map Card] native schedule time rows unavailable", error);
      if (!card._beta6ManagedOpen || card._beta11ScheduleRenderToken !== token || !list.isConnected) return;
      list.textContent = "";
      for (const entityId of entities) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nm-beta11-time-fallback";
        const rowState = state(card, entityId);
        button.textContent = (rowState?.attributes?.friendly_name || entityId) + " — " + (rowState?.state || "unavailable");
        button.addEventListener("click", () => card.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })));
        list.append(button);
      }
    }
  }

  function dragAutoScroll(root, clientY) {
    const content = root?.querySelector?.("[data-beta11-scroll]");
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const edge = 54;
    if (clientY < rect.top + edge) content.scrollBy({ top: -18, behavior: "auto" });
    else if (clientY > rect.bottom - edge) content.scrollBy({ top: 18, behavior: "auto" });
  }

  function bindDrag(card, root) {
    root.querySelectorAll("[data-beta11-drag]").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        const start = Number(handle.dataset.beta11Drag);
        if (!Number.isInteger(start)) return;
        card._beta11DragIndex = start;
        handle.setPointerCapture?.(event.pointerId);
        root.querySelector('[data-beta11-row="' + start + '"]')?.classList?.add("nm-beta11-dragging");
      });
      handle.addEventListener("pointermove", (event) => {
        if (!Number.isInteger(card._beta11DragIndex)) return;
        event.preventDefault();
        dragAutoScroll(root, event.clientY);
        const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("[data-beta11-row]");
        if (!target || !root.contains(target)) return;
        const targetIndex = Number(target.dataset.beta11Row);
        const from = card._beta11DragIndex;
        if (!Number.isInteger(targetIndex) || targetIndex === from) return;
        if (card._managedScheduleMoveDraft(from, targetIndex)) {
          card._beta11DragIndex = targetIndex;
          renderManaged(card, { preserveScroll: true });
        }
      });
      const finish = () => {
        card._beta11DragIndex = null;
        root.querySelectorAll(".nm-beta11-dragging").forEach((row) => row.classList.remove("nm-beta11-dragging"));
      };
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });
  }

  function saveLabel(card) {
    if (card._beta11ScheduleSaveState === "saving") return "Saving…";
    if (card._beta11ScheduleSaveState === "saved") return "Saved";
    if (card._beta11ScheduleSaveState === "error") return "Retry save";
    return "Save order";
  }

  function renderManaged(card, options = {}) {
    const host = card._modalHostEl;
    if (!host || !card._beta6ManagedOpen) return;
    const previousScroll = options.preserveScroll ? host.querySelector?.("[data-beta11-scroll]")?.scrollTop || 0 : 0;
    const { statusState, attrs } = statusSnapshot(card);
    const draft = ensureDraft(card, attrs);
    const names = queueNames(card, attrs);
    const missing = missingZones(card);
    const editable = (attrs.order_mode || "automatic") === "custom";
    const token = (card._beta11ScheduleRenderToken || 0) + 1;
    card._beta11ScheduleRenderToken = token;

    const rows = draft.map((id, index) =>
      '<div class="nm-beta11-zone" data-beta11-row="' + index + '">' +
        '<div class="nm-beta11-zone-actions">' +
          '<ha-icon-button class="nm-beta11-repeat" data-beta11-repeat="' + index + '" title="Repeat zone"><ha-icon icon="mdi:plus"></ha-icon></ha-icon-button>' +
          '<ha-icon-button class="nm-beta11-remove" data-beta11-remove="' + index + '" title="Remove zone"' + (draft.length <= 1 ? ' disabled' : '') + '><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>' +
        '</div>' +
        '<div class="nm-beta11-zone-name">' + esc(names.get(id) || ("Zone " + id)) + '</div>' +
        '<ha-icon-button class="nm-beta11-drag" data-beta11-drag="' + index + '" title="Drag to reorder"><ha-icon icon="mdi:drag"></ha-icon></ha-icon-button>' +
      '</div>'
    ).join("");

    const addOptions = missing.map((zone) => '<option value="' + zone.id + '">' + esc(zone.name) + '</option>').join("");
    const addDisabled = !editable || missing.length === 0;
    const saveDisabled = !editable || !card._beta11ScheduleDirty || card._beta11ScheduleSaveState === "saving";

    host.innerHTML =
      '<div class="nm-backdrop nm-beta11-backdrop" data-beta11-root>' +
        '<div class="nm-dialog nm-beta11-dialog">' +
          '<style>' +
            '.nm-beta11-dialog{width:min(94vw,680px);max-height:min(88vh,860px);display:flex;flex-direction:column;overflow:hidden;}' +
            '.nm-beta11-head{flex:0 0 auto;}' +
            '.nm-beta11-scroll{overflow-y:auto;overscroll-behavior:contain;padding:0 0 14px;min-height:0;}' +
            '.nm-beta11-section{padding:14px 16px 4px;}' +
            '.nm-beta11-section-title{font-weight:650;margin:0 0 8px;}' +
            '.nm-beta11-status{color:var(--secondary-text-color);font-size:.92em;margin-top:2px;}' +
            '.nm-beta11-native-row{padding:2px 0;border-bottom:1px solid var(--divider-color);}' +
            '.nm-beta11-native-row:last-child{border-bottom:0;}' +
            '.nm-beta11-time-fallback{display:block;width:100%;padding:14px 4px;border:0;border-bottom:1px solid var(--divider-color);background:transparent;color:var(--primary-text-color);text-align:left;font:inherit;}' +
            '.nm-beta11-muted{color:var(--secondary-text-color);padding:10px 0;}' +
            '.nm-beta11-queue{display:grid;gap:8px;}' +
            '.nm-beta11-zone{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 8px;border-radius:14px;background:var(--secondary-background-color);touch-action:pan-y;}' +
            '.nm-beta11-zone-actions{display:flex;align-items:center;gap:2px;}' +
            '.nm-beta11-zone-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:8px 2px;}' +
            '.nm-beta11-repeat{color:var(--success-color,#43a047);}' +
            '.nm-beta11-remove{color:var(--error-color,#db4437);}' +
            '.nm-beta11-drag{color:var(--secondary-text-color);touch-action:none;cursor:grab;}' +
            '.nm-beta11-dragging{outline:2px solid var(--primary-color);opacity:.78;}' +
            '.nm-beta11-add{display:flex;gap:8px;align-items:center;margin-top:10px;}' +
            '.nm-beta11-add select{flex:1;min-width:0;height:42px;border:1px solid var(--divider-color);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color);padding:0 10px;font:inherit;}' +
            '.nm-beta11-add button{height:42px;border:0;border-radius:10px;padding:0 16px;background:var(--primary-color);color:var(--text-primary-color,#fff);font:inherit;font-weight:600;}' +
            '.nm-beta11-add button:disabled,.nm-beta11-add select:disabled{opacity:.42;}' +
            '.nm-beta11-footer{flex:0 0 auto;position:sticky;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--divider-color);background:var(--card-background-color);}' +
            '.nm-beta11-save{width:100%;min-height:46px;border:0;border-radius:12px;background:var(--primary-color);color:var(--text-primary-color,#fff);font:inherit;font-weight:700;}' +
            '.nm-beta11-save:disabled{opacity:.42;}' +
          '</style>' +
          '<div class="nm-schedule-dialog-head nm-beta11-head">' +
            '<div><div class="nm-schedule-dialog-title">Navimower schedule</div><div class="nm-beta11-status">' + esc(statusState?.state || "Unavailable") + '</div></div>' +
            '<button class="nm-schedule-close" type="button" data-beta11-close><ha-icon icon="mdi:close"></ha-icon></button>' +
          '</div>' +
          '<div class="nm-beta11-scroll" data-beta11-scroll>' +
            '<section class="nm-beta11-section"><div class="nm-beta11-section-title">Time window</div><div data-beta11-time-list><div class="nm-beta11-muted">Loading Home Assistant controls…</div></div></section>' +
            '<section class="nm-beta11-section"><div class="nm-beta11-section-title">Custom order</div>' +
              '<div class="nm-beta11-queue">' + (rows || '<div class="nm-beta11-muted">No queue available.</div>') + '</div>' +
              '<div class="nm-beta11-add">' +
                '<select data-beta11-add-select' + (addDisabled ? ' disabled' : '') + '><option value="">Add zone…</option>' + addOptions + '</select>' +
                '<button type="button" data-beta11-add' + (addDisabled ? ' disabled' : '') + '>Add zone</button>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<div class="nm-beta11-footer"><button type="button" class="nm-beta11-save" data-beta11-save' + (saveDisabled ? ' disabled' : '') + '>' + esc(saveLabel(card)) + '</button></div>' +
        '</div>' +
      '</div>';

    const root = host.querySelector("[data-beta11-root]");
    const scroll = root?.querySelector?.("[data-beta11-scroll]");
    if (scroll && previousScroll) scroll.scrollTop = previousScroll;

    root?.querySelector?.("[data-beta11-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card._beta11ScheduleDraft = null;
      card._beta11ScheduleServerQueue = null;
      card._beta11ScheduleDirty = false;
      card._beta11ScheduleSaveState = "idle";
      card._beta11DragIndex = null;
      card._beta6ManagedOpen = false;
      card._renderDialog();
    });
    root?.querySelectorAll?.("[data-beta11-repeat]")?.forEach?.((button) => button.addEventListener("click", () => {
      if (card._managedScheduleRepeatDraft(Number(button.dataset.beta11Repeat))) renderManaged(card, { preserveScroll: true });
    }));
    root?.querySelectorAll?.("[data-beta11-remove]")?.forEach?.((button) => button.addEventListener("click", () => {
      if (card._managedScheduleRemoveDraft(Number(button.dataset.beta11Remove))) renderManaged(card, { preserveScroll: true });
    }));
    const addSelect = root?.querySelector?.("[data-beta11-add-select]");
    root?.querySelector?.("[data-beta11-add]")?.addEventListener("click", () => {
      if (card._managedScheduleAddDraftZone(Number(addSelect?.value))) renderManaged(card, { preserveScroll: true });
    });
    root?.querySelector?.("[data-beta11-save]")?.addEventListener("click", () => { void card._managedScheduleSaveDraft(); });
    bindDrag(card, root);
    void mountTimeRows(card, root, token);
  }

  const previousDialog = proto._renderDialog;
  proto._renderDialog = function (...args) {
    if (this._beta6ManagedOpen) {
      renderManaged(this);
      return;
    }
    return previousDialog?.apply(this, args);
  };

  const previousOpenSchedule = proto._openScheduleDialog;
  proto._openScheduleDialog = async function (...args) {
    const wasOpen = this._beta6ManagedOpen;
    const result = await previousOpenSchedule?.apply(this, args);
    if (!wasOpen && this._beta6ManagedOpen) {
      const { attrs } = statusSnapshot(this);
      ensureDraft(this, attrs, true);
      renderManaged(this);
    }
    return result;
  };

  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");
  if (previousHass?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: previousHass.get,
      set(value) {
        const managedOpen = Boolean(this._beta6ManagedOpen);
        if (managedOpen) this._beta6ManagedOpen = false;
        previousHass.set.call(this, value);
        if (managedOpen) {
          this._beta6ManagedOpen = true;
          const root = this._modalHostEl?.querySelector?.("[data-beta11-root]");
          if (root) updateNativeRows(this, root);
          renderManaged(this, { preserveScroll: true });
        }
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.4-beta11 responsive managed scheduler editor enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied responsive managed scheduler editor upgrade");
