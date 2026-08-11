/*
 * Navimower Map Card 0.3.1-beta5 Resume controls.
 *
 * Adds a dedicated Resume button only when Home Assistant exposes
 * navimower.resume and the mower is paused, docked, or charging. The card
 * never infers that a retained vendor task definitely exists; docked/charging
 * Resume remains an explicit field-validation action supplied by the
 * integration.
 */

export const NAVIMOWER_MAP_CARD_V039R_VERSION = "0.3.1-beta5";

function stateStrings(state) {
  return [state?.state, state?.attributes?.state, state?.attributes?.activity]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export function resumeServiceAvailable(hass) {
  return Boolean(hass?.services?.navimower?.resume);
}

export function resumeStateKind(state) {
  const values = stateStrings(state);
  if (values.some((value) => value === "paused" || value.includes("pause"))) {
    return "paused";
  }
  if (values.some((value) => value === "charging" || value.includes("charging"))) {
    return "charging";
  }
  if (state?.attributes?.docked === true
      || values.some((value) => value === "docked" || value.includes("docked"))) {
    return "docked";
  }
  return null;
}

export function shouldOfferResume(hass, state) {
  return resumeServiceAvailable(hass) && resumeStateKind(state) !== null;
}

function mowerState(card) {
  const entityId = typeof card?._mowerEntity === "function"
    ? card._mowerEntity()
    : card?._resolved?.mower_entity || card?._config?.entity || null;
  if (!entityId) return null;
  if (typeof card?._state === "function") return card._state(entityId);
  return card?._hass?.states?.[entityId] || null;
}

function ensureStyles(card) {
  if (!card?._domReady || card._beta5ResumeStylesApplied) return;
  const style = card.querySelector?.("style");
  if (!style) return;
  card._beta5ResumeStylesApplied = true;
  style.textContent += `
    .nm-control.nm-resume[hidden] { display: none; }
    .nm-control.nm-resume { color: var(--text-primary-color, #fff);
      background: var(--primary-color, #03a9f4); }
    .nm-controls.nm-has-resume .nm-control.nm-resume { grid-column: auto; }
    .nm-controls.nm-has-resume .nm-control.nm-mow { grid-column: auto;
      color: var(--primary-text-color); background: var(--secondary-background-color);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, #03a9f4) 45%, transparent); }
  `;
}

function resumeTarget(card) {
  const deviceId = typeof card?._mowerDeviceId === "function"
    ? card._mowerDeviceId()
    : card?._deviceId || null;
  return deviceId ? { device_id: deviceId } : {};
}

async function runResume(card) {
  if (!card?._hass?.callService || card._commandBusy) return;
  const state = mowerState(card);
  if (!shouldOfferResume(card._hass, state)) return;

  card._commandBusy = true;
  card._commandStatus = { kind: "saving", text: "Resuming interrupted mowing…" };
  card._renderControls?.();
  try {
    await card._hass.callService("navimower", "resume", resumeTarget(card));
    card._commandStatus = { kind: "saved", text: "Resume command sent" };
  } catch (error) {
    card._commandStatus = { kind: "error", text: "Resume failed" };
    console.error("[Navimower Map Card] navimower.resume failed", error);
  } finally {
    card._commandBusy = false;
    card._renderControls?.();
  }
}

function ensureResumeButton(card) {
  if (!card?._domReady || !card._controlsEl) return null;
  let button = card._controlsEl.querySelector?.(".nm-resume");
  if (button) return button;

  const documentRef = card.ownerDocument || globalThis.document;
  if (!documentRef?.createElement) return null;
  button = documentRef.createElement("button");
  button.type = "button";
  button.className = "nm-control nm-resume";
  button.dataset.command = "resume";
  button.hidden = true;
  button.title = "Resume interrupted mowing";
  button.innerHTML = '<ha-icon icon="mdi:play-circle-outline"></ha-icon><span>Resume</span>';
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (button.disabled) return;
    void runResume(card);
  });

  const mowButton = card._controlsEl.querySelector?.(".nm-mow");
  card._controlsEl.insertBefore(button, mowButton || card._controlsEl.firstChild);
  return button;
}

function updateResumeButton(card) {
  ensureStyles(card);
  const button = ensureResumeButton(card);
  if (!button || !card?._controlsEl) return false;

  const state = mowerState(card);
  const kind = resumeStateKind(state);
  const visible = shouldOfferResume(card._hass, state);
  const unavailable = !state
    || ["unknown", "unavailable"].includes(String(state.state || "").toLowerCase());

  button.hidden = !visible;
  button.disabled = !visible || unavailable || Boolean(card._commandBusy);
  button.title = kind === "paused"
    ? "Resume the paused mowing task"
    : "Resume the vendor-retained interrupted mowing task";
  card._controlsEl.classList.toggle("nm-has-resume", visible);
  return visible;
}

function openNewMowDialog(card) {
  const zones = typeof card?._availableMowZones === "function"
    ? card._availableMowZones()
    : [];
  const sequence = Array.isArray(card?._mowSequence) ? card._mowSequence : [];
  card._mowSequence = sequence.filter((id) => zones.some((zone) => zone.id === id));
  card._scheduleDialogOpen = false;
  card._notificationDialogOpen = false;
  card._mowDialogOpen = true;
  card._commandStatus = null;
  card._renderControls?.();
  card._renderDialog?.();
}

function patchCard() {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimowerV039RPatched) return;
  Card.__navimowerV039RPatched = true;

  const proto = Card.prototype;
  const originalEnsureDom = proto._ensureDom;
  if (typeof originalEnsureDom === "function") {
    proto._ensureDom = function beta5ResumeEnsureDom(...args) {
      const result = originalEnsureDom.apply(this, args);
      ensureStyles(this);
      updateResumeButton(this);
      return result;
    };
  }

  const originalRenderControls = proto._renderControls;
  if (typeof originalRenderControls === "function") {
    proto._renderControls = function beta5ResumeRenderControls(...args) {
      const result = originalRenderControls.apply(this, args);
      updateResumeButton(this);
      return result;
    };
  }

  const originalOnMowPressed = proto._onMowPressed;
  if (typeof originalOnMowPressed === "function") {
    proto._onMowPressed = async function beta5MowPressed(...args) {
      // Older integrations have no dedicated Resume action, so preserve their
      // historical paused -> lawn_mower.start_mowing behavior. With beta3+ the
      // dedicated Resume button owns Resume and Mow opens a genuinely new task.
      if (resumeServiceAvailable(this._hass) && this._isPausedJob?.()) {
        openNewMowDialog(this);
        return;
      }
      return originalOnMowPressed.apply(this, args);
    };
  }

  proto._runResumeCommand = function beta5RunResume() {
    return runResume(this);
  };
  proto._resumeAvailable = function beta5ResumeAvailable() {
    return shouldOfferResume(this._hass, mowerState(this));
  };

  console.info("[Navimower Map Card] 0.3.1-beta5 conditional Resume control enabled");
}

if (globalThis.customElements) patchCard();
