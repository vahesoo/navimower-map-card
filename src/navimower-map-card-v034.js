/*
 * Navimower Map Card 0.3.0 schedule refinement.
 *
 * Keeps the successful schedule-save confirmation visible for 2.5 seconds
 * before closing the dialog. The stable module filename gives the 0.3.0 release
 * its own browser module URL and avoids reusing a cached beta module.
 */

export const NAVIMOWER_MAP_CARD_V034_VERSION = "0.3.0";
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
    if (this._v034ScheduleCloseTimer) {
      clearTimeout(this._v034ScheduleCloseTimer);
      this._v034ScheduleCloseTimer = null;
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
      this._v034ScheduleCloseTimer = setTimeout(() => {
        this._v034ScheduleCloseTimer = null;
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
  if (!Card || Card.__navimowerV034Patched) return;
  Card.__navimowerV034Patched = true;

  const proto = Card.prototype;
  patchScheduleCloseDelay(proto);

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function scheduleDisconnectedCallback(...args) {
    if (this._v034ScheduleCloseTimer) {
      clearTimeout(this._v034ScheduleCloseTimer);
      this._v034ScheduleCloseTimer = null;
    }
    return originalDisconnected?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.0 schedule refinement enabled");
}

if (globalThis.customElements) patchCard();
