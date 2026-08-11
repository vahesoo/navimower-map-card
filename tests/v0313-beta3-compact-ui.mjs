import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NAVIMOWER_MAP_CARD_V037U_VERSION,
  SHOW_TITLE_DEFAULT,
  extendCompactUiConfigForm,
  normalizeCompactUiConfig,
  notificationExpansionKey,
} from "../src/navimower-map-card-v037u.js";

assert.equal(NAVIMOWER_MAP_CARD_V037U_VERSION, "0.3.1-beta3");
assert.equal(SHOW_TITLE_DEFAULT, true);
assert.equal(normalizeCompactUiConfig({}).show_title, true);
assert.equal(normalizeCompactUiConfig({ show_title: false }).show_title, false);
assert.equal(normalizeCompactUiConfig({ show_title: "false" }).show_title, false);
assert.equal(notificationExpansionKey({ message_id: "262133959204" }), "262133959204");
assert.equal(notificationExpansionKey({ id: 123 }), "123");

const baseForm = {
  schema: [
    {
      type: "grid",
      name: "general",
      flatten: true,
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "lawn_mower" } } },
        { name: "title", selector: { text: {} } },
        { name: "auto_entities", selector: { boolean: {} } },
      ],
    },
    {
      type: "expandable",
      name: "advanced",
      schema: [
        { name: "trail_length", selector: { number: { min: 100, max: 50000 } } },
      ],
    },
  ],
  computeLabel: (schema) => schema?.name || "",
};
const form = extendCompactUiConfigForm(baseForm);
const general = form.schema.find((item) => item.name === "general");
assert.equal(general.schema.length, 2);
assert.deepEqual(general.schema[0].schema.map((item) => item.name), ["entity", "auto_entities"]);
assert.deepEqual(general.schema[1].schema.map((item) => item.name), ["title_caption", "title", "show_title"]);
assert.equal(general.schema[1].schema[0].type, "constant");
assert.equal(general.schema[1].schema[2].default, true);
assert.equal(form.computeLabel({ name: "title_caption" }), "Title");
assert.equal(form.computeLabel({ name: "title" }), "");
assert.equal(form.computeLabel({ name: "show_title" }), "Show title");
assert.equal(form.computeLabel({ name: "trail_length" }), "Live trail point cap");
assert.match(form.computeHelper({ name: "trail_length" }), /active\/fallback trail only/i);
assert.match(form.computeHelper({ name: "trail_length" }), /Completed mowed-area history is unaffected/i);

for (const root of ["src", "dist"]) {
  const beta3Loader = readFileSync(`${root}/navimower-map-card-0.3.1-b3.js`, "utf8");
  const layer = readFileSync(`${root}/navimower-map-card-v037u.js`, "utf8");

  assert.match(beta3Loader, /NAVIMOWER_MAP_CARD_VERSION = "0\.3\.1-beta3"/);
  assert.match(beta3Loader, /navimower-map-card-v037u\.js/);
  assert.match(beta3Loader, /0\.3\.1-b3/);
  assert.match(beta3Loader, /stable will use 0\.3\.1\.js/);

  assert.match(layer, /nm-header-actions/);
  assert.match(layer, /nm-title\[hidden\]/);
  assert.match(layer, /show_title/);
  assert.match(layer, /title_caption/);
  assert.match(layer, /type: "constant"/);
  assert.match(layer, /Live trail point cap/);
  assert.match(layer, /browser-side active\/fallback trail only/);
  assert.match(layer, /data-notification-mark-id/);
  assert.match(layer, /data-notification-expand-key/);
  assert.match(layer, /data-notification-title-unread/);
  assert.match(layer, /nm-notification-content-expanded/);
  assert.match(layer, /Mark as read/);
  assert.match(layer, /Mark all as read/);
  assert.match(layer, /callService\("navimower", "mark_notification_read"/);
  assert.match(layer, /callService\("navimower", "mark_all_notifications_read"/);
  assert.match(layer, /\.nm-notification-dot \{ display: none; \}/);
  assert.doesNotMatch(layer, /clearBatchMessageRead|getmessageDetailResp|vehicleMessageListField/);
  assert.doesNotMatch(layer, /\.read\s*=\s*true/);
  assert.doesNotMatch(layer, /nm-notification-code/);
}

assert.equal(readFileSync("src/navimower-map-card-v037u.js", "utf8"), readFileSync("dist/navimower-map-card-v037u.js", "utf8"));
assert.equal(readFileSync("src/navimower-map-card-0.3.1-b3.js", "utf8"), readFileSync("dist/navimower-map-card-0.3.1-b3.js", "utf8"));

const beta2Source = readFileSync("src/navimower-map-card-v036n.js", "utf8");
assert.match(beta2Source, /NAVIMOWER_MAP_CARD_V036N_VERSION = "0\.3\.1-beta2"/);
assert.doesNotMatch(beta2Source, /0\.3\.1-beta3/);

console.log("0.3.1-beta3 historical compact notification/header checks passed");
