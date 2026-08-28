import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const beta3Marker = "// 0.3.6-beta3: compact multi-mower metadata and labels.";
const beta4Marker = "// 0.3.6-beta4: strict member schedule and clickable multi-zone labels.";

let source = await readFile(sourcePath, "utf8");
if (source.includes(beta4Marker)) {
  console.log("0.3.6-beta4 multi-mower scope fixes already applied");
  process.exit(0);
}
if (!source.includes(beta3Marker)) {
  throw new Error("Expected 0.3.6-beta3 multi-mower runtime was not found");
}

function replaceExact(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing beta4 replacement target: ${label}`);
  source = source.replace(before, after);
}

function replaceSection(start, end, replacement, label) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Missing beta4 section start: ${label}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`Missing beta4 section end: ${label}`);
  source = source.slice(0, from) + replacement + source.slice(to);
}

// Native schedule data must follow the selected member too. Falling back to the
// anchor mower here is unsafe because it can silently show another mower's schedule.
replaceExact(
  "  const originalAvailableZones036 = proto._availableMowZones;",
  [
    "  const originalScheduleEntity036 = proto._scheduleEntity;",
    "  if (typeof originalScheduleEntity036 === \"function\") {",
    "    proto._scheduleEntity = function multi036ScheduleEntity(...args) {",
    "      const member = this._multi036DialogMember;",
    "      if (member) return memberEntities036(member)?.native_schedule_data || null;",
    "      return originalScheduleEntity036.apply(this, args);",
    "    };",
    "  }",
    "",
    "  const originalScheduleSwitchEntity036 = proto._scheduleSwitchEntity;",
    "  if (typeof originalScheduleSwitchEntity036 === \"function\") {",
    "    proto._scheduleSwitchEntity = function multi036ScheduleSwitchEntity(...args) {",
    "      const member = this._multi036DialogMember;",
    "      if (member) return memberEntities036(member)?.native_schedule || null;",
    "      return originalScheduleSwitchEntity036.apply(this, args);",
    "    };",
    "  }",
    "",
    "  const originalAvailableZones036 = proto._availableMowZones;",
  ].join("\n"),
  "member-scoped native schedule entities",
);

replaceExact(
  "      nativeSwitch: entities.native_schedule || null,\n      start: entities.schedule_start || null,",
  "      nativeSwitch: entities.native_schedule || null,\n      nativeData: entities.native_schedule_data || null,\n      start: entities.schedule_start || null,",
  "member scheduler native data metadata",
);

replaceSection(
  "  async function openMemberSchedule036(card, member) {",
  "  function openMemberMow036(card, member) {",
  [
    "  async function openMemberSchedule036(card, member) {",
    "    if (!member) return;",
    "    setDialogMember036(card, member);",
    "    clearDialogFlags036(card);",
    "    const ids = primeMemberScheduler036(card, member);",
    "    const managedStatusPresent = Boolean(ids.status && state036(card, ids.status));",
    "    if (!managedStatusPresent && card._config) {",
    "      const hadMode = Object.prototype.hasOwnProperty.call(card._config, \"schedule_view_mode\");",
    "      const previousMode = card._config.schedule_view_mode;",
    "      card._config.schedule_view_mode = \"native\";",
    "      try {",
    "        await card._openScheduleDialog?.();",
    "      } catch (error) {",
    "        console.error(\"[Navimower Map Card] Multi-mower native schedule open failed\", error);",
    "      } finally {",
    "        if (hadMode) card._config.schedule_view_mode = previousMode;",
    "        else delete card._config.schedule_view_mode;",
    "      }",
    "      return;",
    "    }",
    "    try {",
    "      await card._openScheduleDialog?.();",
    "    } catch (error) {",
    "      console.error(\"[Navimower Map Card] Multi-mower schedule open failed\", error);",
    "    }",
    "  }",
    "",
  ].join("\n"),
  "strict member schedule fallback",
);

// Keep the Single-view pill interaction but namespace zone IDs by mower entry.
replaceExact(
  "      output.push(card._pill(item.cx, item.cy, item.value, null));",
  "      const token = multiZoneToken036(item.memberEntryId, item.zoneId);\n      output.push(card._pill(item.cx, item.cy, item.value, token));",
  "clickable member-scoped zone pills",
);

replaceExact(
  "  function renderMultiMap036(card, force = false) {",
  [
    "  const multiZoneToken036 = (entryId, zoneId) => \"multi:\" + encodeURIComponent(String(entryId || \"\")) + \":\" + encodeURIComponent(String(zoneId ?? \"\"));",
    "",
    "  const parseMultiZoneToken036 = (value) => {",
    "    const text = String(value || \"\");",
    "    if (!text.startsWith(\"multi:\")) return null;",
    "    const separator = text.indexOf(\":\", 6);",
    "    if (separator < 0) return null;",
    "    try {",
    "      return {",
    "        entryId: decodeURIComponent(text.slice(6, separator)),",
    "        zoneId: decodeURIComponent(text.slice(separator + 1)),",
    "      };",
    "    } catch (_error) {",
    "      return null;",
    "    }",
    "  };",
    "",
    "  const firstZoneValue036 = (...values) => values.find((value) => value !== undefined && value !== null && value !== \"\");",
    "",
    "  const memberZoneDetails036 = (card, member, zoneId) => {",
    "    const payload = memberState036(card, member?.entry_id).map || {};",
    "    const map = payload?.map || {};",
    "    const numericZoneId = Number(zoneId);",
    "    const zone = (map?.zones || []).find((item) => Number(item?.id) === numericZoneId) || {};",
    "    const coverage = (payload?.coverage?.zones || []).find((item) => Number(item?.id) === numericZoneId) || {};",
    "    const state = (payload?.zone_states || []).find((item) => Number(item?.id ?? item?.zone_id) === numericZoneId) || {};",
    "    const rawDetails = payload?.zone_details || payload?.zone_history || [];",
    "    const detail = Array.isArray(rawDetails)",
    "      ? rawDetails.find((item) => Number(item?.id ?? item?.zone_id) === numericZoneId) || {}",
    "      : rawDetails && typeof rawDetails === \"object\" ? rawDetails[String(numericZoneId)] || {} : {};",
    "    const history = detail?.history && typeof detail.history === \"object\" ? detail.history : {};",
    "    const progress = finite036(firstZoneValue036(state.coverage_pct, state.progress, detail.progress, detail.percentage, coverage.pct, coverage.percentage), null);",
    "    const lastMowed = firstZoneValue036(state.last_mowed_at, detail.last_mowed_at, detail.last_mowed, detail.last_mow_time, history.last_mowed_at, coverage.last_mowed_at, zone.last_mowed_at);",
    "    const lastCompleted = firstZoneValue036(state.last_completed_at, detail.last_completed_at, detail.last_completed, detail.completed_at, history.last_completed_at, coverage.last_completed_at, zone.last_completed_at);",
    "    const rawHeight = firstZoneValue036(state.cutting_height_mm, detail.cutting_height_mm, detail.cut_height_mm, detail.cutting_height, detail.cut_height, coverage.cutting_height_mm, zone.cutting_height_mm, zone?.boundary?.height_set);",
    "    const heightNumber = finite036(rawHeight, null);",
    "    const cuttingHeight = heightNumber !== null && heightNumber >= 10 && heightNumber <= 100 ? heightNumber : null;",
    "    return {",
    "      name: String(state.name || zone.name || coverage.name || detail.name || \"Zone \" + zoneId),",
    "      progress,",
    "      lastMowed,",
    "      lastCompleted,",
    "      cuttingHeight,",
    "    };",
    "  };",
    "",
    "  const originalOpenZoneInfo036 = proto._openZoneInfo;",
    "  if (typeof originalOpenZoneInfo036 === \"function\") {",
    "    proto._openZoneInfo = function multi036OpenZoneInfo(zoneId) {",
    "      const parsed = parseMultiZoneToken036(zoneId);",
    "      if (!parsed || !multiActive036(this)) return originalOpenZoneInfo036.call(this, zoneId);",
    "      const member = memberById036(this, parsed.entryId);",
    "      if (!member || !this._zoneInfoEl || !this._zoneInfoTitleEl || !this._zoneInfoGridEl) return;",
    "      const details = memberZoneDetails036(this, member, parsed.zoneId);",
    "      const formatStamp = (value) => typeof this._formatZoneTimestamp === \"function\" ? this._formatZoneTimestamp(value) : (date036(value)?.toLocaleString() || \"Not available\");",
    "      const rows = [",
    "        [\"Mower\", displayName036(member)],",
    "        [\"Progress\", details.progress === null ? \"Not available\" : Math.round(details.progress) + \"%\"],",
    "        [\"Last mowed\", formatStamp(details.lastMowed)],",
    "        [\"Last completed\", formatStamp(details.lastCompleted)],",
    "      ];",
    "      if (details.cuttingHeight !== null) rows.push([\"Cutting height\", Math.round(details.cuttingHeight) + \" mm\"]);",
    "      this._selectedZoneId = String(zoneId);",
    "      this._zoneInfoTitleEl.textContent = details.name;",
    "      this._zoneInfoGridEl.innerHTML = rows.map(([label, value]) => \"<span>\" + esc(label) + \"</span><strong>\" + esc(value) + \"</strong>\").join(\"\");",
    "      this._zoneInfoEl.hidden = false;",
    "    };",
    "  }",
    "",
    "  function renderMultiMap036(card, force = false) {",
  ].join("\n"),
  "member-scoped multi zone details",
);

replaceExact(
  "  // 0.3.6-beta3: compact multi-mower metadata and labels.\n",
  "  // 0.3.6-beta3: compact multi-mower metadata and labels.\n  " + beta4Marker + "\n",
  "beta4 runtime marker",
);

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta4 strict multi-mower schedule and zone scope fixes");
