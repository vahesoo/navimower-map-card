import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.scripts.build, /scripts\/build\.mjs/);
assert.match(pkg.scripts.check, /check-runtime-layout\.mjs/);
assert.match(pkg.scripts.test, /single-runtime\.mjs/);
const expectedRuntime = ["navimower-map-card.js"];
for (const root of ["src", "dist"]) {
  const js = readdirSync(root).filter((name) => name.endsWith(".js")).sort();
  assert.deepEqual(js, expectedRuntime, `${root} must contain exactly one runtime JS file`);
}
const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain an exact build copy of src");
assert.ok(source.includes(`var NAVIMOWER_MAP_CARD_VERSION2 = "${pkg.version}";`), "runtime version must match package.json");
assert.match(source, /0\.3\.4-beta5: scheduler overview and configurable settings dialog/);
assert.match(source, /settings_entity_/);
assert.match(source, /length: 12/);
assert.match(source, /navimower_schedule_status/);
assert.match(source, /schedule_view/);
assert.match(source, /set_schedule_queue/);
assert.doesNotMatch(source, /(?:from\s+|import\s*)["']\.\/navimower-map-card-/);
assert.match(source, /i_dark:\s*\{\s*width:\s*85,\s*height:\s*120,[^\n]*data:image\/png;base64,/);
assert.doesNotMatch(source, /i_dark:[^\n]*data:image\/webp;base64/);
for (const marker of ["LATEST_MAP_PAYLOAD_CACHE","daily_trails_revision","show_vf_off_areas","notification_count","mark_notification_read","mark_all_notifications_read","nm-has-resume","navimower.resume","history_days","mower_icon","i2_lidar","MOWER_ICON_SPECS_032","show_custom_areas","custom_area_color","custom_area_","custom_areas"]) assert.ok(source.includes(marker), `flattened runtime must retain ${marker}`);
const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card.js");
const build = readFileSync("scripts/build.mjs", "utf8");
assert.match(build, /sourceJs\.length\s*!==\s*1/);
assert.match(build, /await\s+rm\(distDir/);
assert.match(build, /await\s+copyFile\(source,\s*target\)/);
assert.doesNotMatch(build, /CHANGELOG|README|package\.json|beta\d/i, "build must not mutate metadata or depend on a beta number");
const guard = readFileSync("scripts/check-runtime-layout.mjs", "utf8");
assert.match(guard, /src must contain exactly one runtime JavaScript file/);
assert.match(guard, /dist must contain exactly one runtime JavaScript file/);
assert.match(guard, /byte|exact build copy/i);
const contributing = readFileSync("CONTRIBUTING.md", "utf8");
assert.match(contributing, /exactly one runtime JavaScript file/i);
assert.match(contributing, /Do \*\*not\*\* add files such as/);
assert.match(contributing, /genuinely needs more than one runtime JavaScript file/i);
const autoStart = source.indexOf("function autoMowerIcon032(model)");
const autoEnd = source.indexOf("function mowerTransform032", autoStart);
const autoBlock = source.slice(autoStart, autoEnd);
assert.match(autoBlock, /return null;/);
assert.match(autoBlock, /_mowerModelResolved032 \? "h2" : null/);
assert.match(autoBlock, /group\.style\.display = "none"/);
assert.match(source, /this\._mowerModelResolved032 = false/);
assert.match(source, /this\._mowerModelResolved032 = true/);
assert.match(source, /const artwork = ensureMowerArtwork032\(this\)/);
assert.match(source, /if \(!key\) return ""/);
const readme = readFileSync("README.md", "utf8");
assert.doesNotMatch(readme, /notification_page_size/);
assert.doesNotMatch(readme, /navimower-map-card-0\.3\.1-b3\.js/);
assert.match(readme, /docs\/images\/navimower-map-card\.jpg/);
assert.match(readme, /current_cycle_render/);

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (sofMarkers.has(marker) && segmentLength >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

const readmeScreenshot = readFileSync("docs/images/navimower-map-card.jpg");
assert.ok(readmeScreenshot.length > 10_000, "README screenshot must contain a real image payload");
assert.deepEqual([...readmeScreenshot.subarray(0, 3)], [0xff, 0xd8, 0xff], "README screenshot must start with a JPEG SOI marker");
assert.deepEqual([...readmeScreenshot.subarray(-2)], [0xff, 0xd9], "README screenshot must end with a JPEG EOI marker");
assert.deepEqual(jpegDimensions(readmeScreenshot), { width: 537, height: 726 }, "README screenshot dimensions must match the documented card capture");

const advanced = readFileSync("examples/advanced.yaml", "utf8");
assert.doesNotMatch(advanced, /show_tunnels|tunnel_color|session_count|notification_page_size/);
assert.match(advanced, /history_days: 3/);
assert.match(advanced, /notification_count: 5/);
assert.match(advanced, /mower_icon: auto/);
assert.match(readFileSync("examples/mower-artwork.yaml", "utf8"), /i2_lidar|x3|x4/);
console.log(`${pkg.version} single-runtime regression checks passed`);
