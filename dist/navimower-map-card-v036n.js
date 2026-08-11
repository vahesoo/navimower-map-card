/*
 * Navimower Map Card 0.3.1-beta2 notification actions.
 *
 * Builds on the beta1 notification panel with explicit Home Assistant actions
 * for one-message and all-message read state. No read flag is changed locally:
 * the Navimower integration performs the vendor request and refreshes the
 * Latest notification sensor, which remains authoritative.
 */

import {
  formatNotificationTimestamp,
  hasUnreadNotifications,
  notificationEntityCandidates,
  notificationItemsFromState,
  notificationPage,
} from "./navimower-map-card-v035n.js";

export const NAVIMOWER_MAP_CARD_V036N_VERSION = "0.3.1-beta2";
export const NOTIFICATION_PAGE_SIZE_DEFAULT = 3;
export const NOTIFICATION_PAGE_SIZE_LIMITS = Object.freeze({ minimum: 1, maximum: 5 });
export const NOTIFICATION_MARK_READ_ON_OPEN_DEFAULT = false;

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

export function notificationPageSize(config = {}) {
  const value = Math.floor(Number(config?.notification_page_size));
  if (!Number.isFinite(value)) return NOTIFICATION_PAGE_SIZE_DEFAULT;
  return Math.min(
    NOTIFICATION_PAGE_SIZE_LIMITS.maximum,
    Math.max(NOTIFICATION_PAGE_SIZE_LIMITS.minimum, value),
  );
}

export function normalizeNotificationActionConfig(config = {}) {
  return {
    ...(config || {}),
    notification_page_size: notificationPageSize(config),
    notification_mark_read_on_open: booleanValue(
      config?.notification_mark_read_on_open,
      NOTIFICATION_MARK_READ_ON_OPEN_DEFAULT,
    ),
  };
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

export function extendNotificationConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  if (!Array.isArray(next.schema)) next.schema = [];
  if (!findSchema(next, "notifications")) {
    const section = {
      type: "expandable",
      name: "notifications",
      title: "Notifications",
      flatten: true,
      schema: [
        {
          type: "grid",
          name: "notifications_grid",
          flatten: true,
          column_min_width: "220px",
          schema: [
            { name: "notification_mark_read_on_open", selector: { boolean: {} } },
            {
              name: "notification_page_size",
              selector: {
                number: {
                  min: NOTIFICATION_PAGE_SIZE_LIMITS.minimum,
                  max: NOTIFICATION_PAGE_SIZE_LIMITS.maximum,
                  step: 1,
                  mode: "box",
                },
              },
            },
          ],
        },
      ],
    };
    const advancedIndex = next.schema.findIndex((item) => item?.name === "advanced");
    next.schema.splice(advancedIndex >= 0 ? advancedIndex : next.schema.length, 0, section);
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  next.computeLabel = (schema) => {
    if (schema?.name === "notification_mark_read_on_open") return "Mark notifications as read when opening";
    if (schema?.name === "notification_page_size") return "Notifications per page";
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

export function notificationItemsWithMessageIds(state) {
  const items = notificationItemsFromState(state);
  const attrs = state?.attributes && typeof state.attributes === "object"
    ? state.attributes
    : {};
  const recent = Array.isArray(attrs.recent) ? attrs.recent : [];
  return items.map((item, index) => {
    const source = recent[index] && typeof recent[index] === "object"
      ? recent[index]
      : attrs;
    const messageId = source.message_id
      ?? source.messageId
      ?? source.id
      ?? item.id
      ?? null;
    return {
      ...item,
      message_id: messageId === null || messageId === undefined || messageId === ""
        ? null
        : String(messageId),
    };
  });
}

function notificationTarget(card) {
  const deviceId = typeof card?._mowerDeviceId === "function"
    ? card._mowerDeviceId()
    : card?._deviceId || null;
  if (!deviceId) throw new Error("Navimower mower device_id is not available");
  return { device_id: deviceId };
}

function pendingMessages(card) {
  if (!(card._notificationPendingMessageIds instanceof Set)) {
    card._notificationPendingMessageIds = new Set();
  }
  return card._notificationPendingMessageIds;
}

async function markNotificationRead(card, messageId) {
  const id = String(messageId || "").trim();
  if (!id || !card?._hass?.callService) return;
  const pending = pendingMessages(card);
  if (pending.has(id) || card._notificationMarkAllPending) return;
  pending.add(id);
  card._notificationActionError = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_notification_read", {
      ...notificationTarget(card),
      message_id: id,
    });
  } catch (error) {
    card._notificationActionError = "Mark as read failed";
    console.error("[Navimower Map Card] navimower.mark_notification_read failed", error);
  } finally {
    pending.delete(id);
    card._notificationDialogRenderKeyBeta2 = null;
    renderNotificationDialog(card);
  }
}

async function markAllNotificationsRead(card) {
  if (!card?._hass?.callService || card._notificationMarkAllPending) return;
  card._notificationMarkAllPending = true;
  card._notificationActionError = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_all_notifications_read", {
      ...notificationTarget(card),
    });
  } catch (error) {
    card._notificationActionError = "Mark all as read failed";
    console.error("[Navimower Map Card] navimower.mark_all_notifications_read failed", error);
  } finally {
    card._notificationMarkAllPending = false;
    card._notificationDialogRenderKeyBeta2 = null;
    renderNotificationDialog(card);
  }
}

function ensureBeta2NotificationDom(card) {
  if (!card?._domReady) return;
  const button = card.querySelector?.(".nm-notification-button");
  if (button && !button.querySelector?.(".nm-notification-button-label")) {
    const label = document.createElement("span");
    label.className = "nm-notification-button-label";
    label.textContent = "Notifications";
    const icon = button.querySelector?.("ha-icon");
    if (icon) button.insertBefore(label, icon);
    else button.appendChild(label);
  }
  if (card._notificationBeta2StylesApplied) return;
  const style = card.querySelector?.("style");
  if (!style) return;
  card._notificationBeta2StylesApplied = true;
  style.textContent += `
    .nm-notification-button { width: auto; min-width: 34px; height: 34px; flex: 0 0 auto;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 0 9px 0 11px; border-radius: 18px; font: inherit; font-size: .86rem; font-weight: 600; }
    .nm-notification-button-label { color: inherit; white-space: nowrap; }
    .nm-notification-head { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center; gap: 10px; }
    .nm-notification-title { justify-self: start; }
    .nm-notification-close { justify-self: end; }
    .nm-notification-mark-all, .nm-notification-mark-read { border: 0; background: transparent;
      color: #FF5A00; cursor: pointer; font: inherit; font-weight: 650; }
    .nm-notification-mark-all { justify-self: center; padding: 7px 9px; border-radius: 9px; white-space: nowrap; }
    .nm-notification-mark-read { flex: 0 0 auto; padding: 2px 0 2px 8px; font-size: .78rem; }
    .nm-notification-mark-all:hover, .nm-notification-mark-all:focus-visible,
    .nm-notification-mark-read:hover, .nm-notification-mark-read:focus-visible {
      background: color-mix(in srgb, #FF5A00 10%, transparent); outline: none; }
    .nm-notification-mark-all:disabled, .nm-notification-mark-read:disabled { opacity: .45; cursor: default; }
    .nm-notification-action-error { margin: 8px 2px 2px; padding: 8px 10px; border-radius: 8px;
      color: var(--error-color, #db4437); background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
      font-size: .82rem; }
    @media (max-width: 520px) {
      .nm-notification-head { grid-template-columns: minmax(0, 1fr) auto auto; }
      .nm-notification-mark-all { font-size: .82rem; }
    }
  `;
}

function renderNotificationDialog(card) {
  const host = card?._modalHostEl;
  if (!host || !card?._notificationDialogOpen) return;
  ensureBeta2NotificationDom(card);
  const { entityId, state } = notificationState(card);
  const items = notificationItemsWithMessageIds(state);
  const pageSize = notificationPageSize(card?._config);
  const page = notificationPage(items, card._notificationPage, pageSize);
  card._notificationPage = page.page;
  const unread = hasUnreadNotifications(items);
  const pending = pendingMessages(card);
  const signature = JSON.stringify(items.map((item) => [
    item.id,
    item.message_id,
    item.title,
    item.content,
    item.created_at,
    item.read,
  ]));
  const key = `${entityId || ""}|${state?.state || ""}|${page.page}|${pageSize}|${signature}|${card._notificationMarkAllPending ? 1 : 0}|${[...pending].join(",")}|${card._notificationActionError || ""}`;
  if (key === card._notificationDialogRenderKeyBeta2
      && host.querySelector?.(".nm-notification-dialog")) return;
  card._notificationDialogRenderKeyBeta2 = key;

  let body;
  if (!entityId || !state) {
    body = '<div class="nm-notification-empty">Latest notification entity is not available. Navimower 0.4.2-beta2 or later is required for read actions.</div>';
  } else if (!items.length) {
    body = '<div class="nm-notification-empty">No notifications available.</div>';
  } else {
    body = page.items.map((item) => {
      const isUnread = item.read === false;
      const timestamp = formatNotificationTimestamp(item.created_at, card._hass);
      const messageId = item.message_id;
      const isPending = Boolean(messageId && pending.has(messageId));
      const action = isUnread && messageId
        ? `<button type="button" class="nm-notification-mark-read" data-notification-message-id="${escapeHtml(messageId)}"${isPending || card._notificationMarkAllPending ? " disabled" : ""}>${isPending ? "Marking…" : "Mark as read"}</button>`
        : "";
      const title = item.title || "Notification";
      const content = item.content
        ? `<div class="nm-notification-content">${escapeHtml(item.content)}</div>`
        : "";
      return `<article class="nm-notification-item${isUnread ? " unread" : ""}">
        <div class="nm-notification-meta">
          <span class="nm-notification-dot" aria-hidden="true"></span>
          <span class="nm-notification-time">${escapeHtml(timestamp)}</span>
          ${action}
        </div>
        <div class="nm-notification-item-title">${escapeHtml(title)}</div>
        ${content}
      </article>`;
    }).join("");
  }

  const pager = page.pageCount > 1
    ? `<div class="nm-notification-pager">
        <button type="button" data-notification-page="previous"${page.page <= 0 ? " disabled" : ""}>Previous</button>
        <span class="nm-notification-page-label">${page.page + 1} / ${page.pageCount}</span>
        <button type="button" data-notification-page="next"${page.page >= page.pageCount - 1 ? " disabled" : ""}>Next</button>
      </div>`
    : "";
  const markAll = unread
    ? `<button type="button" class="nm-notification-mark-all"${card._notificationMarkAllPending ? " disabled" : ""}>${card._notificationMarkAllPending ? "Marking…" : "Mark all as read"}</button>`
    : "<span></span>";
  const error = card._notificationActionError
    ? `<div class="nm-notification-action-error" role="alert">${escapeHtml(card._notificationActionError)}</div>`
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
      ${pager}
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
  host.querySelectorAll("[data-notification-message-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      void markNotificationRead(card, button.dataset.notificationMessageId);
    });
  });
  host.querySelectorAll("[data-notification-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      card._notificationPage += button.dataset.notificationPage === "next" ? 1 : -1;
      card._notificationDialogRenderKeyBeta2 = null;
      renderNotificationDialog(card);
    });
  });
}

function maybeAutoMarkReadOnOpen(card) {
  if (!booleanValue(card?._config?.notification_mark_read_on_open, false)) return;
  if (card._notificationAutoReadRun) return;
  const { state } = notificationState(card);
  const items = notificationItemsWithMessageIds(state);
  if (!hasUnreadNotifications(items)) return;
  card._notificationAutoReadRun = true;
  void markAllNotificationsRead(card);
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV036NPatched) return;
  Card.__navimowerV036NPatched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function notificationActionStubConfig() {
    return normalizeNotificationActionConfig(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function notificationActionConfigForm() {
    return extendNotificationConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function notificationActionSetConfig(config) {
      return originalSetConfig.call(this, normalizeNotificationActionConfig(config));
    };
  }

  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function notificationActionEnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      ensureBeta2NotificationDom(this);
      return result;
    };
  }

  const originalRenderShell = proto._renderShell;
  if (typeof originalRenderShell === "function") {
    proto._renderShell = function notificationActionRenderShell(...args) {
      const result = originalRenderShell.apply(this, args);
      ensureBeta2NotificationDom(this);
      return result;
    };
  }

  const originalOpenNotification = proto._openNotificationDialog;
  if (typeof originalOpenNotification === "function") {
    proto._openNotificationDialog = function notificationActionOpen(...args) {
      this._notificationAutoReadRun = false;
      this._notificationActionError = null;
      const result = originalOpenNotification.apply(this, args);
      ensureBeta2NotificationDom(this);
      this._notificationDialogRenderKeyBeta2 = null;
      renderNotificationDialog(this);
      maybeAutoMarkReadOnOpen(this);
      return result;
    };
  }

  const originalCloseNotification = proto._closeNotificationDialog;
  if (typeof originalCloseNotification === "function") {
    proto._closeNotificationDialog = function notificationActionClose(...args) {
      this._notificationAutoReadRun = false;
      this._notificationActionError = null;
      this._notificationDialogRenderKeyBeta2 = null;
      return originalCloseNotification.apply(this, args);
    };
  }

  const originalRenderDialog = proto._renderDialog;
  if (typeof originalRenderDialog === "function") {
    proto._renderDialog = function notificationActionRenderDialog(...args) {
      if (this._notificationDialogOpen) {
        renderNotificationDialog(this);
        return undefined;
      }
      return originalRenderDialog.apply(this, args);
    };
  }

  proto._renderNotificationDialog = function notificationActionExplicitRender() {
    renderNotificationDialog(this);
  };

  proto._markNotificationRead = function notificationActionOne(messageId) {
    return markNotificationRead(this, messageId);
  };

  proto._markAllNotificationsRead = function notificationActionAll() {
    return markAllNotificationsRead(this);
  };

  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(proto, "hass", {
      ...hassDescriptor,
      set(hass) {
        hassDescriptor.set.call(this, hass);
        ensureBeta2NotificationDom(this);
        if (this._notificationDialogOpen) renderNotificationDialog(this);
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.1-beta2 notification read actions enabled");
}

if (globalThis.customElements) patchCard();
