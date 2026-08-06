/*
 * Navimower Map Card 0.3.0-beta7 schedule refinement.
 *
 * Uses a beta-specific module filename so Home Assistant and browser module
 * caches cannot reuse the beta5/beta6 editor layer. Manual HEX editor fields
 * and all configuration wrapping are intentionally removed.
 */

export const NAVIMOWER_MAP_CARD_V034B7_VERSION = "0.3.0-beta7";
export const SCHEDULE_CLOSE_DELAY_MS = 2500;

export function scheduleSaveSucceeded(card) {
  const dirty = (card?._scheduleDraft || []).some(
    (day) => day?._dirty || day?._saving,
  );
  const failed = Object.values(card?._scheduleStatus || {}).some(
    (status) => status?.kind === "error",
  );
  return !dirty && !failed;
}

function patchScheduleCloseDelay(proto) {
  const currentSaveAll = proto?._saveAllScheduleChanges;
  if (typeof currentSaveAll !== "function") return;

  proto._saveAllScheduleChanges = async function delayedScheduleDialogClose(...args) {
    if (this._v034b7ScheduleCloseTimer) {
      clearTimeout(this._v034b7ScheduleCloseTimer);
      this._v034b7ScheduleCloseTimer = null;
    }

    const renderDialog = this._renderDialog;
    let suppressedSuccessfulClose = false;
    if (typeof renderDialog === "function") {
      this._renderDialog = (...renderArgs) => {
        if (this._scheduleDialogOpen === false) {
          suppressedSuccessfulClose = true;
          return undefined;
        }
        return renderDialog.apply(this, renderArgs);
      };
    }

    let result;
    try {
      result = await currentSaveAll.apply(this, args);
    } finally {
      if (typeof renderDialog === "function") this._renderDialog = renderDialog;
    }

    if (suppressedSuccessfulClose && scheduleSaveSucceeded(this)) {
      this._scheduleDialogOpen = true;
      renderDialog?.call(this);
      this._v034b7ScheduleCloseTimer = setTimeout(() => {
        this._v034b7ScheduleCloseTimer = null;
        if (!this._scheduleDialogOpen || !scheduleSaveSucceeded(this)) return;
        this._scheduleDialogOpen = false;
        renderDialog?.call(this);
      }, SCHEDULE_CLOSE_DELAY_MS);
    }
    return result;
  };
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV034B7Patched) return;
  Card.__navimowerV034B7Patched = true;

  const proto = Card.prototype;
  patchScheduleCloseDelay(proto);

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function scheduleDisconnectedCallback(...args) {
    if (this._v034b7ScheduleCloseTimer) {
      clearTimeout(this._v034b7ScheduleCloseTimer);
      this._v034b7ScheduleCloseTimer = null;
    }
    return originalDisconnected?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.0-beta7 cache-safe schedule refinement enabled");
}

if (globalThis.customElements) patchCard();
