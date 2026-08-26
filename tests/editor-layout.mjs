import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const source = new URL("../src/navimower-map-card.js", import.meta.url);
const upgrade = new URL("../scripts/upgrade-editor-layout.mjs", import.meta.url);
const tempDir = await mkdtemp(join(tmpdir(), "navimower-editor-layout-"));
const tempSource = join(tempDir, "navimower-map-card.js");

try {
  await copyFile(source, tempSource);
  execFileSync(process.execPath, [upgrade.pathname], {
    cwd: new URL(".", root),
    env: { ...process.env, NAVIMOWER_MAP_CARD_SOURCE: tempSource },
    stdio: "pipe",
  });

  const patched = await readFile(tempSource, "utf8");
  assert.equal((patched.match(/0\.3\.5-beta6: polished visual editor appearance layout\./g) || []).length, 1);
  assert.match(patched, /title: "Custom areas"/);
  assert.match(patched, /title: "Colors"/);
  assert.match(patched, /column_min_width: "240px"/);
  assert.match(patched, /"custom_area_fill_opacity"[\s\S]*"custom_area_stroke_width"[\s\S]*"custom_area_color"/);
  assert.match(patched, /"map_background_color"[\s\S]*"zone_fill_color"[\s\S]*"zone_stroke_color"[\s\S]*"trail_color"[\s\S]*"off_limit_color"[\s\S]*"vf_off_color"[\s\S]*"channel_color"[\s\S]*"gate_area_color"[\s\S]*"dock_color"/);
  assert.match(patched, /gate_area_color: "Gate area"/);
  assert.match(patched, /custom_area_color: "Color"/);

  console.log("Visual editor layout regression checks passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
