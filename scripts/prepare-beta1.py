from pathlib import Path
import json

root = Path.cwd()
source_path = root / "src/navimower-map-card.js"
source = source_path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    source = source.replace(old, new, 1)


replace_once(" * Version 0.2.1", " * Version 0.2.2-beta1", "source header version")
replace_once(
    'const NAVIMOWER_MAP_CARD_VERSION = "0.2.1";',
    'const NAVIMOWER_MAP_CARD_VERSION = "0.2.2-beta1";',
    "runtime version",
)
replace_once(
    '  mower_scale: "Mower marker scale",',
    '  mower_scale: "Mower icon size",',
    "mower scale label",
)
replace_once(
    '    const colorField = (name) => ({ name, selector: { text: {} } });',
    '    const colorField = (name, allowBlank = false) => ({\n'
    '      name, selector: { text: allowBlank ? {} : { type: "color" } },\n'
    '    });',
    "native color selector",
)
replace_once(
    '                { name: "mower_scale", selector: { number: { min: 0.5, max: 2.5, step: 0.1, mode: "box" } } },',
    '                { name: "mower_scale", selector: { number: { min: 0.5, max: 2.5, step: 0.1, mode: "slider" } } },',
    "mower size slider",
)
replace_once(
    '                colorField("map_background_color"),',
    '                colorField("map_background_color", true),',
    "blank map background",
)
replace_once(
    '    this._scheduleSwitchBusy = false;\n    this._commandBusy = false;',
    '    this._scheduleSwitchBusy = false;\n'
    '    this._scheduleBatchSaving = false;\n'
    '    this._commandBusy = false;',
    "batch state",
)

replace_once(
    '        .nm-schedule-day-body[hidden], .nm-schedule-day-actions[hidden] { display: none; }',
    '        .nm-schedule-day-body[hidden] { display: none; }\n'
    '        .nm-schedule-day.dirty { background: color-mix(in srgb, var(--primary-color) 5%, transparent); }',
    "schedule hidden style",
)
replace_once(
    '        .nm-schedule-day-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 10px 0 0 48px; }\n'
    '        .nm-schedule-day-actions button { min-height: 36px; padding: 7px 13px; border: 0; border-radius: 9px;\n'
    '          cursor: pointer; font: inherit; font-weight: 600; }\n'
    '        .nm-schedule-save { color: var(--text-primary-color, #fff); background: var(--primary-color); }\n'
    '        .nm-schedule-save:disabled { opacity: .5; cursor: default; }\n'
    '        .nm-schedule-discard { color: var(--primary-text-color); background: var(--secondary-background-color); }',
    '        .nm-schedule-global-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 8px;\n'
    '          padding: 12px 14px; border-top: 1px solid var(--divider-color);\n'
    '          background: var(--card-background-color, var(--ha-card-background, #fff)); }\n'
    '        .nm-schedule-global-summary { flex: 1; min-width: 0; color: var(--secondary-text-color);\n'
    '          font-size: .84rem; font-weight: 600; }\n'
    '        .nm-schedule-global-actions button { min-height: 42px; padding: 8px 14px; border: 0;\n'
    '          border-radius: 10px; cursor: pointer; font: inherit; font-weight: 650; }\n'
    '        .nm-schedule-global-actions button:disabled { opacity: .5; cursor: default; }\n'
    '        .nm-schedule-discard-all { color: var(--primary-text-color); background: var(--secondary-background-color); }\n'
    '        .nm-schedule-save-all { color: var(--text-primary-color, #fff); background: var(--primary-color); }',
    "global schedule action styles",
)
replace_once(
    '          .nm-schedule-periods, .nm-schedule-day-actions { margin-left: 0; }\n'
    '          .nm-schedule-times { grid-template-columns: 1fr auto 1fr auto; gap: 5px; }',
    '          .nm-schedule-periods { margin-left: 0; }\n'
    '          .nm-schedule-times { grid-template-columns: 1fr auto 1fr auto; gap: 5px; }\n'
    '          .nm-schedule-global-actions { flex-wrap: wrap; padding: 10px; }\n'
    '          .nm-schedule-global-summary { flex-basis: 100%; }\n'
    '          .nm-schedule-global-actions button { flex: 1 1 0; min-height: 46px; }',
    "mobile schedule footer",
)

replace_once(
    '    const rows = this._scheduleDraft.map((day, index) => this._renderScheduleDay(day, index)).join("");\n'
    '    const switchEntity = this._scheduleSwitchEntity();',
    '    const rows = this._scheduleDraft.map((day, index) => this._renderScheduleDay(day, index)).join("");\n'
    '    const dirtyCount = this._dirtyScheduleDayIndexes().length;\n'
    '    const scheduleSaving = this._scheduleBatchSaving || this._scheduleDraft.some((day) => day._saving);\n'
    '    const switchEntity = this._scheduleSwitchEntity();',
    "dirty schedule count",
)
replace_once(
    '      </div>` : "";\n    this._modalHostEl.innerHTML = `',
    '      </div>` : "";\n'
    '    const actions = dirtyCount || scheduleSaving ? `\n'
    '      <div class="nm-schedule-global-actions">\n'
    '        <div class="nm-schedule-global-summary">${escapeHtml(scheduleSaving\n'
    '          ? "Saving schedule…"\n'
    '          : `${dirtyCount} unsaved ${dirtyCount === 1 ? "day" : "days"}`)}</div>\n'
    '        <button type="button" class="nm-schedule-discard-all" data-schedule-action="discard-all" ${scheduleSaving ? "disabled" : ""}>Discard changes</button>\n'
    '        <button type="button" class="nm-schedule-save-all" data-schedule-action="save-all" ${dirtyCount && !scheduleSaving ? "" : "disabled"}>${escapeHtml(scheduleSaving ? "Saving…" : `Save ${dirtyCount} ${dirtyCount === 1 ? "day" : "days"}`)}</button>\n'
    '      </div>` : "";\n'
    '    this._modalHostEl.innerHTML = `',
    "global schedule footer markup",
)
replace_once(
    '          <div class="nm-schedule-body">${master}${rows}</div>\n        </div>',
    '          <div class="nm-schedule-body">${master}${rows}</div>\n'
    '          ${actions}\n'
    '        </div>',
    "schedule footer placement",
)
replace_once(
    '    const statusText = status?.text || "";',
    '    const statusText = status?.text || (day._dirty ? "Unsaved" : "");',
    "unsaved day status",
)
replace_once(
    '    const canSave = day._dirty && !day._saving;\n'
    '    return `\n'
    '      <div class="nm-schedule-day ${day.enabled ? "on" : "off"} ${day._expanded ? "expanded" : ""}" data-schedule-day="${index}">',
    '    return `\n'
    '      <div class="nm-schedule-day ${day.enabled ? "on" : "off"} ${day._expanded ? "expanded" : ""} ${day._dirty ? "dirty" : ""}" data-schedule-day="${index}">',
    "dirty day class",
)
replace_once(
    '        <div class="nm-schedule-day-actions" ${day._dirty ? "" : "hidden"}>\n'
    '          <button type="button" class="nm-schedule-discard" data-schedule-action="discard-day" data-day-index="${index}" ${canSave ? "" : "hidden"}>Discard</button>\n'
    '          <button type="button" class="nm-schedule-save" data-schedule-action="save-day" data-day-index="${index}" ${canSave ? "" : "disabled"}>Save</button>\n'
    '        </div>\n',
    '',
    "remove per-day actions",
)
replace_once(
    '    this._modalHostEl.querySelectorAll("[data-schedule-action=\'toggle-day\']").forEach((element) => {',
    '    this._modalHostEl.querySelector("[data-schedule-action=\'discard-all\']")\n'
    '      ?.addEventListener("click", () => this._discardAllScheduleChanges());\n'
    '    this._modalHostEl.querySelector("[data-schedule-action=\'save-all\']")\n'
    '      ?.addEventListener("click", () => this._saveAllScheduleChanges());\n'
    '    this._modalHostEl.querySelectorAll("[data-schedule-action=\'toggle-day\']").forEach((element) => {',
    "global schedule events",
)
replace_once(
    '  _discardScheduleDay(dayIndex) {',
    '''  _dirtyScheduleDayIndexes() {
    return (this._scheduleDraft || [])
      .map((day, index) => day?._dirty ? index : null)
      .filter((index) => index !== null);
  }

  _discardAllScheduleChanges() {
    if (this._scheduleBatchSaving || !this._scheduleDraft) return;
    for (const dayIndex of this._dirtyScheduleDayIndexes()) {
      const expanded = this._scheduleDraft[dayIndex]._expanded;
      const key = this._scheduleDraft[dayIndex].key;
      this._scheduleDraft[dayIndex] = this._buildScheduleDay(this._scheduleServerDays, dayIndex);
      this._scheduleDraft[dayIndex]._expanded = expanded;
      this._clearScheduleStatus(key);
    }
    this._renderDialog();
  }

  async _saveAllScheduleChanges() {
    if (this._scheduleBatchSaving) return;
    const dirtyIndexes = this._dirtyScheduleDayIndexes();
    if (!dirtyIndexes.length) return;
    this._scheduleBatchSaving = true;
    this._renderDialog();
    for (const dayIndex of dirtyIndexes) {
      await this._saveScheduleDay(dayIndex);
      if (this._scheduleDraft?.[dayIndex]?._dirty) break;
    }
    this._scheduleBatchSaving = false;
    this._renderDialog();
  }

  _discardScheduleDay(dayIndex) {''',
    "global schedule methods",
)

replace_once(
    '    const renderKey = `${x}|${y}|${heading}|${this._config.mower_scale}|${this._layout.scale}`;',
    '    const renderKey = `${x}|${y}|${heading}|${this._config.mower_scale}|${this._layout.scale}|${this._view.scale}`;',
    "mower zoom render key",
)
old_scale = '    const scale = .37 * clamp(finiteNumber(this._config.mower_scale, 1), .5, 2.5);'
new_scale = (
    '    const zoom = Math.max(1, finiteNumber(this._view?.scale, 1));\n'
    '    const scale = .37 * clamp(finiteNumber(this._config.mower_scale, 1), .5, 2.5) / zoom;'
)
count = source.count(old_scale)
if count != 2:
    raise SystemExit(f"inverse zoom mower scale: expected two matches, found {count}")
source = source.replace(old_scale, new_scale)
replace_once(
    '    this._svgEl.setAttribute("viewBox", `${left.toFixed(2)} ${top.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`);\n'
    '    this._syncTouchAction();',
    '    this._svgEl.setAttribute("viewBox", `${left.toFixed(2)} ${top.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`);\n'
    '    this._mowerRenderKey = null;\n'
    '    this._renderMower();\n'
    '    this._syncTouchAction();',
    "rerender fixed mower after zoom",
)

source_path.write_text(source)

package_path = root / "package.json"
package = json.loads(package_path.read_text())
package["version"] = "0.2.2-beta1"
package["scripts"]["test"] = (
    "npm run build && npm run check && npm run smoke && node tests/beta1.mjs"
)
package_path.write_text(json.dumps(package, indent=2) + "\n")

lock_path = root / "package-lock.json"
if lock_path.exists():
    lock = json.loads(lock_path.read_text())
    lock["version"] = "0.2.2-beta1"
    if isinstance(lock.get("packages"), dict) and isinstance(lock["packages"].get(""), dict):
        lock["packages"][""]["version"] = "0.2.2-beta1"
    lock_path.write_text(json.dumps(lock, indent=2) + "\n")

test = '''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of ["src/navimower-map-card.js", "dist/navimower-map-card.js"]) {
  const code = readFileSync(path, "utf8");
  assert.match(code, /NAVIMOWER_MAP_CARD_VERSION = "0\\.2\\.2-beta1"/);
  assert.match(code, /type: "color"/);
  assert.match(code, /const zoom = Math\\.max\\(1, finiteNumber\\(this\\._view\\?\\.scale, 1\\)\\)/);
  assert.match(code, /data-schedule-action="save-all"/);
  assert.match(code, /_saveAllScheduleChanges\\(\\)/);
  assert.doesNotMatch(code, /data-schedule-action="save-day"/);
}
console.log("0.2.2-beta1 feature checks passed");
'''
(root / "tests/beta1.mjs").write_text(test)

changelog_path = root / "CHANGELOG.md"
changelog = changelog_path.read_text()
entry = '''# Changelog

## 0.2.2-beta1 - 2026-08-04

- Added a visual **Mower icon size** slider and kept the mower marker at a constant on-screen size while the map is zoomed.
- Replaced hexadecimal text boxes with Home Assistant native color inputs for colors that always have an explicit value; the optional map background remains clearable so it can inherit the Home Assistant theme.
- Reworked the weekly schedule editor for mobile use: edit any number of collapsed or expanded days, then save all changed days from one persistent bottom action bar.
- Added a matching global discard action, unsaved-day indicators, sequential per-day service calls, and protection against closing out the batch state before a failed day is corrected.
- Added beta-specific smoke coverage for fixed marker scaling, color selectors, global schedule saving, and source/distribution version parity.

'''
if not changelog.startswith("# Changelog\n"):
    raise SystemExit("Unexpected changelog header")
changelog_path.write_text(entry + changelog[len("# Changelog\n\n"):])

readme_path = root / "README.md"
readme = readme_path.read_text()
readme = readme.replace(
    "- Integrated weekly **Schedule** editor\n",
    "- Integrated weekly **Schedule** editor with one mobile-friendly global Save action\n"
    "- Configurable fixed-size mower icon that stays readable while the map is zoomed\n"
    "- Home Assistant native color pickers in the visual card editor\n",
    1,
)
readme = readme.replace(
    "- separate Save and Discard actions for each weekday\n",
    "- editing several weekdays before saving\n"
    "- one persistent **Save changed days** action and one global discard action\n",
    1,
)
readme_path.write_text(readme)

notes = '''# Navimower Map Card 0.2.2-beta1

## Fixed-size mower icon

- Configure **Mower icon size** from the visual card editor.
- The marker now compensates for the SVG view-box zoom, so its on-screen size stays constant while the map geometry grows or shrinks.
- Position and heading updates remain live and the existing `mower_scale` YAML option remains compatible.

## Native color controls

- Explicit map colors now use Home Assistant's native browser color input in the visual editor.
- Existing hexadecimal YAML values remain unchanged.
- Map background stays clearable because an empty value intentionally inherits the active Home Assistant theme.

## Mobile schedule workflow

- Change any number of weekdays without saving each expanded day separately.
- A persistent action bar at the bottom shows the unsaved-day count and provides **Save changed days** and **Discard changes**.
- On phones the action buttons expand to full-width touch targets while the weekday list remains independently scrollable.
- The card still calls `navimower.set_schedule` once per changed weekday, sequentially, so the integration service contract is unchanged and an error remains attached to the affected day.

## Testing requested

Please verify mouse-wheel and pinch zoom at several mower icon sizes, color editing in both light and dark themes, and multi-day schedule editing from desktop and mobile.
'''
notes_path = root / ".github/release-notes/0.2.2-beta1.md"
notes_path.parent.mkdir(parents=True, exist_ok=True)
notes_path.write_text(notes)
