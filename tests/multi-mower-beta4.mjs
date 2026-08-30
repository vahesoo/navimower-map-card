import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.version, /^0\.3\.6(?:-|$)/, "beta4 regression must remain valid for later 0.3.6 builds");

const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
assert.equal(dist, source, "dist must remain the deterministic copy of src");

for (const token of [
  "// 0.3.6-beta4: strict member schedule and clickable multi-zone labels.",
  "nativeData: entities.native_schedule_data || null",
  "proto._scheduleEntity = function multi036ScheduleEntity",
  "proto._scheduleSwitchEntity = function multi036ScheduleSwitchEntity",
  "if (member) return memberEntities036(member)?.native_schedule_data || null",
  "if (member) return memberEntities036(member)?.native_schedule || null",
  "const managedStatusPresent = Boolean(ids.status && state036(card, ids.status))",
  'card._config.schedule_view_mode = "native"',
  "multiZoneToken036",
  "parseMultiZoneToken036",
  "memberZoneDetails036",
  "proto._openZoneInfo = function multi036OpenZoneInfo",
  "card._pill(item.cx, item.cy, item.value, token)",
  '["Mower", displayName036(member)]',
]) {
  assert.ok(source.includes(token), `beta4 multi-mower scope fix is missing ${token}`);
}

assert.ok(
  !source.includes("output.push(card._pill(item.cx, item.cy, item.value, null));"),
  "Multi mower zone pills must stay interactive instead of using null zone IDs",
);
assert.ok(
  source.includes("if (!managedStatusPresent && card._config)"),
  "A member without a Navimower managed schedule must take the scoped native schedule path",
);
assert.ok(
  source.includes("return originalScheduleEntity036.apply(this, args)") && source.includes("return originalScheduleSwitchEntity036.apply(this, args)"),
  "Single mower schedule behavior must retain the original entity resolvers",
);

console.log("0.3.6-beta4 multi-mower scope regression checks passed");
