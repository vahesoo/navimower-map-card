import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V038U_VERSION,
  NOTIFICATION_COUNT_DEFAULT,
  NOTIFICATION_COUNT_LIMITS,
  extendBeta4ConfigForm,
  normalizeBeta4Config,
  notificationCount,
  titleHeaderState,
} from "../src/navimower-map-card-v038u.js";

assert.equal(NAVIMOWER_MAP_CARD_V038U_VERSION, "0.3.1-beta4");
assert.equal(NOTIFICATION_COUNT_DEFAULT, 5);
assert.deepEqual(NOTIFICATION_COUNT_LIMITS, { minimum: 1, maximum: 10 });
assert.equal(notificationCount({}), 5);
assert.equal(notificationCount({ notification_count: 1 }), 1);
assert.equal(notificationCount({ notification_count: 10 }), 10);
assert.equal(notificationCount({ notification_count: 99 }), 10);
assert.equal(notificationCount({ notification_count: 4.9 }), 4);
assert.equal(notificationCount({ notification_page_size: 2 }), 5);

const normalized = normalizeBeta4Config({
  entity: "lawn_mower.tont",
  notification_count: 8,
  notification_page_size: 2,
});
assert.equal(normalized.notification_count, 8);
assert.equal(Object.hasOwn(normalized, "notification_page_size"), false);

assert.deepEqual(titleHeaderState({ title: "Tont", show_title: true }), { title: "Tont", show: true });
assert.deepEqual(titleHeaderState({ title: "Tont", show_title: false }), { title: "Tont", show: false });
assert.deepEqual(titleHeaderState({ title: "", show_title: true }), { title: "", show: false });

const form = extendBeta4ConfigForm({
  schema: [
    {
      type: "expandable",
      name: "notifications",
      schema: [
        {
          type: "grid",
          name: "notifications_grid",
          schema: [
            { name: "notification_mark_read_on_open", selector: { boolean: {} } },
            { name: "notification_page_size", selector: { number: { min: 1, max: 5 } } },
          ],
        },
      ],
    },
  ],
  computeLabel: (schema) => schema?.name || "",
});
const notificationGrid = form.schema[0].schema[0];
assert.deepEqual(notificationGrid.schema.map((item) => item.name), [
  "notification_mark_read_on_open",
  "notification_count",
]);
const countSchema = notificationGrid.schema.find((item) => item.name === "notification_count");
assert.equal(countSchema.selector.number.min, 1);
assert.equal(countSchema.selector.number.max, 10);
assert.equal(form.computeLabel({ name: "notification_count" }), "Notifications to show");

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card-0.3.1-b4.js");

for (const root of ["src", "dist"]) {
  const currentLoader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const beta4Loader = readFileSync(`${root}/navimower-map-card-0.3.1-b4.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v038u.js`, "utf8");

  assert.match(currentLoader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta4"/);
  assert.match(beta4Loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta4"/);
  assert.match(currentLoader, /navimower-map-card-v038u\.js/);
  assert.match(beta4Loader, /navimower-map-card-v038u\.js/);
  assert.match(layer, /header\.style\.display = "block"/);
  assert.match(layer, /notification_count/);
  assert.match(layer, /Notifications to show/);
  assert.match(layer, /maximum: 10/);
  assert.match(layer, /overflow-y: auto/);
  assert.match(layer, /touch-action: pan-y/);
  assert.match(layer, /allItems\.slice\(0, notificationCount/);
  assert.doesNotMatch(layer, /data-notification-page=/);
  assert.doesNotMatch(layer, /nm-notification-pager/);
  assert.doesNotMatch(layer, /notificationCount\([^)]*notification_page_size/);
  assert.doesNotMatch(layer, /clearBatchMessageRead|getmessageDetailResp|vehicleMessageListField/);
  assert.doesNotMatch(layer, /\.read\s*=\s*true/);
}

assert.equal(readFileSync("src/navimower-map-card-v038u.js", "utf8"), readFileSync("dist/navimower-map-card-v038u.js", "utf8"));
assert.equal(readFileSync("src/navimower-map-card-0.3.1-b4.js", "utf8"), readFileSync("dist/navimower-map-card-0.3.1-b4.js", "utf8"));

console.log("0.3.1-beta4 title and scrollable notification checks passed");
