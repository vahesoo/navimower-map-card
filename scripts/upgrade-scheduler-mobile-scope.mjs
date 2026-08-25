import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.5-beta3: mobile scheduler scope and interaction fixes.";
if (source.includes(marker)) {
  console.log("Mobile scheduler scope upgrade already applied");
  process.exit(0);
}
if (!source.includes("0.3.5-beta2: lazy persistent scheduler runtime.")) {
  throw new Error("Expected beta2 scheduler runtime hook was not found");
}

const patch = String.raw`

// 0.3.5-beta3: mobile scheduler scope and interaction fixes.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta3Patched) return;
  Card.__navimower035Beta3Patched = true;

  const proto = Card.prototype;
  const emptySchedulerIds = () => ({
    status: null,
    managedSwitch: null,
    nativeSwitch: null,
    start: null,
    end: null,
    deviceId: null,
    configEntryId: null,
    source: "none",
  });
  const normalizedQueue = (values) => (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter(Number.isFinite);
  const sameQueue = (left, right) => {
    const a = normalizedQueue(left);
    const b = normalizedQueue(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };
  const state = (card, entityId) => entityId ? card?._hass?.states?.[entityId] : null;

  function payloadFrontend(card) {
    const frontend = card?._mapPayload?.frontend;
    const entities = frontend?.entities;
    if (!frontend || !entities || typeof entities !== "object") return null;
    return { frontend, entities };
  }

  function scopedSchedulerIds(card) {
    const metadata = payloadFrontend(card);
    if (!metadata) return null;
    const { frontend, entities } = metadata;
    const status = entities.schedule_status || null;
    if (!status || !state(card, status)) {
      return {
        ...emptySchedulerIds(),
        nativeSwitch: entities.native_schedule || card._scheduleSwitchEntity?.() || null,
        deviceId: frontend.device_id || null,
        configEntryId: card?._mapPayload?.entry_id || null,
        source: "map_payload_frontend_no_managed_schedule",
        authoritative: true,
      };
    }
    return {
      status,
      managedSwitch: entities.managed_schedule || null,
      nativeSwitch: entities.native_schedule || card._scheduleSwitchEntity?.() || null,
      start: entities.schedule_start || null,
      end: entities.schedule_end || null,
      deviceId: frontend.device_id || null,
      configEntryId: card?._mapPayload?.entry_id || null,
      source: "map_payload_frontend",
      authoritative: true,
    };
  }

  function clearManagedCaches(card, keepDeviceId = null) {
    card._beta2SchedulerIds = null;
    card._beta10SchedulerEntities = null;
    card._beta10ScheduleDeviceId = keepDeviceId || null;
    card._beta6SchedulerEntities = {};
    card._beta5SchedulerEntities = {};
  }

  const previousDiscover = proto._discoverNavimowerSchedulerEntities;
  if (typeof previousDiscover === "function") {
    proto._discoverNavimowerSchedulerEntities = async function beta3ScopedDiscovery(options) {
      const scoped = scopedSchedulerIds(this);
      if (scoped?.authoritative) {
        if (!scoped.status) clearManagedCaches(this, scoped.deviceId);
        return scoped;
      }
      const result = await previousDiscover.call(this, options);
      if (result?.source === "single_global_status") {
        clearManagedCaches(this, null);
        return emptySchedulerIds();
      }
      return result;
    };
  }

  function statusAttributes(card) {
    const ids = card._beta2SchedulerIds || scopedSchedulerIds(card) || card._beta10SchedulerEntities || {};
    return state(card, ids.status)?.attributes || {};
  }

  function configuredZones(card) {
    const attrs = statusAttributes(card);
    const selected = [...new Set(normalizedQueue(attrs.selected_zone_ids))];
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
    return selected.map((id) => ({ id, name: names.get(id) || ("Zone " + id) }));
  }

  function missingZones(card) {
    const present = new Set(normalizedQueue(card._beta2ScheduleDraft));
    return configuredZones(card).filter((zone) => !present.has(zone.id));
  }

  function markDirty(card) {
    card._beta2ScheduleDirty = !sameQueue(card._beta2ScheduleDraft, card._beta2ScheduleServerQueue);
    if (card._beta2ScheduleSaveState === "saved") card._beta2ScheduleSaveState = "idle";
  }

  function updateRowIndices(root) {
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

  function dragTargetIndex(clientY, rows, movingRow) {
    const others = rows.filter((row) => row !== movingRow);
    for (let index = 0; index < others.length; index += 1) {
      const rect = others[index]?.getBoundingClientRect?.();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return others.length;
  }

  function finishDrag(card, root, handle) {
    if (card._beta3Drag?.handle !== handle) return;
    const moved = Boolean(card._beta3Drag.moved);
    card._beta3Drag = null;
    root.querySelectorAll?.(".nm-beta2-dragging")?.forEach?.((item) => item.classList.remove("nm-beta2-dragging"));
    if (moved) {
      markDirty(card);
      card._renderDialog?.();
    }
  }

  function bindMobileDrag(card, root) {
    if (!root || root.dataset.beta3DragBound === "1") return;
    root.dataset.beta3DragBound = "1";

    const handleFromEvent = (event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      return path.find((node) => node?.dataset?.beta2Drag !== undefined) || event.target?.closest?.("[data-beta2-drag]") || null;
    };

    root.addEventListener("pointerdown", (event) => {
      const handle = handleFromEvent(event);
      if (!handle || !root.contains(handle)) return;
      if (event.button !== undefined && event.button !== 0) return;
      const row = handle.closest?.("[data-beta2-row]");
      if (!row) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handle.setPointerCapture?.(event.pointerId);
      row.classList.add("nm-beta2-dragging");
      card._beta3Drag = { pointerId: event.pointerId, handle, row, moved: false };
    }, true);

    root.addEventListener("pointermove", (event) => {
      const drag = card._beta3Drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const scroll = root.querySelector?.("[data-beta2-scroll]");
      if (scroll) {
        const rect = scroll.getBoundingClientRect?.();
        if (rect) {
          if (event.clientY < rect.top + 54) scroll.scrollBy?.({ top: -18, behavior: "auto" });
          else if (event.clientY > rect.bottom - 54) scroll.scrollBy?.({ top: 18, behavior: "auto" });
        }
      }
      const queue = root.querySelector?.("[data-beta2-queue]");
      if (!queue) return;
      const rows = [...queue.querySelectorAll("[data-beta2-row]")];
      const currentIndex = rows.indexOf(drag.row);
      if (currentIndex < 0) return;
      const targetIndex = dragTargetIndex(event.clientY, rows, drag.row);
      if (targetIndex === currentIndex) return;
      const draft = card._beta2ScheduleDraft;
      if (!Array.isArray(draft) || currentIndex >= draft.length) return;
      const [item] = draft.splice(currentIndex, 1);
      draft.splice(targetIndex, 0, item);
      const others = rows.filter((row) => row !== drag.row);
      if (targetIndex >= others.length) queue.append(drag.row);
      else queue.insertBefore(drag.row, others[targetIndex]);
      updateRowIndices(root);
      drag.moved = true;
    }, true);

    const end = (event) => {
      const drag = card._beta3Drag;
      if (!drag || (event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      finishDrag(card, root, drag.handle);
    };
    root.addEventListener("pointerup", end, true);
    root.addEventListener("pointercancel", end, true);
    root.addEventListener("lostpointercapture", end, true);
  }

  function addBeta3Styles(root) {
    if (!root || root.querySelector?.("style[data-beta3-style]")) return;
    const style = document.createElement("style");
    style.dataset.beta3Style = "1";
    style.textContent =
      '.nm-beta3-add-wrap{position:relative;margin-top:8px;}' +
      '.nm-beta3-add-toggle{box-sizing:border-box;width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;}' +
      '.nm-beta3-add-toggle:disabled{opacity:.45;}' +
      '.nm-beta3-add-menu{display:none;margin-top:6px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color);overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.16);}' +
      '.nm-beta3-add-menu[data-open="1"]{display:block;}' +
      '.nm-beta3-add-option{display:block;width:100%;min-height:44px;padding:9px 12px;border:0;border-bottom:1px solid var(--divider-color);background:transparent;color:var(--primary-text-color);font:inherit;text-align:left;}' +
      '.nm-beta3-add-option:last-child{border-bottom:0;}' +
      '.nm-beta3-add-option:active{background:var(--secondary-background-color);}' +
      '.nm-beta2-drag{touch-action:none!important;user-select:none;-webkit-user-select:none;}' +
      '.nm-beta2-zone{min-height:46px;}';
    root.append(style);
  }

  function syncAddZone(card, root) {
    const add = root?.querySelector?.(".nm-beta2-add");
    const select = root?.querySelector?.("[data-beta2-add-select]");
    if (!add || !select) return;
    addBeta3Styles(root);
    select.style.display = "none";
    let wrap = add.querySelector?.("[data-beta3-add-wrap]");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "nm-beta3-add-wrap";
      wrap.dataset.beta3AddWrap = "1";
      wrap.innerHTML = '<button type="button" class="nm-beta3-add-toggle" data-beta3-add-toggle><span>Add zone…</span><ha-icon icon="mdi:chevron-down"></ha-icon></button><div class="nm-beta3-add-menu" data-beta3-add-menu></div>';
      add.append(wrap);
      wrap.querySelector("[data-beta3-add-toggle]")?.addEventListener("click", (event) => {
        event.preventDefault();
        const menu = wrap.querySelector("[data-beta3-add-menu]");
        if (!menu) return;
        menu.dataset.open = menu.dataset.open === "1" ? "0" : "1";
      });
      wrap.querySelector("[data-beta3-add-menu]")?.addEventListener("click", (event) => {
        const option = event.target?.closest?.("[data-beta3-zone-id]");
        if (!option) return;
        event.preventDefault();
        const id = Number(option.dataset.beta3ZoneId);
        if (!Number.isFinite(id) || !missingZones(card).some((zone) => zone.id === id)) return;
        select.value = String(id);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const menu = wrap.querySelector("[data-beta3-add-menu]");
        if (menu) menu.dataset.open = "0";
        queueMicrotask(() => syncAddZone(card, root));
      });
    }
    const missing = missingZones(card);
    const toggle = wrap.querySelector?.("[data-beta3-add-toggle]");
    const menu = wrap.querySelector?.("[data-beta3-add-menu]");
    const editable = (statusAttributes(card).order_mode || "automatic") === "custom";
    if (toggle) toggle.disabled = !editable || missing.length === 0;
    if (menu) {
      const wasOpen = menu.dataset.open === "1";
      menu.textContent = "";
      for (const zone of missing) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nm-beta3-add-option";
        button.dataset.beta3ZoneId = String(zone.id);
        button.textContent = zone.name;
        menu.append(button);
      }
      menu.dataset.open = wasOpen && missing.length ? "1" : "0";
    }
  }

  function installBeta3Ui(card) {
    if (!card?._beta2ScheduleOpen) return;
    const root = card._modalHostEl?.querySelector?.("[data-beta2-root]");
    if (!root) return;
    bindMobileDrag(card, root);
    syncAddZone(card, root);
    if (root.dataset.beta3SyncBound !== "1") {
      root.dataset.beta3SyncBound = "1";
      root.addEventListener("click", () => queueMicrotask(() => syncAddZone(card, root)));
    }
  }

  const previousRenderDialog = proto._renderDialog;
  proto._renderDialog = function beta3RenderDialog(...args) {
    const result = previousRenderDialog?.apply(this, args);
    if (this._beta2ScheduleOpen) installBeta3Ui(this);
    return result;
  };

  const previousOpenSchedule = proto._openScheduleDialog;
  proto._openScheduleDialog = async function beta3OpenSchedule(...args) {
    const scoped = scopedSchedulerIds(this);
    if (scoped?.authoritative && !scoped.status) {
      clearManagedCaches(this, scoped.deviceId);
      this._beta2ScheduleOpen = false;
      const original = this._config;
      if ((original?.schedule_view_mode || "auto") !== "native") {
        this._config = { ...(original || {}), schedule_view_mode: "native" };
        try {
          return await previousOpenSchedule?.apply(this, args);
        } finally {
          this._config = original;
        }
      }
    }
    const result = await previousOpenSchedule?.apply(this, args);
    if (this._beta2ScheduleOpen) installBeta3Ui(this);
    return result;
  };

  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");
  if (previousHass?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: previousHass.get,
      set(value) {
        previousHass.set.call(this, value);
        if (this._beta2ScheduleOpen) queueMicrotask(() => installBeta3Ui(this));
      },
    });
  }

  proto._beta3ScopedSchedulerIds = function () { return scopedSchedulerIds(this); };
  proto._beta3DragTargetIndex = function (clientY, rects, movingIndex = -1) {
    const rows = (Array.isArray(rects) ? rects : []).map((rect, index) => ({
      index,
      getBoundingClientRect: () => rect,
    }));
    return dragTargetIndex(clientY, rows, rows[movingIndex]);
  };

  console.info("[Navimower Map Card] 0.3.5-beta3 mobile scheduler scope and interaction fixes enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied mobile scheduler scope and interaction fixes");
