import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V035N_VERSION,
  NOTIFICATION_PAGE_SIZE,
  formatNotificationTimestamp,
  hasUnreadNotifications,
  normalizeNotificationItem,
  notificationEntityCandidates,
  notificationItemsFromState,
  notificationPage,
} from "../src/navimower-map-card-v035n.js";

assert.equal(NAVIMOWER_MAP_CARD_V035N_VERSION, "0.3.1-beta1");
assert.equal(NOTIFICATION_PAGE_SIZE, 3);

assert.deepEqual(notificationEntityCandidates("lawn_mower.tont"), [
  "sensor.tont_latest_notification",
  "sensor.tont_notification",
]);
assert.deepEqual(notificationEntityCandidates("lawn_mower.tont_mower"), [
  "sensor.tont_mower_latest_notification",
  "sensor.tont_mower_notification",
  "sensor.tont_latest_notification",
  "sensor.tont_notification",
]);

const state = {
  state: "Scheduled mowing suspended due to rain",
  attributes: {
    recent: [
      { id: 1, title: "Scheduled mowing suspended due to rain", content: "Rain detected", created_at: 1786430000000, read: false, notification_code: "1509" },
      { id: 2, title: "One-time mowing suspended due to rain", content: "Rain detected", created_at: 1786420000000, read: true, notification_code: "150A" },
      { id: 3, title: "Lawn mower back to charging station", content: "", created_at: 1786410000000, read: true, notification_code: "1502" },
      { id: 4, title: "Location changed for the charging station", content: "", created_at: 1786400000000, read: true, notification_code: "1824" },
      { id: 5, title: "Unable to start scheduled mowing", content: "", created_at: 1786390000000, read: true, notification_code: "1403" },
    ],
  },
};
const items = notificationItemsFromState(state);
assert.equal(items.length, 5);
assert.equal(items[0].read, false);
assert.equal(items[1].code, "150A");
assert.equal(hasUnreadNotifications(items), true);
assert.equal(hasUnreadNotifications(items.slice(1)), false);

const first = notificationPage(items, 0);
assert.equal(first.items.length, 3);
assert.equal(first.page, 0);
assert.equal(first.pageCount, 2);
assert.equal(first.items[0].code, "1509");
const second = notificationPage(items, 1);
assert.equal(second.items.length, 2);
assert.equal(second.page, 1);
assert.equal(notificationPage(items, 99).page, 1);

assert.equal(normalizeNotificationItem({ read: "false", error_code: "6108" }).read, false);
assert.equal(normalizeNotificationItem({ read: "false", error_code: "6108" }).code, "6108");
assert.equal(normalizeNotificationItem({ read: true, error_code: "150A" }).code, "150A");
assert.notEqual(formatNotificationTimestamp(1786430000000, {
  locale: { language: "en", time_format: "24" },
  config: { time_zone: "Europe/Tallinn" },
}), "Time unavailable");

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card-0.3.1-b1.js");

for (const root of ["src", "dist"]) {
  const loader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const hacsLoader = readFileSync(`${root}/navimower-map-card-0.3.1-b1.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v035n.js`, "utf8");
  assert.match(loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta1"/);
  assert.match(hacsLoader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta1"/);
  assert.match(loader, /navimower-map-card-v035n\.js/);
  assert.match(hacsLoader, /navimower-map-card-v035n\.js/);
  assert.match(hacsLoader, /0\.3\.1-b1/);
  assert.match(hacsLoader, /stable release will use 0\.3\.1\.js/);
  assert.match(layer, /mdi:bell-badge-outline/);
  assert.match(layer, /mdi:bell-outline/);
  assert.match(layer, /#FF5A00/);
  assert.match(layer, /NOTIFICATION_PAGE_SIZE = 3/);
  assert.match(layer, /\.attributes\?\.friendly_name|friendly_name/);
  assert.match(layer, /notification_entity/);
  assert.match(layer, /read-only notification panel enabled/);
  assert.doesNotMatch(layer, /clearBatchMessageRead|callService\(|callApi\(/);
}

assert.equal(readFileSync("src/navimower-map-card-v035n.js", "utf8"), readFileSync("dist/navimower-map-card-v035n.js", "utf8"));
assert.equal(readFileSync("src/navimower-map-card-0.3.1-b1.js", "utf8"), readFileSync("dist/navimower-map-card-0.3.1-b1.js", "utf8"));

console.log("0.3.1-beta1 notification panel checks passed");
