/*
 * Navimower Map Card 0.3.1-beta3 compact UI refinements.
 *
 * Keeps notification mutations inside Home Assistant, makes notification rows
 * compact/collapsible, moves the card title onto its own header row, and adds
 * title visibility plus clearer live-trail wording to the visual editor.
 */

import {
  formatNotificationTimestamp,
  hasUnreadNotifications,
  notificationPage,
} from "./navimower-map-card-v035n.js";
import {
  notificationItemsWithMessageIds,
  notificationPageSize,
} from "./navimower-map-card-v036n.js";

export const NAVIMOWER_MAP_CARD_V037U_VERSION = "0.3.1-beta3";
export const SHOW_TITLE_DEFAULT = true;

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

export function normalizeCompactUiConfig(config = {}) {
  return {
    ...(config || {}),
    show_title: booleanValue(config?.show_title, SHOW_TITLE_DEFAULT),
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

export function extendCompactUiConfigForm(form) {
  const next = form && typeof form === "object" ? form : { schema: [] };
  if (!Array.isArray(next.schema)) next.schema = [];

  const general = findSchema(next, "general");
  if (general && Array.isArray(general.schema)) {
    const entity = findSchema(general, "entity")
      || { name: "entity", required: true, selector: { entity: { domain: "lawn_mower" } } };
    const title = findSchema(general, "title")
      || { name: "title", selector: { text: {} } };
    const autoEntities = findSchema(general, "auto_entities")
      || { name: "auto_entities", selector: { boolean: {} } };
    const showTitle = findSchema(general, "show_title")
      || { name: "show_title", default: SHOW_TITLE_DEFAULT, selector: { boolean: {} } };

    general.schema = [
      {
        type: "grid",
        name: "mower_settings_column",
        flatten: true,
        column_min_width: "100%",
        schema: [entity, autoEntities],
      },
      {
        type: "grid",
        name: "title_settings_column",
        flatten: true,
        column_min_width: "100%",
        schema: [
          { type: "constant", name: "title_caption" },
          title,
          showTitle,
        ],
      },
    ];
  }

  const originalComputeLabel = typeof next.computeLabel === "function"
    ? next.computeLabel
    : null;
  const originalComputeHelper = typeof next.computeHelper === "function"
    ? next.computeHelper
    : null;
  next.computeLabel = (schema) => {
    if (schema?.name === "title_caption") return "Title";
    if (schema?.name === "title") return "";
    if (schema?.name === "show_title") return "Show title";
    if (schema?.name === "trail_length") return "Live trail point cap";
    return originalComputeLabel?.(schema) || schema?.name || "";
  };
  next.computeHelper = (schema) => {
    if (schema?.name === "trail_length") {
      return "Limits the browser-side active/fallback trail only. Completed mowed-area history is unaffected.";
    }
    return originalComputeHelper?.(schema) || "";
  };
  return next;
}

export function notificationExpansionKey(item = {}, index = 0) {
  const value = item.message_id
    ?? item.id
    ?? item.created_at
    ?? `row-${index}`;
  return String(value);
}

function notificationState(card) {
  const entityId = card?._resolved?.notification_entity
    || card?._config?.notification_entity
    || null;
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
  if (!(card._notificationCompactPendingMessageIds instanceof Set)) {
    card._notificationCompactPendingMessageIds = new Set();
  }
  return card._notificationCompactPendingMessageIds;
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
  if (pending.has(id) || card._notificationCompactMarkAllPending) return;
  pending.add(id);
  card._notificationCompactActionError = null;
  card._notificationDialogRenderKeyBeta3 = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_notification_read", {
      ...notificationTarget(card),
      message_id: id,
    });
  } catch (error) {
    card._notificationCompactActionError = "Mark as read failed";
    console.error("[Navimower Map Card] navimower.mark_notification_read failed", error);
  } finally {
    pending.delete(id);
    card._notificationDialogRenderKeyBeta3 = null;
    renderNotificationDialog(card);
  }
}

async function markAllNotificationsRead(card) {
  if (!card?._hass?.callService || card._notificationCompactMarkAllPending) return;
  card._notificationCompactMarkAllPending = true;
  card._notificationCompactActionError = null;
  card._notificationDialogRenderKeyBeta3 = null;
  renderNotificationDialog(card);
  try {
    await card._hass.callService("navimower", "mark_all_notifications_read", {
      ...notificationTarget(card),
    });
  } catch (error) {
    card._notificationCompactActionError = "Mark all as read failed";
    console.error("[Navimower Map Card] navimower.mark_all_notifications_read failed", error);
  } finally {
    card._notificationCompactMarkAllPending = false;
    card._notificationDialogRenderKeyBeta3 = null;
    renderNotificationDialog(card);
  }
}

function ensureHeaderLayout(card) {
  if (!card?._domReady) return;
  const header = card.querySelector?.(".nm-header");
  const title = card.querySelector?.(".nm-title");
  if (!header || !title) return;

  let actions = header.querySelector?.(".nm-header-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "nm-header-actions";
    header.appendChild(actions);
  }
  for (const selector of [".nm-history-button", ".nm-notification-button", ".nm-schedule-button"]) {
    const button = card.querySelector?.(selector);
    if (button && button.parentElement !== actions) actions.appendChild(button);
  }

  const showTitle = booleanValue(card?._config?.show_title, SHOW_TITLE_DEFAULT)
    && Boolean(String(card?._config?.title || "").trim());
  title.hidden = !showTitle;
  header.classList.toggle("nm-header-without-title", !showTitle);

  if (card._compactHeaderStylesApplied) return;
  const style = card.querySelector?.("style");
  if (!style) return;
  card._compactHeaderStylesApplied = true;
  style.textContent += `
    .nm-header { display: block; min-height: 0; }
    .nm-title { width: 100%; box-sizing: border-box; margin: 0 0 5px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .nm-title[hidden] { display: none; }
    .nm-header-actions { width: 100%; min-width: 0; display: flex; flex-wrap: wrap; align-items: center;
      justify-content: flex-end; gap: 4px 8px; }
    .nm-header-without-title .nm-header-actions { margin-top: 0; }
    @media (max-width: 480px) {
      .nm-header-actions { gap: 3px 5px; }
      .nm-history-button, .nm-notification-button, .nm-schedule-button { font-size: .82rem; }
    }
  `;
}

function ensureCompactNotificationStyles(card) {
  if (!card?._domReady || card._compactNotificationStylesApplied) return;
  const style = card.querySelector?.("style");
  if (!style) return;
  card._compactNotificationStylesApplied = true;
  style.textContent += `
    .nm-notification-body { padding-top: 2px; padding-bottom: 2px; }
    .nm-notification-item { padding: 10px 2px 11px; }
    .nm-notification-meta { gap: 8px; }
    .nm-notification-dot { display: none; }
    .nm-notification-item-title { margin-top: 3px; }
    .nm-notification-title-button { width: 100%; display: block; padding: 2px 0; border: 0;
      color: var(--primary-text-color); background: transparent; cursor: pointer; text-align: left;
      font: inherit; font-weight: 650; line-height: 1.3; }
    .nm-notification-title-button:hover, .nm-notification-title-button:focus-visible {
      color: var(--primary-color); outline: none; }
    .nm-notification-content.nm-notification-content-expanded { margin-top: 6px; padding: 8px 10px;
      border-radius: 8px; background: var(--secondary-background-color); }
  `;
}

function renderNotificationDialog(card) {
  const host = card?._modalHostEl;
  if (!host || !card?._notificationDialogOpen) return;
  ensureHeaderLayout(card);
  ensureCompactNotificationStyles(card);

  const { entityId, state } = notificationState(card);
  const items = notificationItemsWithMessageIds(state);
  const pageSize = notificationPageSize(card?._config);
  const page = notificationPage(items, card._notificationPage, pageSize);
  card._notificationPage = page.page;
  const unread = hasUnreadNotifications(items);
  const expanded = expandedMessages(card);
  const pending = pendingMessages(card);
  const signature = JSON.stringify(items.map((item) => [
    item.id,
    item.message_id,
    item.title,
    item.content,
    item.created_at,
    item.read,
  ]));
  const key = `${entityId || ""}|${state?.state || ""}|${page.page}|${pageSize}|${signature}|${[...expanded].join(",")}|${[...pending].join(",")}|${card._notificationCompactMarkAllPending ? 1 : 0}|${card._notificationCompactActionError || ""}`;
  if (key === card._notificationDialogRenderKeyBeta3
      && host.querySelector?.(".nm-notification-dialog")) return;
  card._notificationDialogRenderKeyBeta3 = key;

  let body;
  if (!entityId || !state) {
    body = '<div class="nm-notification-empty">Latest notification entity is not available. Navimower 0.4.2-beta2 or later is required for read actions.</div>';
  } else if (!items.length) {
    body = '<div class="nm-notification-empty">No notifications available.</div>';
  } else {
    body = page.items.map((item, pageIndex) => {
      const isUnread = item.read === false;
      const timestamp = formatNotificationTimestamp(item.created_at, card._hass);
      const messageId = item.message_id;
      const isPending = Boolean(messageId && pending.has(messageId));
      const expansionKey = notificationExpansionKey(item, page.page * page.pageSize + pageIndex);
      const isExpanded = expanded.has(expansionKey);
      const action = isUnread && messageId
        ? `<button type="button" class="nm-notification-mark-read" data-notification-mark-id="${escapeHtml(messageId)}"${isPending || card._notificationCompactMarkAllPending ? " disabled" : ""}>${isPending ? "Marking…" : "Mark as read"}</button>`
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

  const pager = page.pageCount > 1
    ? `<div class="nm-notification-pager">
        <button type="button" data-notification-page="previous"${page.page <= 0 ? " disabled" : ""}>Previous</button>
        <span class="nm-notification-page-label">${page.page + 1} / ${page.pageCount}</span>
        <button type="button" data-notification-page="next"${page.page >= page.pageCount - 1 ? " disabled" : ""}>Next</button>
      </div>`
    : "";
  const markAll = unread
    ? `<button type="button" class="nm-notification-mark-all"${card._notificationCompactMarkAllPending ? " disabled" : ""}>${card._notificationCompactMarkAllPending ? "Marking…" : "Mark all as read"}</button>`
    : "<span></span>";
  const error = card._notificationCompactActionError
    ? `<div class="nm-notification-action-error" role="alert">${escapeHtml(card._notificationCompactActionError)}</div>`
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
      card._notificationDialogRenderKeyBeta3 = null;
      renderNotificationDialog(card);
      if (button.dataset.notificationTitleUnread === "true"
          && button.dataset.notificationTitleMessageId) {
        void markNotificationRead(card, button.dataset.notificationTitleMessageId);
      }
    });
  });
  host.querySelectorAll("[data-notification-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      card._notificationPage += button.dataset.notificationPage === "next" ? 1 : -1;
      card._notificationDialogRenderKeyBeta3 = null;
      renderNotificationDialog(card);
    });
  });
}

function maybeAutoMarkReadOnOpen(card) {
  if (!booleanValue(card?._config?.notification_mark_read_on_open, false)) return;
  const { state } = notificationState(card);
  const items = notificationItemsWithMessageIds(state);
  if (!hasUnreadNotifications(items)) return;
  void markAllNotificationsRead(card);
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV037UPatched) return;
  Card.__navimowerV037UPatched = true;

  const originalStubConfig = typeof Card.getStubConfig === "function"
    ? Card.getStubConfig.bind(Card)
    : null;
  Card.getStubConfig = function compactUiStubConfig() {
    return normalizeCompactUiConfig(originalStubConfig?.() || {});
  };

  const originalConfigForm = typeof Card.getConfigForm === "function"
    ? Card.getConfigForm.bind(Card)
    : null;
  Card.getConfigForm = function compactUiConfigForm() {
    return extendCompactUiConfigForm(originalConfigForm?.() || { schema: [] });
  };

  const proto = Card.prototype;
  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function compactUiSetConfig(config) {
      return originalSetConfig.call(this, normalizeCompactUiConfig(config));
    };
  }

  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function compactUiEnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      ensureHeaderLayout(this);
      ensureCompactNotificationStyles(this);
      return result;
    };
  }

  const originalRenderShell = proto._renderShell;
  if (typeof originalRenderShell === "function") {
    proto._renderShell = function compactUiRenderShell(...args) {
      const result = originalRenderShell.apply(this, args);
      ensureHeaderLayout(this);
      return result;
    };
  }

  proto._openNotificationDialog = function compactUiOpenNotifications() {
    this._mowDialogOpen = false;
    this._scheduleDialogOpen = false;
    this._notificationDialogOpen = true;
    this._notificationPage = 0;
    this._notificationExpandedMessageIds = new Set();
    this._notificationCompactPendingMessageIds = new Set();
    this._notificationCompactMarkAllPending = false;
    this._notificationCompactActionError = null;
    this._notificationDialogRenderKeyBeta3 = null;
    this._renderShell?.();
    renderNotificationDialog(this);
    maybeAutoMarkReadOnOpen(this);
  };

  proto._closeNotificationDialog = function compactUiCloseNotifications() {
    this._notificationDialogOpen = false;
    this._notificationExpandedMessageIds = new Set();
    this._notificationCompactActionError = null;
    this._notificationDialogRenderKeyBeta3 = null;
    this._renderShell?.();
    this._renderDialog?.();
  };

  const originalRenderDialog = proto._renderDialog;
  if (typeof originalRenderDialog === "function") {
    proto._renderDialog = function compactUiRenderDialog(...args) {
      if (this._notificationDialogOpen) {
        renderNotificationDialog(this);
        return undefined;
      }
      return originalRenderDialog.apply(this, args);
    };
  }

  proto._renderNotificationDialog = function compactUiExplicitNotificationRender() {
    renderNotificationDialog(this);
  };

  proto._markNotificationRead = function compactUiMarkOne(messageId) {
    return markNotificationRead(this, messageId);
  };

  proto._markAllNotificationsRead = function compactUiMarkAll() {
    return markAllNotificationsRead(this);
  };

  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(proto, "hass", {
      ...hassDescriptor,
      set(hass) {
        hassDescriptor.set.call(this, hass);
        ensureHeaderLayout(this);
        if (this._notificationDialogOpen) {
          this._notificationDialogRenderKeyBeta3 = null;
          renderNotificationDialog(this);
        }
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.1-beta3 compact notifications and two-row header enabled");
}

if (globalThis.customElements) patchCard();
