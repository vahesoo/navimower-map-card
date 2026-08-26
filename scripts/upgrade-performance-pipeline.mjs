import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta4: flattened hot-path and phased visual render pipeline.";
if (source.includes(marker)) {
  console.log("Performance pipeline already applied");
  process.exit(0);
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta4Performance) return;
  Card.__navimower035Beta4Performance = true;
  const proto = Card.prototype;

  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");

  const stateStamp = (hass, entityId) => {
    if (!entityId) return "";
    const state = hass?.states?.[entityId];
    if (!state) return entityId + ":missing";
    return [entityId, state.state, state.last_updated || "", state.last_changed || ""].join(":");
  };

  const relevantEntityIds = (card) => {
    const resolved = card?._resolved || {};
    const ids = [
      resolved.mower_entity,
      resolved.status_entity,
      resolved.map_entity,
      resolved.x_entity,
      resolved.y_entity,
      resolved.heading_entity,
      resolved.battery_entity,
      resolved.zone_entity,
      resolved.schedule_entity,
      resolved.schedule_switch_entity,
      resolved.notification_entity,
    ];
    return [...new Set(ids.filter(Boolean))];
  };

  const customAreaIds = (card) => Array.isArray(card?._customAreaEntities0342)
    ? card._customAreaEntities0342.filter(Boolean)
    : [];

  const modalOpen = (card) => Boolean(
    card?._mowDialogOpen ||
    card?._scheduleDialogOpen ||
    card?._notificationDialogOpen ||
    card?._beta5ManagedScheduleOpen ||
    card?._beta5SettingsOpen ||
    card?._beta6ManagedOpen ||
    card?._beta8SettingsOpen ||
    card?._beta2ScheduleOpen
  );

  const relevantFingerprint = (card, hass) => {
    const stamps = relevantEntityIds(card).map((id) => stateStamp(hass, id));
    stamps.push(
      "resume:" + Boolean(hass?.services?.navimower?.resume),
      "queue:" + Boolean(hass?.services?.navimower?.set_schedule_queue)
    );
    return stamps.join("|");
  };

  const notificationFingerprint = (card, hass) => {
    const id = card?._resolved?.notification_entity || null;
    return stateStamp(hass, id);
  };

  const customAreaFingerprint = (card, hass) => customAreaIds(card)
    .map((id) => stateStamp(hass, id))
    .join("|");

  // The normal dashboard hot path no longer traverses every historical feature
  // wrapper on each Home Assistant state update. Dialogs deliberately retain
  // the compatibility chain while open because their native HA rows need the
  // full hass propagation. Closed Settings/Schedule/Notifications are lazy.
  if (previousHass?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get() {
        return this._hass;
      },
      set(value) {
        if (modalOpen(this)) {
          previousHass.set.call(this, value);
          this._perf035RelevantFingerprint = relevantFingerprint(this, value);
          this._perf035NotificationFingerprint = notificationFingerprint(this, value);
          this._perf035CustomAreaFingerprint = customAreaFingerprint(this, value);
          return;
        }

        this._hass = value;
        if (!this._config) return;
        if (!this._domReady) this._ensureDom();

        this._resolveEntities();
        const nextNotification = notificationFingerprint(this, value);
        const nextCustomAreas = customAreaFingerprint(this, value);
        const compatibilityUpdate = (
          (nextNotification && nextNotification !== (this._perf035NotificationFingerprint || "")) ||
          (nextCustomAreas && nextCustomAreas !== (this._perf035CustomAreaFingerprint || ""))
        );

        // Notification-bell and legacy Custom Area fallbacks update rarely. Let
        // their existing compatibility code run only when those exact entities
        // changed, never for every unrelated HA event.
        if (compatibilityUpdate) {
          previousHass.set.call(this, value);
          this._perf035RelevantFingerprint = relevantFingerprint(this, value);
          this._perf035NotificationFingerprint = nextNotification;
          this._perf035CustomAreaFingerprint = nextCustomAreas;
          return;
        }

        const next = relevantFingerprint(this, value);
        const first = this._perf035RelevantFingerprint === undefined;
        if (!first && next === this._perf035RelevantFingerprint) return;
        this._perf035RelevantFingerprint = next;
        this._perf035NotificationFingerprint = nextNotification;
        this._perf035CustomAreaFingerprint = nextCustomAreas;

        this._maybeLoadMap();
        this._updateLive(first);
      },
    });
  }

  const renderPhase = (card, keys) => {
    for (const key of keys) {
      if (!card._pendingRender?.[key]) continue;
      delete card._pendingRender[key];
      if (key === "shell") card._renderShell();
      else if (key === "history") card._renderHistory();
      else if (key === "trail") card._renderTrail();
      else if (key === "mower") card._renderMower();
      else if (key === "footer") card._renderFooter();
      else if (key === "controls") card._renderControls();
      else if (key === "sessions") card._renderSessions();
      else if (key === "message") card._renderMessage();
      else if (key === "dialog") {
        if (card._scheduleDialogOpen) card._syncScheduleDraft();
        card._renderDialog();
      }
    }
  };

  const PHASES = Object.freeze([
    ["dialog"],
    // Static map geometry is already applied synchronously by _applyMapPayload.
    // The first scheduled paint therefore adds only visible map overlays.
    ["shell", "message", "history", "trail"],
    ["mower"],
    ["footer", "controls"],
    // Session/history chips are useful but visually non-critical and come last.
    ["sessions"],
  ]);

  const nextPendingPhase = (card) => PHASES.find((phase) =>
    phase.some((key) => Boolean(card._pendingRender?.[key]))
  );

  const scheduleFrame = (card) => {
    if (card._renderHandle !== null) return;
    const schedule = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    card._renderHandle = schedule(() => {
      card._renderHandle = null;
      const phase = nextPendingPhase(card);
      if (!phase) return;
      renderPhase(card, phase);
      if (nextPendingPhase(card)) scheduleFrame(card);
    });
  };

  proto._queueRender = function phasedQueueRender(flags = {}) {
    if (!this._pendingRender || typeof this._pendingRender !== "object") this._pendingRender = {};
    for (const [key, value] of Object.entries(flags)) {
      if (value) this._pendingRender[key] = true;
    }
    scheduleFrame(this);
  };

  // Exposed only for deterministic regression tests and diagnostics.
  proto._performanceRenderPhases035 = () => PHASES.map((phase) => [...phase]);

  console.info("[Navimower Map Card] 0.3.5-beta4 phased performance pipeline enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied phased map performance pipeline");
