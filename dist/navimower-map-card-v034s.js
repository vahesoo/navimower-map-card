/*
 * Navimower Map Card 0.3.0 stable schedule refinement.
 *
 * This stable-specific filename has never been used by beta5 or beta6, so an
 * existing browser cache cannot load the removed configuration-mutation layer.
 */

export const NAVIMOWER_MAP_CARD_V034S_VERSION = "0.3.0";
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
    if (this._v034sScheduleCloseTimer) {
      clearTimeout(this._v034sScheduleCloseTimer);
      this._v034sScheduleCloseTimer = null;
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
      this._v034sScheduleCloseTimer = setTimeout(() => {
        this._v034sScheduleCloseTimer = null;
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
  if (!Card || Card.__navimowerV034SPatched) return;
  Card.__navimowerV034SPatched = true;

  const proto = Card.prototype;
  patchScheduleCloseDelay(proto);

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function scheduleDisconnectedCallback(...args) {
    if (this._v034sScheduleCloseTimer) {
      clearTimeout(this._v034sScheduleCloseTimer);
      this._v034sScheduleCloseTimer = null;
    }
    return originalDisconnected?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.0 cache-safe schedule refinement enabled");
}

if (globalThis.customElements) patchCard();
