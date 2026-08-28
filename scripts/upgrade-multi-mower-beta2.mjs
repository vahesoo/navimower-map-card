import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const beta1Marker = "// 0.3.6-beta1: opt-in multi-mower site view.";
const beta2Marker = "// 0.3.6-beta2: multi-mower field-test fixes.";

let source = await readFile(sourcePath, "utf8");
if (source.includes(beta2Marker)) {
  console.log("0.3.6-beta2 multi-mower fixes already applied");
  process.exit(0);
}
if (!source.includes(beta1Marker)) {
  throw new Error("Expected 0.3.6-beta1 multi-mower runtime was not found");
}

function replaceExact(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing beta2 replacement target: ${label}`);
  source = source.replace(before, after);
}

function replaceSection(start, end, replacement, label) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Missing beta2 section start: ${label}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`Missing beta2 section end: ${label}`);
  source = source.slice(0, from) + replacement + source.slice(to);
}

replaceSection(
  "  const ensurePreference036 = (card) => {",
  "  const siteAvailable036 =",
  `  const ensurePreference036 = (card) => {
    card._multi036PreferenceKey = preferenceKey036(card);
    card._multi036PreferenceLoaded = true;
    card._multi036Requested = asBool036(card?._config?.multi_mower, false);
  };

  const savePreference036 = (_card) => {};

`,
  "config-owned multi-mower preference",
);

replaceExact(
  '      "_beta2SchedulerEntities", "_beta2ScheduleStatus", "_beta2ScheduleDraft"',
  '      "_beta2SchedulerIds", "_beta2SchedulerEntities", "_beta2ScheduleStatus", "_beta2ScheduleDraft"',
  "scheduler cache reset",
);

replaceSection(
  "  const mowerMarkup036 = (card, member, matrix) => {",
  "  const renderArchive036 =",
  `  const mowerMarkup036 = (card, member, matrix) => {
    const entities = memberEntities036(member);
    const x = entityValue036(card, entities.position_x);
    const y = entityValue036(card, entities.position_y);
    if (x === null || y === null || !matrix) return "";
    const heading = entityValue036(card, entities.heading);
    const key = memberIconKey036(member);
    const spec = typeof MOWER_ICON_SPECS_032 !== "undefined" ? MOWER_ICON_SPECS_032[key] || MOWER_ICON_SPECS_032.h2 : null;
    if (!spec) return "";
    const zoom = Math.max(1, finite036(card?._view?.scale, 1));
    const screen = transformPoint036(matrix, x, y);
    const siteRotation = Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI;
    const degrees = siteRotation + (Number.isFinite(heading) ? 90 - heading : 90);
    const scale = 58.83 / spec.height * clamp036(card?._config?.mower_scale, 0.5, 2.5) / zoom;
    const mowerState = String(state036(card, entities.mower)?.state || "").toLowerCase();
    const errorClass = ["error", "blocked", "unavailable"].includes(mowerState) ? " nm-multi-mower-error" : "";
    return "<g class=\\"nm-multi-mower" + errorClass + "\\" transform=\\"translate(" + screen[0].toFixed(2) + " " + screen[1].toFixed(2) + ") rotate(" + degrees.toFixed(2) + ") scale(" + scale.toFixed(6) + ") translate(" + (-spec.width / 2).toFixed(2) + " " + (-spec.height / 2).toFixed(2) + ")\\">" + spec.markup + "</g>";
  };

  const normalizeLiveTrailSegments036 = (value) => {
    if (!Array.isArray(value) || !value.length) return [];
    const pointLike = (point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
    const clean = (segment) => (Array.isArray(segment) ? segment : [])
      .filter(pointLike)
      .map((point) => [Number(point[0]), Number(point[1])]);
    if (value.every(pointLike)) {
      const segment = clean(value);
      return segment.length >= 2 ? [segment] : [];
    }
    return value.map(clean).filter((segment) => segment.length >= 2);
  };

  const liveTrailSegments036 = (card, member, payload) => {
    if (String(member?.entry_id) === String(anchorEntry036(card)) && typeof card?._activeTrailSegments === "function") {
      const local = normalizeLiveTrailSegments036(card._activeTrailSegments());
      if (local.length) return local;
    }
    return normalizeLiveTrailSegments036(payload?.trail_segments);
  };

  const liveTrailSignature036 = (card, member, payload) => liveTrailSegments036(card, member, payload)
    .map((segment) => {
      const last = segment.at(-1) || [];
      return segment.length + ":" + Number(last[0] || 0).toFixed(3) + "," + Number(last[1] || 0).toFixed(3);
    })
    .join(";");

  const memberTrailWidthMeters036 = (member) => {
    if (typeof renderedTrailWidthMeters034 === "function") return renderedTrailWidthMeters034(member?.model || member?.vehicle_type || "");
    return 0.25;
  };

`,
  "screen-space mower and live trail helpers",
);

replaceExact(
  '      return [member.entry_id, payload?.map?.revision, payload?.current_cycle_render?.revision].join(":");',
  '      return [member.entry_id, payload?.map?.revision, payload?.current_cycle_render?.revision, payload?.trail_revision, liveTrailSignature036(card, member, payload)].join(":");',
  "live trail render signature",
);

replaceExact(
  '    const rootLabels = [];\n    const dockMarkers = [];',
  '    const rootLabels = [];\n    const dockMarkers = [];\n    const rootMowers = [];',
  "root mower layer",
);

replaceExact(
  `      if (card._historyDayOffset === null || card._historyDayOffset === undefined) {
        const current = payload?.current_cycle_render;
        if (current?.scope === "current_cycle") {
          local.push(renderArchive036({ mowed_area: current.mowed_area, travel: { path_d: "" }, route: { path_d: "" } }, trailColor, trailOpacity, "nm-multi-current-cycle"));
        }
      } else {`,
  `      if (card._historyDayOffset === null || card._historyDayOffset === undefined) {
        const current = payload?.current_cycle_render;
        if (current?.scope === "current_cycle") {
          local.push(renderArchive036({ mowed_area: current.mowed_area, travel: { path_d: "" }, route: { path_d: "" } }, trailColor, trailOpacity, "nm-multi-current-cycle"));
        }
        const liveTrailWidth = memberTrailWidthMeters036(member);
        for (const segment of liveTrailSegments036(card, member, payload)) {
          const points = rawPoints036(segment);
          if (points) local.push("<polyline class=\\"nm-multi-live-trail\\" points=\\"" + points + "\\" fill=\\"none\\" stroke=\\"" + esc(trailColor) + "\\" stroke-width=\\"" + liveTrailWidth.toFixed(3) + "\\" stroke-opacity=\\"" + trailOpacity.toFixed(2) + "\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"/>");
        }
      } else {`,
  "active live trail rendering",
);

replaceExact(
  `      const mower = mowerMarkup036(card, member, matrix);
      local.push(mower.local);
      if (mower.label) rootLabels.push(mower.label);`,
  `      const mower = mowerMarkup036(card, member, matrix);
      if (mower) rootMowers.push(mower);`,
  "remove floating mower names",
);

replaceExact(
  `    parts.push(dockMarkers.join(""));
    parts.push(rootLabels.join(""));`,
  `    parts.push(rootLabels.join(""));
    parts.push(dockMarkers.join(""));
    parts.push(rootMowers.join(""));`,
  "mower z-order above dock",
);

replaceSection(
  "  function syncMultiButton036(card) {",
  "  const hideCoreLayer036 =",
  `  function syncMultiButton036(card) {
    const button = card._multi036Button || card.querySelector?.(".nm-multi-button");
    if (!button) return;
    button.hidden = true;
    button.remove?.();
    card._multi036Button = button;
  }

`,
  "remove header Single/Multi toggle",
);

replaceExact(
  `    if (card._multi036ModeApplied === active) {
      if (active) renderMulti036(card);
      return;
    }`,
  `    if (card._multi036ModeApplied === active) {
      if (active) {
        hideCoreLayer036(card._scheduleButtonEl, true);
        renderMulti036(card);
      }
      return;
    }`,
  "persistent multi-mode header visibility",
);

replaceExact(
  '        const index = node.findIndex((item) => item?.name === "show_session_legend" || item?.name === "show_map_legend");',
  '        const index = node.findIndex((item) => item?.name === "entity");',
  "Multi mower editor placement",
);

replaceSection(
  "  async function openMemberSchedule036(card, member) {",
  "  function openMemberMow036",
  `  const memberSchedulerIds036 = (card, member) => {
    const frontend = member?.frontend || {};
    const entities = frontend?.entities || {};
    return {
      status: entities.schedule_status || null,
      managedSwitch: entities.managed_schedule || null,
      nativeSwitch: entities.native_schedule || null,
      start: entities.schedule_start || null,
      end: entities.schedule_end || null,
      deviceId: frontend.device_id || null,
      configEntryId: member?.entry_id || null,
      source: "multi_site_frontend",
      authoritative: true,
    };
  };

  const primeMemberScheduler036 = (card, member) => {
    const ids = memberSchedulerIds036(card, member);
    card._beta2SchedulerIds = ids;
    card._beta10SchedulerEntities = ids;
    card._beta6SchedulerEntities = ids;
    card._beta5SchedulerEntities = ids;
    card._beta10ScheduleDeviceId = ids.deviceId || null;
    return ids;
  };

  async function openMemberSchedule036(card, member) {
    if (!member) return;
    setDialogMember036(card, member);
    clearDialogFlags036(card);
    primeMemberScheduler036(card, member);
    try { await card._openScheduleDialog?.(); } catch (error) { console.error("[Navimower Map Card] Multi-mower schedule open failed", error); }
  }

`,
  "member-scoped scheduler metadata",
);

replaceSection(
  "  const hassDescriptor036 = Object.getOwnPropertyDescriptor(proto, \"hass\");",
  "  console.info(\"[Navimower Map Card] 0.3.6-beta1 opt-in multi-mower site view enabled\");",
  `  const hassDescriptor036 = Object.getOwnPropertyDescriptor(proto, "hass");
  if (hassDescriptor036?.set) {
    Object.defineProperty(proto, "hass", {
      configurable: true,
      get: hassDescriptor036.get,
      set(value) {
        hassDescriptor036.set.call(this, value);
        ensureMultiUi036(this);
        ensurePreference036(this);
        syncMultiButton036(this);
        void loadSite036(this, false);
        if (multiActive036(this)) {
          const active = (this._multi036Site?.members || []).some((member) => memberIsActive036(this, member));
          const interval = active ? MAP_REFRESH_ACTIVE_MS : MAP_REFRESH_IDLE_MS;
          if (!this._multi036LastMemberRefresh || Date.now() - this._multi036LastMemberRefresh >= interval) {
            this._multi036LastMemberRefresh = Date.now();
            void refreshMembers036(this, false);
          }
          renderMulti036(this);
          hideCoreLayer036(this._scheduleButtonEl, true);
          if (this._notificationDialogOpen) renderMultiNotifications036(this);
        }
      }
    });
  }

`,
  "multi notification refresh and schedule visibility",
);

replaceExact(
  '  console.info("[Navimower Map Card] 0.3.6-beta1 opt-in multi-mower site view enabled");\n})();',
  '  console.info("[Navimower Map Card] 0.3.6-beta1 opt-in multi-mower site view enabled");\n  ' + beta2Marker + '\n  console.info("[Navimower Map Card] 0.3.6-beta2 multi-mower field-test fixes enabled");\n})();',
  "beta2 runtime marker",
);

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta2 multi-mower field-test fixes");
