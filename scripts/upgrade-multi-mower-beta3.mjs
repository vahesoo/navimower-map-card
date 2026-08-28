import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
const beta2Marker = "// 0.3.6-beta2: multi-mower field-test fixes.";
const beta3Marker = "// 0.3.6-beta3: compact multi-mower metadata and labels.";

let source = await readFile(sourcePath, "utf8");
if (source.includes(beta3Marker)) {
  console.log("0.3.6-beta3 multi-mower UI fixes already applied");
  process.exit(0);
}
if (!source.includes(beta2Marker)) {
  throw new Error("Expected 0.3.6-beta2 multi-mower runtime was not found");
}

function replaceExact(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing beta3 replacement target: ${label}`);
  source = source.replace(before, after);
}

function replaceSection(start, end, replacement, label) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Missing beta3 section start: ${label}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`Missing beta3 section end: ${label}`);
  source = source.slice(0, from) + replacement + source.slice(to);
}

// A single legend-size setting is shared by Single and Multi views.
replaceExact(
  "  map_legend_opacity: 0.58,\n  zone_label_font_size: 20,",
  "  map_legend_opacity: 0.58,\n  map_legend_scale: 1,\n  zone_label_font_size: 20,",
  "legend scale default",
);
replaceExact(
  '  map_legend_opacity: "Map legend background opacity",\n  zone_label_font_size: "Zone label font size",',
  '  map_legend_opacity: "Map legend background opacity",\n  map_legend_scale: "Map legend size",\n  zone_label_font_size: "Zone label font size",',
  "legend scale label",
);
replaceExact(
  "      map_legend_opacity: DEFAULTS.map_legend_opacity,\n      zone_label_font_size: DEFAULTS.zone_label_font_size,",
  "      map_legend_opacity: DEFAULTS.map_legend_opacity,\n      map_legend_scale: DEFAULTS.map_legend_scale,\n      zone_label_font_size: DEFAULTS.zone_label_font_size,",
  "legend scale stub config",
);
replaceExact(
  '                { name: "map_legend_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },\n                { name: "zone_label_font_size", selector: { number: { min: 12, max: 36, step: 1, mode: "box" } } },',
  '                { name: "map_legend_opacity", selector: { number: { min: 0, max: 1, step: 0.05, mode: "slider" } } },\n                { name: "map_legend_scale", selector: { number: { min: 0.5, max: 2, step: 0.1, mode: "slider" } } },\n                { name: "zone_label_font_size", selector: { number: { min: 12, max: 36, step: 1, mode: "box" } } },',
  "legend scale visual editor field",
);
replaceExact(
  "      c.map_legend_opacity,\n      c.zone_label_font_size,",
  "      c.map_legend_opacity,\n      c.map_legend_scale,\n      c.zone_label_font_size,",
  "legend scale static cache key",
);
replaceExact(
  '    if (c.show_map_legend) {\n      const legendRows = 2 + (c.show_vf_off_areas !== false ? 1 : 0) + (channels.length > 0 ? 1 : 0) + (gateAreas.length > 0 ? 1 : 0);\n      labelObstacles.push({ left: 8, right: 180, top: 8, bottom: 32 + legendRows * 30 });\n    }',
  '    if (c.show_map_legend) {\n      const legendRows = 2 + (c.show_vf_off_areas !== false ? 1 : 0) + (channels.length > 0 ? 1 : 0) + (gateAreas.length > 0 ? 1 : 0);\n      const legendScale = clamp(finiteNumber(c.map_legend_scale, 1), 0.5, 2);\n      labelObstacles.push({ left: 8, right: 8 + 172 * legendScale, top: 8, bottom: 8 + (32 + legendRows * 30) * legendScale });\n    }',
  "single-view scaled legend label obstacle",
);

replaceSection(
  "  _legend(hasChannels, hasTunnels) {",
  "  _onSvgClick(event) {",
  [
    "  _legend(hasChannels, hasTunnels) {",
    "    const rows = [",
    '      [this._config.trail_color, "Mowed"],',
    '      [this._config.off_limit_color, "Off-limit"]',
    "    ];",
    '    if (this._config.show_vf_off_areas !== false) rows.push([this._config.vf_off_color, "VF-off"]);',
    '    if (hasTunnels) rows.push([this._config.channel_color, "Channel"]);',
    '    if (hasChannels) rows.push([this._config.gate_area_color, "Gate area"]);',
    "    const fontSize = 19;",
    "    const rowHeight = 30;",
    "    const height = rows.length * rowHeight + 18;",
    "    const opacity = clamp(finiteNumber(this._config.map_legend_opacity, 0.58), 0, 1);",
    "    const legendScale = clamp(finiteNumber(this._config.map_legend_scale, 1), 0.5, 2);",
    '    let result = "<g transform=\\"scale(" + legendScale.toFixed(2) + ")\\"><rect x=\\"14\\" y=\\"14\\" width=\\"158\\" height=\\"" + height + "\\" rx=\\"10\\" fill=\\"var(--card-background-color, #fff)\\" fill-opacity=\\"" + opacity.toFixed(2) + "\\" stroke=\\"#9e9e9e\\" stroke-opacity=\\".25\\"/>";',
    "    rows.forEach(([color, name], index) => {",
    "      const y = 40 + index * rowHeight;",
    '      result += "<rect x=\\"27\\" y=\\"" + (y - 14) + "\\" width=\\"19\\" height=\\"19\\" rx=\\"3\\" fill=\\"" + escapeHtml(color) + "\\"/><text x=\\"57\\" y=\\"" + (y + 1) + "\\" font-family=\\"sans-serif\\" font-size=\\"" + fontSize + "\\" font-weight=\\"600\\" fill=\\"var(--primary-text-color, #263238)\\">" + escapeHtml(name) + "</text>";',
    "    });",
    '    return result + "</g>";',
    "  }",
    "",
  ].join("\n"),
  "single-view scalable legend renderer",
);

// Multi labels now use the exact Single-view pill/leader machinery in common site space.
replaceSection(
  "  const zoneLabel036 = (card, member, matrix, zone, coverageMap) => {",
  "  function renderMultiMap036(card, force = false) {",
  [
    "  const zoneLabelItem036 = (card, member, matrix, zone, coverageMap, payload) => {",
    "    const polygon = Array.isArray(zone?.polygon) ? zone.polygon : [];",
    "    const valid = polygon.filter((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));",
    "    if (valid.length < 3 || !matrix) return null;",
    "    const screenPolygon = valid.map((point) => transformPoint036(matrix, Number(point[0]), Number(point[1])));",
    "    const anchorX = screenPolygon.reduce((sum, point) => sum + Number(point[0]), 0) / screenPolygon.length;",
    "    const anchorY = screenPolygon.reduce((sum, point) => sum + Number(point[1]), 0) / screenPolygon.length;",
    "    const zoneId = Number(zone?.id);",
    "    const state = (payload?.zone_states || []).find((item) => Number(item?.id ?? item?.zone_id) === zoneId) || {};",
    "    const rawDetails = payload?.zone_details || payload?.zone_history || [];",
    "    const detail = Array.isArray(rawDetails)",
    "      ? rawDetails.find((item) => Number(item?.id ?? item?.zone_id) === zoneId) || {}",
    "      : rawDetails && typeof rawDetails === \"object\" ? rawDetails[String(zoneId)] || {} : {};",
    "    const coverage = coverageMap.get(zoneId) || {};",
    "    const pct = finite036(state?.coverage_pct ?? state?.progress ?? detail?.progress ?? detail?.percentage ?? coverage?.pct ?? coverage?.percentage, null);",
    '    const name = String(state?.name || zone?.name || coverage?.name || detail?.name || "Zone " + zone?.id);',
    '    const value = pct === null ? name : name + " · " + Math.round(pct) + "%";',
    "    const area = typeof card?._polygonArea === \"function\" ? Math.abs(card._polygonArea(screenPolygon)) : 0;",
    "    return { anchorX, anchorY, value, polygon: screenPolygon, area, memberEntryId: member?.entry_id, zoneId };",
    "  };",
    "",
    "  const renderMultiZoneLabels036 = (card, items, legendVisible) => {",
    "    const sourceItems = (Array.isArray(items) ? items : []).filter(Boolean);",
    "    if (!sourceItems.length || typeof card?._pill !== \"function\") return \"\";",
    "    const obstacles = [];",
    "    if (legendVisible) {",
    "      const legendScale = clamp036(card?._config?.map_legend_scale, 0.5, 2);",
    "      obstacles.push({ left: 8, right: 22 + 158 * legendScale, top: 8, bottom: 22 + 112 * legendScale });",
    "    }",
    "    let arranged = sourceItems;",
    "    if (card?._config?.avoid_zone_label_overlap === false || typeof card?._layoutZoneLabels !== \"function\") {",
    "      arranged = sourceItems.map((item) => ({ ...item, cx: item.anchorX, cy: item.anchorY, ...(card._pillMetrics?.(item.value) || {}), moved: false }));",
    "    } else {",
    "      arranged = card._layoutZoneLabels(sourceItems, obstacles);",
    "    }",
    "    const output = [];",
    "    for (const item of arranged) {",
    "      const leader = typeof card?._zoneLabelLeader === \"function\" ? card._zoneLabelLeader(item) : \"\";",
    "      if (leader) output.push(leader);",
    "      output.push(card._pill(item.cx, item.cy, item.value, null));",
    "    }",
    "    return output.join(\"\");",
    "  };",
    "",
  ].join("\n"),
  "single-style multi zone labels",
);

replaceExact(
  "card?._config?.show_zone_labels, card?._config?.show_channels",
  "card?._config?.show_zone_labels, card?._config?.avoid_zone_label_overlap, card?._config?.zone_label_font_size, card?._config?.zone_label_opacity, card?._config?.map_legend_scale, card?._config?.show_channels",
  "multi label/legend render signature",
);
replaceExact(
  "    const trailOpacity = clamp036(c.trail_opacity, 0, 1);\n    const parts =",
  "    const trailOpacity = clamp036(c.trail_opacity, 0, 1);\n    const legendScale = clamp036(c.map_legend_scale, 0.5, 2);\n    const parts =",
  "multi legend scale runtime value",
);
replaceExact(
  "    const rootLabels = [];\n    const dockMarkers = [];",
  "    const zoneLabelItems = [];\n    const dockMarkers = [];",
  "multi zone label collection",
);
replaceExact(
  "        if (c.show_zone_labels !== false) rootLabels.push(zoneLabel036(card, member, matrix, zone, coverageMap));",
  "        if (c.show_zone_labels !== false) zoneLabelItems.push(zoneLabelItem036(card, member, matrix, zone, coverageMap, payload));",
  "collect multi zone label items",
);
replaceExact(
  '    parts.push(rootLabels.join(""));\n    parts.push(dockMarkers.join(""));',
  '    if (c.show_zone_labels !== false) parts.push(renderMultiZoneLabels036(card, zoneLabelItems, c.show_map_legend !== false));\n    parts.push(dockMarkers.join(""));',
  "render arranged multi zone pills",
);
replaceExact(
  '<g class=\\"nm-multi-map-legend\\" transform=\\"translate(14 14)\\">',
  '<g class=\\"nm-multi-map-legend\\" transform=\\"translate(14 14) scale(" + legendScale.toFixed(2) + ")\\">',
  "multi legend scale transform",
);

// Move status/zone/battery into each mower control card and honor existing display toggles.
replaceSection(
  "  function renderMultiControls036(card) {",
  "  async function runMemberCommand036(card, member, command) {",
  [
    "  const cleanMemberText036 = (value) => {",
    "    if (value === undefined || value === null) return null;",
    "    const text = String(value).trim();",
    "    return !text || [\"unknown\", \"unavailable\", \"none\"].includes(text.toLowerCase()) ? null : text;",
    "  };",
    "",
    "  const memberMeta036 = (card, member, mower) => {",
    "    const c = card?._config || {};",
    "    const entities = memberEntities036(member);",
    "    const items = [];",
    "    const status = cleanMemberText036(mower?.state);",
    "    if (c.show_status !== false && status) items.push('<span class=\"nm-multi-meta-status\">' + esc(status) + '</span>');",
    "    items.push('<span class=\"nm-multi-meta-spacer\"></span>');",
    "    const zone = cleanMemberText036(state036(card, entities.current_physical_zone)?.state);",
    "    if (c.show_zone !== false && zone) items.push('<span class=\"nm-multi-meta-item nm-multi-meta-zone\"><ha-icon icon=\"mdi:map-marker-radius\"></ha-icon><span>' + esc(zone) + '</span></span>');",
    "    const batteryState = state036(card, entities.battery);",
    "    const battery = finite036(batteryState?.state, null);",
    "    if (c.show_battery !== false && battery !== null) items.push('<span class=\"nm-multi-meta-item nm-multi-meta-battery\"><ha-icon icon=\"mdi:battery\"></ha-icon><span>' + Math.round(battery) + '%</span></span>');",
    "    if (c.show_position === true) {",
    "      const x = entityValue036(card, entities.position_x);",
    "      const y = entityValue036(card, entities.position_y);",
    "      if (x !== null && y !== null) items.push('<span class=\"nm-multi-meta-item nm-multi-meta-position\"><ha-icon icon=\"mdi:crosshairs-gps\"></ha-icon><span>' + x.toFixed(1) + ', ' + y.toFixed(1) + '</span></span>');",
    "    }",
    "    const meaningful = items.some((item) => !item.includes(\"nm-multi-meta-spacer\"));",
    '    return meaningful ? "<div class=\\"nm-multi-member-meta\\">" + items.join("") + "</div>" : "";',
    "  };",
    "",
    "  function renderMultiControls036(card) {",
    "    ensureMultiUi036(card);",
    "    const host = card._multi036Controls;",
    "    if (!host) return;",
    "    if (!multiActive036(card)) {",
    "      host.hidden = true;",
    "      return;",
    "    }",
    "    host.hidden = false;",
    "    const members = card._multi036Site?.members || [];",
    '    host.style.setProperty("--nm-multi-columns", String(Math.max(1, members.length)));',
    "    host.innerHTML = members.map((member) => {",
    "      const entities = memberEntities036(member);",
    "      const mower = state036(card, entities.mower);",
    '      const unavailable = !mower || ["unknown", "unavailable"].includes(String(mower.state || "").toLowerCase());',
    '      const managedOn = String(state036(card, entities.managed_schedule)?.state || "").toLowerCase() === "on";',
    '      const nativeOn = String(state036(card, entities.native_schedule)?.state || "").toLowerCase() === "on";',
    "      const scheduleOn = managedOn || nativeOn;",
    '      const canResume = typeof shouldOfferResume === "function" ? shouldOfferResume(card._hass, mower) : ["paused", "returning"].includes(String(mower?.state || "").toLowerCase());',
    "      const status = memberState036(card, member.entry_id).command;",
    "      const meta = memberMeta036(card, member, mower);",
    '      return "<section class=\\"nm-multi-control-member\\" data-entry-id=\\"" + esc(member.entry_id) + "\\"><button type=\\"button\\" class=\\"nm-multi-schedule" + (scheduleOn ? " active" : "") + "\\" data-multi-schedule=\\"" + esc(member.entry_id) + "\\" title=\\"Open " + esc(displayName036(member)) + " schedule\\"><span>" + esc(displayName036(member)) + "</span><ha-icon icon=\\"mdi:calendar-clock\\"></ha-icon></button>" + meta + "<div class=\\"nm-multi-command-grid\\"><button type=\\"button\\" data-multi-command=\\"mow\\" data-entry-id=\\"" + esc(member.entry_id) + "\\"" + (unavailable ? " disabled" : "") + "><ha-icon icon=\\"mdi:play\\"></ha-icon><span>Mow</span></button>" + (canResume ? "<button type=\\"button\\" data-multi-command=\\"resume\\" data-entry-id=\\"" + esc(member.entry_id) + "\\"><ha-icon icon=\\"mdi:play-circle-outline\\"></ha-icon><span>Resume</span></button>" : "") + "<button type=\\"button\\" data-multi-command=\\"pause\\" data-entry-id=\\"" + esc(member.entry_id) + "\\"" + (unavailable ? " disabled" : "") + "><ha-icon icon=\\"mdi:pause\\"></ha-icon><span>Pause</span></button><button type=\\"button\\" data-multi-command=\\"dock\\" data-entry-id=\\"" + esc(member.entry_id) + "\\"" + (unavailable ? " disabled" : "") + "><ha-icon icon=\\"mdi:home-map-marker\\"></ha-icon><span>Home</span></button></div>" + (status ? "<div class=\\"nm-multi-command-status " + esc(status.kind || "") + "\\">" + esc(status.text || "") + "</div>" : "") + "</section>";',
    "    }).join(\"\");",
    "  }",
    "",
  ].join("\n"),
  "compact member status zone battery metadata",
);

replaceExact(
  '.nm-multi-member-meta{display:flex;justify-content:space-between;gap:8px;padding:2px 8px 7px;color:var(--secondary-text-color);font-size:.76rem;text-transform:capitalize}',
  '.nm-multi-member-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px 10px;padding:2px 8px 7px;color:var(--secondary-text-color);font-size:.76rem}.nm-multi-meta-status{text-transform:capitalize}.nm-multi-meta-spacer{flex:1 1 auto}.nm-multi-meta-item{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.nm-multi-meta-item ha-icon{--mdc-icon-size:15px}',
  "compact multi member metadata styles",
);

// The Single footer must never reappear underneath a Multi map after a HA state update.
replaceExact(
  "        hideCoreLayer036(card._scheduleButtonEl, true);\n        renderMulti036(card);",
  "        hideCoreLayer036(card._scheduleButtonEl, true);\n        hideCoreLayer036(card._footerEl, true);\n        renderMulti036(card);",
  "persistent multi footer visibility",
);
replaceExact(
  "  const originalRenderControls036 = proto._renderControls;",
  [
    "  const originalRenderFooter036 = proto._renderFooter;",
    '  if (typeof originalRenderFooter036 === "function") {',
    "    proto._renderFooter = function multi036RenderFooter(...args) {",
    "      if (multiActive036(this)) {",
    "        if (this._footerEl) {",
    '          this._footerEl.innerHTML = "";',
    '          this._footerEl.style.display = "none";',
    "        }",
    "        return;",
    "      }",
    "      return originalRenderFooter036.apply(this, args);",
    "    };",
    "  }",
    "",
    "  const originalRenderControls036 = proto._renderControls;",
  ].join("\n"),
  "multi footer render guard",
);

replaceExact(
  '  // 0.3.6-beta2: multi-mower field-test fixes.\n  console.info("[Navimower Map Card] 0.3.6-beta2 multi-mower field-test fixes enabled");\n})();',
  '  // 0.3.6-beta2: multi-mower field-test fixes.\n  console.info("[Navimower Map Card] 0.3.6-beta2 multi-mower field-test fixes enabled");\n  ' + beta3Marker + '\n  console.info("[Navimower Map Card] 0.3.6-beta3 compact multi-mower metadata and labels enabled");\n})();',
  "beta3 runtime marker",
);

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta3 multi-mower UI fixes");
