import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const source = new URL("../src/navimower-map-card.js", import.meta.url);
const upgrade = new URL("../scripts/upgrade-editor-color-labels-native.mjs", import.meta.url);
const tempDir = await mkdtemp(join(tmpdir(), "navimower-editor-native-labels-"));
const tempSource = join(tempDir, "navimower-map-card.js");

try {
  await copyFile(source, tempSource);
  execFileSync(process.execPath, [upgrade.pathname], {
    cwd: new URL(".", root),
    env: { ...process.env, NAVIMOWER_MAP_CARD_SOURCE: tempSource },
    stdio: "pipe",
  });

  const patched = await readFile(tempSource, "utf8");
  assert.equal((patched.match(/0\.3\.5-beta8: native-only color labels in the visual editor\./g) || []).length, 1);
  assert.match(patched, /const \{ prefix: _prefix, \.\.\.rest \} = text/);
  assert.match(patched, /custom_area_color: "Custom area color"/);
  assert.match(patched, /trail_color: "Trail color"/);
  assert.match(patched, /channel_color: "Channel color"/);
  assert.match(patched, /gate_area_color: "Gate area color"/);
  assert.match(patched, /if \(COLOR_FIELDS\.has\(schema\?\.name\)\) return LABELS\[schema\.name\]/);

  console.log("Native-only visual editor color label regression checks passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
