import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V036N_VERSION,
  NOTIFICATION_MARK_READ_ON_OPEN_DEFAULT,
  NOTIFICATION_PAGE_SIZE_DEFAULT,
  extendNotificationConfigForm,
  normalizeNotificationActionConfig,
  notificationItemsWithMessageIds,
  notificationPageSize,
} from "../src/navimower-map-card-v036n.js";

assert.equal(NAVIMOWER_MAP_CARD_V036N_VERSION, "0.3.1-beta2");
assert.equal(NOTIFICATION_PAGE_SIZE_DEFAULT, 3);
assert.equal(NOTIFICATION_MARK_READ_ON_OPEN_DEFAULT, false);
assert.equal(notificationPageSize({}), 3);
assert.equal(notificationPageSize({ notification_page_size: 1 }), 1);
assert.equal(notificationPageSize({ notification_page_size: 9 }), 5);
assert.equal(notificationPageSize({ notification_page_size: 4.9 }), 4);

assert.deepEqual(
  normalizeNotificationActionConfig({ entity: "lawn_mower.niidu" }),
  {
    entity: "lawn_mower.niidu",
    notification_page_size: 3,
    notification_mark_read_on_open: false,
  },
);
assert.equal(
  normalizeNotificationActionConfig({ notification_mark_read_on_open: "false" })
    .notification_mark_read_on_open,
  false,
);
assert.equal(
  normalizeNotificationActionConfig({ notification_mark_read_on_open: true })
    .notification_mark_read_on_open,
  true,
);

const state = {
  state: "One-time mowing suspended due to rain",
  attributes: {
    recent: [
      {
        id: "2133959204",
        message_id: "262133959204",
        title: "One-time mowing suspended due to rain",
        created_at: "2026-08-11T16:05:32+00:00",
        read: false,
        notification_code: "150A",
      },
      {
        id: "2133411184",
        message_id: "262133411184",
        title: "Mower got stuck or lifted",
        created_at: "2026-08-11T14:57:55+00:00",
        read: true,
        notification_code: "180D",
      },
    ],
  },
};
const items = notificationItemsWithMessageIds(state);
assert.equal(items.length, 2);
assert.equal(items[0].id, "2133959204");
assert.equal(items[0].message_id, "262133959204");
assert.equal(items[0].read, false);
assert.equal(items[1].message_id, "262133411184");

const form = extendNotificationConfigForm({
  schema: [{ type: "expandable", name: "advanced", schema: [] }],
  computeLabel: (schema) => schema?.name || "",
});
const notifications = form.schema.find((item) => item?.name === "notifications");
assert.ok(notifications);
const fields = notifications.schema[0].schema.map((item) => item.name);
assert.deepEqual(fields, ["notification_mark_read_on_open", "notification_page_size"]);
assert.equal(form.computeLabel({ name: "notification_mark_read_on_open" }), "Mark notifications as read when opening");
assert.equal(form.computeLabel({ name: "notification_page_size" }), "Notifications per page");

const hacs = JSON.parse(readFileSync("hacs.json", "utf8"));
assert.equal(hacs.filename, "navimower-map-card-0.3.1-b2.js");

for (const root of ["src", "dist"]) {
  const currentLoader = readFileSync(`${root}/navimower-map-card.js`, "utf8");
  const beta2Loader = readFileSync(`${root}/navimower-map-card-0.3.1-b2.js`, "utf8");
  const beta2Layer = readFileSync(`${root}/navimower-map-card-v036n.js`, "utf8");

  assert.match(currentLoader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta2"/);
  assert.match(beta2Loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta2"/);
  assert.match(currentLoader, /navimower-map-card-v036n\.js/);
  assert.match(beta2Loader, /navimower-map-card-v036n\.js/);
  assert.match(beta2Loader, /0\.3\.1-b2/);
  assert.match(beta2Loader, /stable release will use 0\.3\.1\.js/);

  assert.match(beta2Layer, /mark_notification_read/);
  assert.match(beta2Layer, /mark_all_notifications_read/);
  assert.match(beta2Layer, /message_id/);
  assert.match(beta2Layer, /Mark all as read/);
  assert.match(beta2Layer, /Mark as read/);
  assert.match(beta2Layer, /Notifications per page/);
  assert.match(beta2Layer, /Mark notifications as read when opening/);
  assert.match(beta2Layer, /notification_mark_read_on_open/);
  assert.match(beta2Layer, /NOTIFICATION_MARK_READ_ON_OPEN_DEFAULT = false/);
  assert.match(beta2Layer, /#FF5A00/);
  assert.match(beta2Layer, /nm-notification-button-label/);
  assert.doesNotMatch(beta2Layer, /nm-notification-code/);
  assert.doesNotMatch(beta2Layer, /clearBatchMessageRead|getmessageDetailResp|vehicleMessageListField/);
  assert.doesNotMatch(beta2Layer, /\.read\s*=\s*true/);
}

assert.equal(readFileSync("src/navimower-map-card-v036n.js", "utf8"), readFileSync("dist/navimower-map-card-v036n.js", "utf8"));
assert.equal(readFileSync("src/navimower-map-card-0.3.1-b2.js", "utf8"), readFileSync("dist/navimower-map-card-0.3.1-b2.js", "utf8"));

console.log("0.3.1-beta2 notification action checks passed");
