/*
 * Navimower Map Card 0.3.1-beta4 UI refinement.
 *
 * Fixes the beta3 title row and replaces notification pagination with one
 * compact scrollable list. notification_count is the only list-size setting.
 */

import {
  formatNotificationTimestamp,
  hasUnreadNotifications,
  notificationEntityCandidates,
} from "./navimower-map-card-v035n.js";
import { notificationItemsWithMessageIds } from "./navimower-map-card-v036n.js";

export const NAVIMOWER_MAP_CARD_V038U_VERSION = "0.3.1-beta4";
export const NOTIFICATION_COUNT_DEFAULT = 5;
export const NOTIFICATION_COUNT_LIMITS = Object.freeze({ minimum: 1, maximum: 10 });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === false) return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return Boolean(value);
}

export function titleHeaderState(config = {}) {
  const title = String(config?.title ?? "").trim();
  return {
    title,
    show: booleanValue(config?.show_title, true) && Boolean(title),
  };
}

export function notificationCount(config = {}) {
  const value = Math.floor(Number(config?.notification_count));
  if (!Number.isFinite(value)) return NOTIFICATION_COUNT_DEFAULT;
  return Math.min(
    NOTIFICATION_COUNT_LIMITS.maximum,
    Math.max(NOTIFICATION_COUNT_LIMITS.minimum, value),
  );
}

export function normalizeBeta4Config(config = {}) {
  const next = {
    ...(config || {}),
    notification_count: notificationCount(config),
  };
  delete next.notification_page_size;
  return next;
}

export function enforceTwoRowHeader(card) {
  if (!card?._domReady) return false;
  const header = card.querySelector?.(".nm-header");
  const title = card.querySelector?.(".nm-title");
  const actions = card.querySelector?.(".nm-header-actions");
  if (!header || !title || !actions) return false;

  const state = titleHeaderState(card?._config);
  title.textContent = state.title;
  title.hidden = !state.show;

  // Stable core _renderShell() writes display:flex inline on .nm-header.
  // Reassert block inline so the title and action row remain separate.
  header.style.display = "block";
  header.classList.toggle("nm-header-without-title", !state.show);
  return true;
}

function findSchema(node, name) {
  if (!node || typeof node !== "object") return null;
  if (node.name === name) return node;
  const children = Array.isArray(node.schema) ? node.schema : [];
  for (const child of children) {
    const found = findSchema(child, name);
    if (found) return found;
  }
  return null;
}

function removeSchemaField(node, name) {
  if (!node || typeof node !== "object") return;
  if (!Array.isArray(node.schema)) return;
  node.schema = node.schema.filter((item) => item?.name !== name);
  for (const child of node.schema) removeSchemaField(child, name);
}

export function extendBeta4ConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  removeSchemaField(next, "notification_page_size");

  const notifications = findSchema(next, "notifications");
  const grid = findSchema(notifications, "notifications_grid") || notifications;
  if (grid && Array.isArray(grid.schema) && !findSchema(grid, "notification_count")) {
    grid.schema.push({
      name: "notification_count",
      selector: {
        number: {
          min: NOTIFICATION_COUNT_LIMITS.minimum,
          max: NOTIFICATION_COUNT_LIMITS.maximum,
          step: 1,
          mode: "box",
        },
      },
    });
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  next.computeLabel = (schema) => {
    if (schema?.name === "notification_count") return "Notifications to show";
    return originalComputeLabel?.(schema) || schema?.name || "";
  };
  return next;
}

function resolveNotificationEntity(card) {
  const hass = card?._hass;
  const explicit = card?._config?.notification_entity;
  if (explicit && hass?.states?.[explicit]) return explicit;
  const resolved = card?._resolved?.notification_entity;
  if (resolved && hass?.states?.[resolved]) return resolved;
  const mowerEntity = card?._resolved?.mower_entity
    || card?._config?.entity
    || card?._config?.mower_entity
    || card?._config?.status_entity;
  const candidate = notificationEntityCandidates(mowerEntity)
    .find((entityId) => hass?.states?.[entityId]);
  if (candidate && card?._resolved) {
    card._resolved = { ...card._resolved, notification_entity: candidate };
  }
  return candidate || resolved || explicit || null;
}

function notificationState(card) {
  const entityId = resolveNotificationEntity(card);
  return {
    entityId,
    state: entityId ? card?._hass?.states?.[entityId] || null : null,
  };
}

function expandedMessages(card) {
  if (!(card._notificationExpandedMessageIds instanceof Set)) {
    card._notificationExpandedMessageIds = new Set();
  }
  return card._notificationExpandedMessageIds;
}

function pendingMessages(card) {
  if (!(card._notificationBeta4PendingMessageIds instanceof Set)) {
    card._notificationBeta4PendingMessageIds = new Set();
  }
  return card._notificationBeta4PendingMessageIds;
}

function notificationTarget(card) {
  const deviceId = typeof card?._mowerDeviceId === "function"
    ? card._mowerDeviceId()
    : card?._deviceId || null;
  if (!deviceId) throw new Error("Navimower mower device_id is not available");
  return { device_id: deviceId };
}

async function markNotificationRead(card, messageId) {
  const id = String(messageId || "").trim();
  if (!id || !card?._hass?.callService) return;
  const pending = pendingMessages(card);
  if (pending.has(id) || card._notificationBeta4MarkAllPending) return;
  pending.add(id);
  card._notificationBeta4ActionError = null;
  card._notificationDialogRenderKeyBeta4 = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_notification_read", {
      ...notificationTarget(card),
      message_id: id,
    });
  } catch (error) {
    card._notificationBeta4ActionError = "Mark as read failed";
    console.error("[Navimower Map Card] navimower.mark_notification_read failed", error);
  } finally {
    pending.delete(id);
    card._notificationDialogRenderKeyBeta4 = null;
    renderNotificationDialog(card);
  }
}

async function markAllNotificationsRead(card) {
  if (!card?._hass?.callService || card._notificationBeta4MarkAllPending) return;
  card._notificationBeta4MarkAllPending = true;
  card._notificationBeta4ActionError = null;
  card._notificationDialogRenderKeyBeta4 = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_all_notifications_read", {
      ...notificationTarget(card),
    });
  } catch (error) {
    card._notificationBeta4ActionError = "Mark all as read failed";
    console.error("[Navimower Map Card] navimower.mark_all_notifications_read failed", error);
  } finally {
    card._notificationBeta4MarkAllPending = false;
    card._notificationDialogRenderKeyBeta4 = null;
    renderNotificationDialog(card);
  }
}

function notificationExpansionKey(item = {}, index = 0) {
  return String(item.message_id ?? item.id ?? item.created_at ?? `row-${index}`);
}

function ensureBeta4Styles(card) {
  if (!card?._domReady || card._beta4StylesApplied) return;
  const style = card.querySelector?.("style");
  if (!style) return;
  card._beta4StylesApplied = true;
  style.textContent += `
    .nm-notification-dialog { overflow: hidden; }
    .nm-notification-body { max-height: min(70vh, 650px); overflow-y: auto;
      overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch;
      scrollbar-gutter: stable; }
  `;
}

function renderNotificationDialog(card) {
  const host = card?._modalHostEl;
  if (!host || !card?._notificationDialogOpen) return;
  enforceTwoRowHeader(card);
  ensureBeta4Styles(card);

  const { entityId, state } = notificationState(card);
  const allItems = notificationItemsWithMessageIds(state);
  const items = allItems.slice(0, notificationCount(card?._config));
  const unread = hasUnreadNotifications(allItems);
  const expanded = expandedMessages(card);
  const pending = pendingMessages(card);
  const signature = JSON.stringify(allItems.map((item) => [
    item.id,
    item.message_id,
    item.title,
    item.content,
    item.created_at,
    item.read,
  ]));
  const key = `${entityId || ""}|${state?.state || ""}|${notificationCount(card?._config)}|${signature}|${[...expanded].join(",")}|${[...pending].join(",")}|${card._notificationBeta4MarkAllPending ? 1 : 0}|${card._notificationBeta4ActionError || ""}`;
  if (key === card._notificationDialogRenderKeyBeta4
      && host.querySelector?.(".nm-notification-dialog")) return;
  card._notificationDialogRenderKeyBeta4 = key;

  let body;
  if (!entityId || !state) {
    body = '<div class="nm-notification-empty">Latest notification entity is not available. Navimower 0.4.2-beta2 or later is required for read actions.</div>';
  } else if (!allItems.length) {
    body = '<div class="nm-notification-empty">No notifications available.</div>';
  } else {
    body = items.map((item, index) => {
      const isUnread = item.read === false;
      const timestamp = formatNotificationTimestamp(item.created_at, card._hass);
      const messageId = item.message_id;
      const isPending = Boolean(messageId && pending.has(messageId));
      const expansionKey = notificationExpansionKey(item, index);
      const isExpanded = expanded.has(expansionKey);
      const action = isUnread && messageId
        ? `<button type="button" class="nm-notification-mark-read" data-notification-mark-id="${escapeHtml(messageId)}"${isPending || card._notificationBeta4MarkAllPending ? " disabled" : ""}>${isPending ? "Marking…" : "Mark as read"}</button>`
        : "";
      const title = item.title || "Notification";
      const content = isExpanded && item.content
        ? `<div class="nm-notification-content nm-notification-content-expanded">${escapeHtml(item.content)}</div>`
        : "";
      return `<article class="nm-notification-item${isUnread ? " unread" : ""}">
        <div class="nm-notification-meta">
          <span class="nm-notification-time">${escapeHtml(timestamp)}</span>
          ${action}
        </div>
        <div class="nm-notification-item-title">
          <button type="button" class="nm-notification-title-button"
            data-notification-expand-key="${escapeHtml(expansionKey)}"
            data-notification-title-message-id="${escapeHtml(messageId || "")}"
            data-notification-title-unread="${isUnread ? "true" : "false"}"
            aria-expanded="${isExpanded ? "true" : "false"}">${escapeHtml(title)}</button>
        </div>
        ${content}
      </article>`;
    }).join("");
  }

  const markAll = unread
    ? `<button type="button" class="nm-notification-mark-all"${card._notificationBeta4MarkAllPending ? " disabled" : ""}>${card._notificationBeta4MarkAllPending ? "Marking…" : "Mark all as read"}</button>`
    : "<span></span>";
  const error = card._notificationBeta4ActionError
    ? `<div class="nm-notification-action-error" role="alert">${escapeHtml(card._notificationBeta4ActionError)}</div>`
    : "";

  host.innerHTML = `<div class="nm-backdrop nm-notification-backdrop">
    <div class="nm-dialog nm-notification-dialog" role="dialog" aria-modal="true" aria-label="Notifications">
      <div class="nm-notification-head">
        <div class="nm-notification-title">Notifications</div>
        ${markAll}
        <button type="button" class="nm-notification-close" aria-label="Close notifications" title="Close">
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="nm-notification-body">${error}${body}</div>
    </div>
  </div>`;

  const backdrop = host.querySelector(".nm-notification-backdrop");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) card._closeNotificationDialog?.();
  });
  host.querySelector(".nm-notification-close")?.addEventListener("click", () => card._closeNotificationDialog?.());
  host.querySelector(".nm-notification-mark-all")?.addEventListener("click", () => {
    void markAllNotificationsRead(card);
  });
  host.querySelectorAll("[data-notification-mark-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      void markNotificationRead(card, button.dataset.notificationMarkId);
    });
  });
  host.querySelectorAll("[data-notification-expand-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const set = expandedMessages(card);
      const expansionKey = button.dataset.notificationExpandKey;
      if (set.has(expansionKey)) set.delete(expansionKey);
      else set.add(expansionKey);
      card._notificationDialogRenderKeyBeta4 = null;
      renderNotificationDialog(card);
      if (button.dataset.notificationTitleUnread === "true"
          && button.dataset.notificationTitleMessageId) {
        void markNotificationRead(card, button.dataset.notificationTitleMessageId);
      }
    });
  });
}

function maybeAutoMarkReadOnOpen(card) {
  if (!booleanValue(card?._config?.notification_mark_read_on_open, false)) return;
  const { state } = notificationState(card);
  if (!hasUnreadNotifications(notificationItemsWithMessageIds(state))) return;
  void markAllNotificationsRead(card);
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV038UPatched) return;
  Card.__navimowerV038UPatched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function beta4StubConfig() {
    return normalizeBeta4Config(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function beta4ConfigForm() {
    return extendBeta4ConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function beta4SetConfig(config) {
      const normalized = normalizeBeta4Config(config);
      const result = originalSetConfig.call(this, normalized);
      if (this._config) {
        this._config.notification_count = normalized.notification_count;
        delete this._config.notification_page_size;
      }
      enforceTwoRowHeader(this);
      return result;
    };
  }

  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function beta4EnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      enforceTwoRowHeader(this);
      ensureBeta4Styles(this);
      return result;
    };
  }

  const originalRenderShell = proto._renderShell;
  if (typeof originalRenderShell === "function") {
    proto._renderShell = function beta4RenderShell(...args) {
      const result = originalRenderShell.apply(this, args);
      enforceTwoRowHeader(this);
      return result;
    };
  }

  proto._openNotificationDialog = function beta4OpenNotifications() {
    this._mowDialogOpen = false;
    this._scheduleDialogOpen = false;
    this._notificationDialogOpen = true;
    this._notificationExpandedMessageIds = new Set();
    this._notificationBeta4PendingMessageIds = new Set();
    this._notificationBeta4MarkAllPending = false;
    this._notificationBeta4ActionError = null;
    this._notificationDialogRenderKeyBeta4 = null;
    this._renderShell?.();
    renderNotificationDialog(this);
    maybeAutoMarkReadOnOpen(this);
  };

  proto._closeNotificationDialog = function beta4CloseNotifications() {
    this._notificationDialogOpen = false;
    this._notificationExpandedMessageIds = new Set();
    this._notificationBeta4ActionError = null;
    this._notificationDialogRenderKeyBeta4 = null;
    this._renderShell?.();
    this._renderDialog?.();
  };

  const originalRenderDialog = proto._renderDialog;
  if (typeof originalRenderDialog === "function") {
    proto._renderDialog = function beta4RenderDialog(...args) {
      if (this._notificationDialogOpen) {
        renderNotificationDialog(this);
        return undefined;
      }
      return originalRenderDialog.apply(this, args);
    };
  }

  proto._renderNotificationDialog = function beta4ExplicitNotificationRender() {
    renderNotificationDialog(this);
  };
  proto._markNotificationRead = function beta4MarkOne(messageId) {
    return markNotificationRead(this, messageId);
  };
  proto._markAllNotificationsRead = function beta4MarkAll() {
    return markAllNotificationsRead(this);
  };

  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(proto, "hass", {
      ...hassDescriptor,
      set(hass) {
        hassDescriptor.set.call(this, hass);
        enforceTwoRowHeader(this);
        if (this._notificationDialogOpen) {
          this._notificationDialogRenderKeyBeta4 = null;
          renderNotificationDialog(this);
        }
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.1-beta4 title fix and scrollable notifications enabled");
}

if (globalThis.customElements) patchCard();
