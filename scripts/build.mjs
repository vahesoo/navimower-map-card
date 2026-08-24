import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");
const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") throw new Error(`src must contain exactly navimower-map-card.js; found: ${sourceJs.join(", ")}`);
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.version === "0.3.4-beta5") {
  let runtime = await readFile(source, "utf8");
  const marker = "// 0.3.4-beta5: scheduler overview and configurable settings dialog.";
  if (!runtime.includes(marker)) {
    runtime += `\n\n${marker}\n(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower034Beta5Patched) return;
  Card.__navimower034Beta5Patched = true;
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const slots = Array.from({ length: 12 }, (_, index) => \`settings_entity_\${index + 1}\`);
  const originalStub = Card.getStubConfig?.bind(Card);
  Card.getStubConfig = () => ({ ...(originalStub?.() || {}), ...Object.fromEntries(slots.map((key) => [key, null])) });
  const originalForm = Card.getConfigForm?.bind(Card);
  Card.getConfigForm = () => {
    const form = originalForm?.() || { schema: [] };
    const schema = Array.isArray(form.schema) ? [...form.schema] : [];
    schema.push({ type: "expandable", name: "settings_dialog", title: "Settings dialog", flatten: true, schema: [
      { type: "constant", name: "settings_dialog_hint" },
      { type: "grid", name: "settings_dialog_grid", flatten: true, column_min_width: "200px", schema: slots.map((name) => ({ name, selector: { entity: {} } })) }
    ] });
    const label = form.computeLabel;
    return { ...form, schema, computeLabel: (item) => {
      if (item?.name === "settings_dialog_hint") return "Choose up to 12 entities shown behind the gear button.";
      const match = String(item?.name || "").match(/^settings_entity_(\\d+)$/);
      if (match) return \`Settings slot \${match[1]}\`;
      return label?.(item) || item?.name || "";
    }};
  };
  const proto = Card.prototype;
  async function discover(card) {
    if (card._beta5SchedulerEntities || !card?._hass?.callWS) return card._beta5SchedulerEntities || {};
    try {
      const mower = card._mowerEntity?.();
      const registry = await card._hass.callWS({ type: "config/entity_registry/list" });
      const mowerEntry = Array.isArray(registry) ? registry.find((entry) => entry.entity_id === mower) : null;
      const related = mowerEntry?.device_id ? registry.filter((entry) => entry.device_id === mowerEntry.device_id && !entry.disabled_by) : [];
      const find = (domain, suffix) => related.find((entry) => String(entry.entity_id || "").startsWith(domain + ".") && (String(entry.unique_id || "").endsWith(suffix) || String(entry.entity_id || "").endsWith(suffix)))?.entity_id || null;
      card._beta5SchedulerEntities = {
        status: find("sensor", "navimower_schedule_status"),
        managedSwitch: find("switch", "navimower_schedule"),
        start: find("time", "navimower_schedule_start"),
        end: find("time", "navimower_schedule_end"),
        nativeSwitch: find("switch", "mowing_schedule_enabled") || card._scheduleSwitchEntity?.() || null
      };
    } catch (error) { console.debug("[Navimower Map Card] beta5 scheduler discovery failed", error); card._beta5SchedulerEntities = {}; }
    return card._beta5SchedulerEntities;
  }
  function isOn(card, entityId) { return String(card?._hass?.states?.[entityId]?.state || "").toLowerCase() === "on"; }
  function friendly(card, entityId) { const state = card?._hass?.states?.[entityId]; return state?.attributes?.friendly_name || entityId || "Entity"; }
  function value(card, entityId) { const state = card?._hass?.states?.[entityId]; if (!state) return "Unavailable"; const unit = state.attributes?.unit_of_measurement || ""; return \`\${state.state}\${unit ? " " + unit : ""}\`; }
  function ensureUi(card) {
    if (!card?._domReady) return;
    const header = card.querySelector?.(".nm-header-actions") || card.querySelector?.(".nm-header");
    if (header && !card.querySelector?.(".nm-settings-button")) {
      const button = document.createElement("button"); button.type = "button"; button.className = "nm-settings-button"; button.title = "Settings"; button.setAttribute("aria-label", "Open mower settings"); button.innerHTML = '<ha-icon icon="mdi:cog"></ha-icon>';
      button.addEventListener("click", () => { card._mowDialogOpen = false; card._scheduleDialogOpen = false; card._notificationDialogOpen = false; card._beta5ManagedScheduleOpen = false; card._beta5SettingsOpen = true; card._renderDialog?.(); });
      header.appendChild(button);
    }
    if (!card._beta5StylesApplied) {
      const style = card.querySelector?.("style"); if (!style) return; card._beta5StylesApplied = true;
      style.textContent += \`
        .nm-settings-button { width:34px;height:34px;display:inline-grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;color:var(--secondary-text-color);background:transparent; }
        .nm-settings-button:hover,.nm-settings-button:focus-visible { background:color-mix(in srgb,currentColor 10%,transparent);outline:none; }
        .nm-settings-button ha-icon { --mdc-icon-size:20px; }
        .nm-settings-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px 0; }
        .nm-settings-tile { min-width:0;padding:10px 12px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);cursor:pointer;text-align:left;color:var(--primary-text-color);font:inherit; }
        .nm-settings-name { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;color:var(--secondary-text-color); }
        .nm-settings-value { margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650; }
        .nm-managed-summary { display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 12px;color:var(--secondary-text-color);font-size:.88rem; }
        .nm-managed-queue { display:grid;gap:7px; }
        .nm-managed-zone { display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;background:var(--secondary-background-color);color:var(--primary-text-color); }
        .nm-managed-zone.completed { color:var(--secondary-text-color);opacity:.72; }
        .nm-managed-zone.active { color:#FF5A00;font-weight:700;box-shadow:inset 3px 0 #FF5A00; }
        .nm-managed-zone ha-icon { --mdc-icon-size:19px; }
        .nm-managed-empty { padding:18px 4px;color:var(--secondary-text-color);text-align:center; }
        @media(max-width:480px){.nm-settings-grid{grid-template-columns:1fr;}}
      \`;
    }
  }
  function renderSettings(card) {
    const host = card._modalHostEl; if (!host) return;
    const entities = slots.map((key) => card._config?.[key]).filter(Boolean);
    const rows = entities.length ? entities.map((entityId) => \`<button type="button" class="nm-settings-tile" data-settings-entity="\${esc(entityId)}"><div class="nm-settings-name">\${esc(friendly(card, entityId))}</div><div class="nm-settings-value">\${esc(value(card, entityId))}</div></button>\`).join("") : '<div class="nm-managed-empty">No settings selected. Add entities in the card visual editor → Settings dialog.</div>';
    host.innerHTML = \`<div class="nm-backdrop nm-settings-backdrop"><div class="nm-dialog" role="dialog" aria-modal="true" aria-label="Settings"><div class="nm-schedule-dialog-head"><div class="nm-schedule-dialog-title">Settings</div><button type="button" class="nm-schedule-close" data-settings-close aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></div><div class="nm-settings-grid">\${rows}</div></div></div>\`;
    const backdrop = host.querySelector(".nm-settings-backdrop"); backdrop?.addEventListener("click", (event) => { if (event.target === backdrop) { card._beta5SettingsOpen = false; card._renderDialog(); } });
    host.querySelector("[data-settings-close]")?.addEventListener("click", () => { card._beta5SettingsOpen = false; card._renderDialog(); });
    host.querySelectorAll("[data-settings-entity]").forEach((button) => button.addEventListener("click", () => card.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: button.dataset.settingsEntity } }))));
  }
  function renderManaged(card) {
    const host = card._modalHostEl; if (!host) return;
    const ids = card._beta5SchedulerEntities || {}; const state = card._hass?.states?.[ids.status]; const attrs = state?.attributes || {};
    const queue = Array.isArray(attrs.queue) ? attrs.queue : [];
    const icon = (status) => status === "completed" ? "mdi:check-circle-outline" : status === "active" ? "mdi:progress-clock" : "mdi:circle-outline";
    const rows = queue.length ? queue.map((zone) => \`<div class="nm-managed-zone \${esc(zone.status || "upcoming")}"><ha-icon icon="\${icon(zone.status)}"></ha-icon><span>\${esc(zone.name || \`Zone \${zone.id}\`)}</span></div>\`).join("") : '<div class="nm-managed-empty">No eligible zones in the current scheduler queue.</div>';
    const round = attrs.round_index ?? 1; const windowText = attrs.start && attrs.end ? \`\${attrs.start}–\${attrs.end}\` : "Window unavailable";
    host.innerHTML = \`<div class="nm-backdrop nm-managed-backdrop"><div class="nm-dialog nm-schedule-dialog" role="dialog" aria-modal="true" aria-label="Navimower schedule"><div class="nm-schedule-dialog-head"><div class="nm-schedule-dialog-title">Navimower schedule</div><button type="button" class="nm-schedule-close" data-managed-close aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></div><div class="nm-managed-summary"><span>\${esc(windowText)}</span><span>Round \${esc(round)}</span><span>\${esc(state?.state || "Unavailable")}</span></div><div class="nm-managed-queue">\${rows}</div></div></div>\`;
    const backdrop = host.querySelector(".nm-managed-backdrop"); backdrop?.addEventListener("click", (event) => { if (event.target === backdrop) { card._beta5ManagedScheduleOpen = false; card._renderDialog(); } });
    host.querySelector("[data-managed-close]")?.addEventListener("click", () => { card._beta5ManagedScheduleOpen = false; card._renderDialog(); });
  }
  const originalEnsure = proto._ensureDom;
  proto._ensureDom = function(...args) { const result = originalEnsure?.apply(this, args); ensureUi(this); void discover(this); return result; };
  const originalDialog = proto._renderDialog;
  proto._renderDialog = function(...args) { if (this._beta5SettingsOpen) { renderSettings(this); return; } if (this._beta5ManagedScheduleOpen) { renderManaged(this); return; } return originalDialog?.apply(this, args); };
  const originalOpenSchedule = proto._openScheduleDialog;
  proto._openScheduleDialog = async function(...args) {
    const ids = await discover(this); const managedOn = isOn(this, ids.managedSwitch); const nativeOn = isOn(this, ids.nativeSwitch);
    this._beta5SettingsOpen = false;
    if (managedOn && ids.status) { this._mowDialogOpen = false; this._notificationDialogOpen = false; this._scheduleDialogOpen = false; this._beta5ManagedScheduleOpen = true; this._renderDialog(); return; }
    this._beta5ManagedScheduleOpen = false;
    // Native schedule remains the configuration entry point whenever the managed scheduler is off, including when both schedulers are off.
    return originalOpenSchedule?.apply(this, args);
  };
  const originalHass = Object.getOwnPropertyDescriptor(proto, "hass");
  if (originalHass?.set) Object.defineProperty(proto, "hass", { configurable: true, get: originalHass.get, set(value) { originalHass.set.call(this, value); ensureUi(this); if (this._beta5ManagedScheduleOpen) renderManaged(this); if (this._beta5SettingsOpen) renderSettings(this); } });
  console.info("[Navimower Map Card] 0.3.4-beta5 scheduler overview and configurable settings dialog enabled");
})();\n`;
    await writeFile(source, runtime, "utf8");
  }
  const changelogPath = resolve(root, "CHANGELOG.md");
  let changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes("## 0.3.4-beta5 - 2026-08-24")) changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n## 0.3.4-beta5 - 2026-08-24\n\n### Added\n\n- Add a gear-button Settings dialog with up to 12 user-selected Home Assistant entities configured from the visual card editor.\n- Add a Navimower-managed scheduler overview using the integration's schedule-status sensor, with completed, active and upcoming zone states.\n- Route the Schedule button to the managed scheduler while it is enabled; otherwise keep the native mower schedule as the configuration entry point, including when both schedulers are off.\n\n");
  await writeFile(changelogPath, changelog, "utf8");
}
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
