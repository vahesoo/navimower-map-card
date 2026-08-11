/*
 * Navimower Map Card 0.3.1-beta1 notification panel.
 *
 * Adds a read-only Notification -> Device view backed by Navimower's
 * Latest notification sensor. The card never marks vendor messages read.
 */

export const NAVIMOWER_MAP_CARD_V035N_VERSION = "0.3.1-beta1";
export const NOTIFICATION_PAGE_SIZE = 3;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function entityObjectId(entityId) {
  const text = String(entityId || "");
  const dot = text.indexOf(".");
  return dot >= 0 ? text.slice(dot + 1) : text;
}

function readFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "read" || text === "yes" || text === "on") return true;
  if (text === "false" || text === "unread" || text === "no" || text === "off") return false;
  return null;
}

function notificationDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    let numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    if (numeric < 100_000_000_000) numeric *= 1000;
    const date = new Date(numeric);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const raw = String(value).trim();
  let date = new Date(raw);
  if (!Number.isFinite(date.getTime()) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(raw)) {
    date = new Date(raw.replace(" ", "T"));
  }
  return Number.isFinite(date.getTime()) ? date : null;
}

export function notificationEntityCandidates(mowerEntity) {
  const mowerId = entityObjectId(mowerEntity);
  const bases = [...new Set([mowerId, mowerId.replace(/_mower$/, "")])].filter(Boolean);
  const candidates = [];
  for (const base of bases) {
    candidates.push(`sensor.${base}_latest_notification`);
    candidates.push(`sensor.${base}_notification`);
  }
  return [...new Set(candidates)];
}

export function normalizeNotificationItem(item = {}, fallbackTitle = "") {
  const source = item && typeof item === "object" ? item : {};
  const code = source.notification_code
    ?? source.error_code
    ?? source.errorCode
    ?? source.event_code
    ?? source.eventCode
    ?? source.message_code
    ?? source.messageCode
    ?? null;
  return {
    id: source.id ?? source.message_id ?? source.messageId ?? null,
    title: String(source.title ?? fallbackTitle ?? "").trim(),
    content: String(source.content ?? source.message ?? source.body ?? "").trim(),
    created_at: source.created_at ?? source.addtime ?? source.timestamp ?? source.time ?? null,
    read: readFlag(source.read ?? source.is_read ?? source.isRead),
    code: code === null || code === undefined || code === "" ? null : String(code),
  };
}

export function notificationItemsFromState(state) {
  if (!state || ["unknown", "unavailable"].includes(String(state.state || "").toLowerCase())) return [];
  const attrs = state.attributes && typeof state.attributes === "object" ? state.attributes : {};
  const fallbackTitle = String(state.state || "").trim();
  const recent = Array.isArray(attrs.recent) ? attrs.recent : [];
  if (recent.length) {
    return recent
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeNotificationItem(item));
  }
  if (!fallbackTitle || fallbackTitle.toLowerCase() === "no notifications") return [];
  return [normalizeNotificationItem({ ...attrs, title: attrs.title ?? fallbackTitle }, fallbackTitle)];
}

export function hasUnreadNotifications(items = []) {
  return (items || []).some((item) => item?.read === false);
}

export function notificationPage(items = [], page = 0, size = NOTIFICATION_PAGE_SIZE) {
  const pageSize = Math.max(1, Math.floor(Number(size) || NOTIFICATION_PAGE_SIZE));
  const total = Array.isArray(items) ? items.length : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(pageCount - 1, Math.max(0, Math.floor(Number(page) || 0)));
  return {
    page: safePage,
    pageCount,
    pageSize,
    total,
    items: (items || []).slice(safePage * pageSize, safePage * pageSize + pageSize),
  };
}

export function formatNotificationTimestamp(value, hass = null) {
  const date = notificationDate(value);
  if (!date) return "Time unavailable";
  const locale = hass?.locale?.language || globalThis.navigator?.language || "en";
  const timeFormat = String(hass?.locale?.time_format || "").toLowerCase();
  const hour12 = timeFormat === "12" ? true : timeFormat === "24" ? false : undefined;
  const timeZone = hass?.config?.time_zone || undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(hour12 === undefined ? {} : { hour12 }),
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch (_error) {
    return date.toLocaleString();
  }
}

function sameDeviceNotificationEntity(card) {
  const hass = card?._hass;
  const deviceId = card?._deviceId || null;
  if (!hass?.states || !deviceId) return null;
  for (const [entityId, state] of Object.entries(hass.states)) {
    if (!entityId.startsWith("sensor.")) continue;
    const entityDevice = hass.entities?.[entityId]?.device_id || null;
    if (entityDevice !== deviceId) continue;
    const objectId = entityObjectId(entityId).toLowerCase();
    const friendlyName = String(state?.attributes?.friendly_name || "").trim().toLowerCase();
    if (objectId.endsWith("_latest_notification")
      || objectId.endsWith("_notification")
      || friendlyName === "latest notification"
      || friendlyName.endsWith(" latest notification")) {
      return entityId;
    }
  }
  return null;
}

function resolveNotificationEntity(card) {
  const hass = card?._hass;
  if (!hass?.states) return card?._config?.notification_entity || card?._resolved?.notification_entity || null;
  const explicit = card?._config?.notification_entity;
  if (explicit && hass.states[explicit]) return explicit;
  const resolved = card?._resolved?.notification_entity;
  if (resolved && hass.states[resolved]) return resolved;
  const mowerEntity = card?._resolved?.mower_entity
    || card?._config?.entity
    || card?._config?.mower_entity
    || card?._config?.status_entity;
  const named = notificationEntityCandidates(mowerEntity).find((entityId) => hass.states[entityId]);
  const found = named || sameDeviceNotificationEntity(card);
  if (found && card?._resolved) {
    card._resolved = { ...card._resolved, notification_entity: found };
  }
  return found || null;
}

function notificationState(card) {
  const entityId = resolveNotificationEntity(card);
  return { entityId, state: entityId ? card?._hass?.states?.[entityId] || null : null };
}

function ensureNotificationDom(card) {
  if (!card?._domReady) return;
  const existing = card.querySelector?.(".nm-notification-button");
  if (existing) {
    card._notificationButtonEl = existing;
    return;
  }
  const header = card.querySelector?.(".nm-header");
  if (!header) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nm-notification-button";
  button.setAttribute("aria-label", "Open notifications");
  button.setAttribute("aria-pressed", "false");
  button.title = "Notifications";
  button.innerHTML = '<ha-icon icon="mdi:bell-outline"></ha-icon>';
  const schedule = card.querySelector?.(".nm-schedule-button");
  if (schedule) schedule.before(button);
  else header.appendChild(button);
  card._notificationButtonEl = button;
  card._notificationDialogOpen ??= false;
  card._notificationPage ??= 0;

  button.addEventListener("click", () => {
    if (card._notificationDialogOpen) card._closeNotificationDialog?.();
    else card._openNotificationDialog?.();
  });

  const style = card.querySelector?.("style");
  if (style) {
    style.textContent += `
      .nm-notification-button { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center;
        padding: 0; border: 0; border-radius: 50%; cursor: pointer; color: var(--secondary-text-color);
        background: transparent; }
      .nm-notification-button:hover, .nm-notification-button:focus-visible {
        background: color-mix(in srgb, currentColor 10%, transparent); outline: none; }
      .nm-notification-button.unread { color: #FF5A00; }
      .nm-notification-button ha-icon { --mdc-icon-size: 22px; }
      .nm-notification-dialog { max-width: 520px; padding: 0; overflow: hidden; }
      .nm-notification-head { display: flex; align-items: center; gap: 12px; padding: 16px 18px 12px;
        border-bottom: 1px solid var(--divider-color); }
      .nm-notification-title { flex: 1; min-width: 0; font-size: 1.15rem; font-weight: 700; }
      .nm-notification-close { width: 34px; height: 34px; display: grid; place-items: center; padding: 0;
        border: 0; border-radius: 50%; cursor: pointer; color: var(--secondary-text-color); background: transparent; }
      .nm-notification-close:hover { color: var(--primary-text-color); background: var(--secondary-background-color); }
      .nm-notification-body { max-height: min(68vh, 620px); overflow-y: auto; padding: 4px 16px; }
      .nm-notification-empty { padding: 28px 8px; text-align: center; color: var(--secondary-text-color); }
      .nm-notification-item { padding: 13px 2px 14px; border-bottom: 1px solid var(--divider-color); }
      .nm-notification-item:last-child { border-bottom: 0; }
      .nm-notification-meta { display: flex; align-items: center; gap: 7px; min-height: 18px;
        color: var(--secondary-text-color); font-size: .78rem; }
      .nm-notification-dot { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; opacity: 0; background: #FF5A00; }
      .nm-notification-item.unread .nm-notification-dot { opacity: 1; }
      .nm-notification-time { flex: 1; min-width: 0; }
      .nm-notification-code { flex: 0 0 auto; font-family: var(--code-font-family, monospace); }
      .nm-notification-item-title { margin-top: 5px; font-weight: 650; color: var(--primary-text-color); line-height: 1.3; }
      .nm-notification-content { margin-top: 4px; color: var(--secondary-text-color); font-size: .88rem; line-height: 1.4;
        white-space: pre-wrap; overflow-wrap: anywhere; }
      .nm-notification-pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 11px 14px;
        border-top: 1px solid var(--divider-color); background: var(--card-background-color, var(--ha-card-background, #fff)); }
      .nm-notification-pager button { min-height: 36px; padding: 6px 12px; border: 0; border-radius: 9px;
        cursor: pointer; color: var(--primary-text-color); background: var(--secondary-background-color); font: inherit; }
      .nm-notification-pager button:disabled { opacity: .42; cursor: default; }
      .nm-notification-page-label { min-width: 52px; text-align: center; color: var(--secondary-text-color); font-size: .82rem; font-weight: 600; }
      @media (max-width: 480px) {
        .nm-notification-dialog { max-width: none; }
        .nm-notification-body { max-height: min(72vh, 620px); padding-left: 12px; padding-right: 12px; }
      }
    `;
  }
}

function renderNotificationBell(card) {
  ensureNotificationDom(card);
  const button = card?._notificationButtonEl;
  if (!button) return;
  const { entityId, state } = notificationState(card);
  const items = notificationItemsFromState(state);
  const unread = hasUnreadNotifications(items);
  const signature = items.map((item) => `${item.id ?? ""}:${item.read}:${item.created_at ?? ""}`).join("|");
  const key = `${entityId || ""}|${state?.state || ""}|${unread}|${signature}|${Boolean(card._notificationDialogOpen)}`;
  if (key === card._notificationBellRenderKey) return;
  card._notificationBellRenderKey = key;
  button.classList.toggle("unread", unread);
  button.setAttribute("aria-pressed", card._notificationDialogOpen ? "true" : "false");
  button.setAttribute("aria-label", unread ? "Open unread notifications" : "Open notifications");
  button.title = entityId
    ? `${unread ? "Unread notifications" : "Notifications"} · ${entityId}`
    : "Notifications · Latest notification entity not found";
  const icon = button.querySelector("ha-icon");
  icon?.setAttribute("icon", unread ? "mdi:bell-badge-outline" : "mdi:bell-outline");
}

function renderNotificationDialog(card) {
  const host = card?._modalHostEl;
  if (!host) return;
  const { entityId, state } = notificationState(card);
  const items = notificationItemsFromState(state);
  const page = notificationPage(items, card._notificationPage, NOTIFICATION_PAGE_SIZE);
  card._notificationPage = page.page;
  const signature = JSON.stringify(items.map((item) => [item.id, item.title, item.content, item.created_at, item.read, item.code]));
  const key = `${entityId || ""}|${state?.state || ""}|${page.page}|${signature}`;
  if (key === card._notificationDialogRenderKey && host.querySelector?.(".nm-notification-dialog")) return;
  card._notificationDialogRenderKey = key;

  let body;
  if (!entityId || !state) {
    body = '<div class="nm-notification-empty">Latest notification entity is not available. Navimower 0.4.1 or later is required.</div>';
  } else if (!items.length) {
    body = '<div class="nm-notification-empty">No notifications available.</div>';
  } else {
    body = page.items.map((item) => {
      const unread = item.read === false;
      const timestamp = formatNotificationTimestamp(item.created_at, card._hass);
      const code = item.code ? `<span class="nm-notification-code">${escapeHtml(item.code)}</span>` : "";
      const title = item.title || "Notification";
      const content = item.content ? `<div class="nm-notification-content">${escapeHtml(item.content)}</div>` : "";
      return `<article class="nm-notification-item${unread ? " unread" : ""}">
        <div class="nm-notification-meta">
          <span class="nm-notification-dot" aria-hidden="true"></span>
          <span class="nm-notification-time">${escapeHtml(timestamp)}</span>
          ${code}
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

  host.innerHTML = `<div class="nm-backdrop nm-notification-backdrop">
    <div class="nm-dialog nm-notification-dialog" role="dialog" aria-modal="true" aria-label="Notifications">
      <div class="nm-notification-head">
        <div class="nm-notification-title">Notifications</div>
        <button type="button" class="nm-notification-close" aria-label="Close notifications" title="Close">
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="nm-notification-body">${body}</div>
      ${pager}
    </div>
  </div>`;

  const backdrop = host.querySelector(".nm-notification-backdrop");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) card._closeNotificationDialog?.();
  });
  host.querySelector(".nm-notification-close")?.addEventListener("click", () => card._closeNotificationDialog?.());
  host.querySelectorAll("[data-notification-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      card._notificationPage += button.dataset.notificationPage === "next" ? 1 : -1;
      card._notificationDialogRenderKey = null;
      renderNotificationDialog(card);
    });
  });
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV035NPatched) return;
  Card.__navimowerV035NPatched = true;
  const proto = Card.prototype;

  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function notificationEnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      ensureNotificationDom(this);
      renderNotificationBell(this);
      return result;
    };
  }

  const originalResolveByName = proto._resolveEntitiesByName;
  if (typeof originalResolveByName === "function") {
    proto._resolveEntitiesByName = function notificationResolveByName(base) {
      const resolved = originalResolveByName.call(this, base);
      const explicit = this._config?.notification_entity;
      if (explicit && this._hass?.states?.[explicit]) resolved.notification_entity = explicit;
      if (!resolved.notification_entity) {
        const mowerEntity = resolved.mower_entity || this._config?.entity;
        resolved.notification_entity = notificationEntityCandidates(mowerEntity)
          .find((entityId) => this._hass?.states?.[entityId]) || null;
      }
      return resolved;
    };
  }

  const originalRegistryResolve = proto._resolveEntitiesFromRegistry;
  if (typeof originalRegistryResolve === "function") {
    proto._resolveEntitiesFromRegistry = async function notificationRegistryResolve(...args) {
      const result = await originalRegistryResolve.apply(this, args);
      resolveNotificationEntity(this);
      renderNotificationBell(this);
      if (this._notificationDialogOpen) renderNotificationDialog(this);
      return result;
    };
  }

  proto._openNotificationDialog = function openNotificationDialog() {
    this._mowDialogOpen = false;
    this._scheduleDialogOpen = false;
    this._notificationDialogOpen = true;
    this._notificationPage = 0;
    this._notificationDialogRenderKey = null;
    renderNotificationBell(this);
    renderNotificationDialog(this);
  };

  proto._closeNotificationDialog = function closeNotificationDialog() {
    this._notificationDialogOpen = false;
    this._notificationDialogRenderKey = null;
    renderNotificationBell(this);
    this._renderDialog?.();
  };

  proto._renderNotificationDialog = function cardRenderNotificationDialog() {
    renderNotificationDialog(this);
  };

  const originalRenderShell = proto._renderShell;
  if (typeof originalRenderShell === "function") {
    proto._renderShell = function notificationRenderShell(...args) {
      const result = originalRenderShell.apply(this, args);
      renderNotificationBell(this);
      return result;
    };
  }

  const originalRenderDialog = proto._renderDialog;
  if (typeof originalRenderDialog === "function") {
    proto._renderDialog = function notificationRenderDialog(...args) {
      if (this._notificationDialogOpen) {
        renderNotificationDialog(this);
        return undefined;
      }
      return originalRenderDialog.apply(this, args);
    };
  }

  const originalOpenSchedule = proto._openScheduleDialog;
  if (typeof originalOpenSchedule === "function") {
    proto._openScheduleDialog = function notificationCloseForSchedule(...args) {
      this._notificationDialogOpen = false;
      this._notificationDialogRenderKey = null;
      renderNotificationBell(this);
      return originalOpenSchedule.apply(this, args);
    };
  }

  const originalMowPressed = proto._onMowPressed;
  if (typeof originalMowPressed === "function") {
    proto._onMowPressed = function notificationCloseForMow(...args) {
      this._notificationDialogOpen = false;
      this._notificationDialogRenderKey = null;
      renderNotificationBell(this);
      return originalMowPressed.apply(this, args);
    };
  }

  const hassDescriptor = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(proto, "hass", {
      ...hassDescriptor,
      set(hass) {
        hassDescriptor.set.call(this, hass);
        renderNotificationBell(this);
        if (this._notificationDialogOpen) renderNotificationDialog(this);
      },
    });
  }

  console.info("[Navimower Map Card] 0.3.1-beta1 read-only notification panel enabled");
}

if (globalThis.customElements) patchCard();
