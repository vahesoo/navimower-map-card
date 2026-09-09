import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyBeta17Patch, BETA17_MARKER } from "../scripts/upgrade-beta17-underlay-notifications.mjs";

const fixture = `
  const OFFSET_MIN14 = -5;
  const OFFSET_MAX14 = 5;
    card._notificationPage = Math.max(0, Math.min(pageCount - 1, Number(card._notificationPage) || 0));
    const pageItems = items.slice(card._notificationPage * pageSize, card._notificationPage * pageSize + pageSize);
    const pager = pageCount > 1 ? "<div class=\"nm-notification-pager\"><button type=\"button\" data-multi-notification-page=\"previous\"" + (card._notificationPage <= 0 ? " disabled" : "") + ">Previous</button><span class=\"nm-notification-page-label\">" + (card._notificationPage + 1) + " / " + pageCount + "</span><button type=\"button\" data-multi-notification-page=\"next\"" + (card._notificationPage >= pageCount - 1 ? " disabled" : "") + ">Next</button></div>" : "";
      card._notificationPage += button.dataset.multiNotificationPage === "next" ? 1 : -1;
      this._notificationDialogOpen = true;
      this._notificationPage = 0;
      renderMultiNotifications036(this);
`;

const patched = applyBeta17Patch(fixture);
assert.match(patched, /const OFFSET_MIN14 = -10;/);
assert.match(patched, /const OFFSET_MAX14 = 10;/);
assert.match(patched, /card\._multi036NotificationPage = Math\.max/);
assert.match(patched, /items\.slice\(card\._multi036NotificationPage \* pageSize/);
assert.match(patched, /card\._multi036NotificationPage <= 0/);
assert.match(patched, /card\._multi036NotificationPage >= pageCount - 1/);
assert.match(patched, /card\._multi036NotificationPage \+= button\.dataset\.multiNotificationPage/);
assert.match(patched, /this\._multi036NotificationPage = 0/);
assert.ok(patched.includes(BETA17_MARKER));
assert.equal(applyBeta17Patch(patched), patched, "beta17 upgrade must be idempotent");

const prepare = readFileSync("scripts/prepare-runtime-pipeline-beta16.mjs", "utf8");
const guard = prepare.indexOf("source.includes(beta16Marker)");
const normalization = prepare.indexOf('const startMarker = "function withLightweightMapQuery(path) {"');
assert.ok(guard >= 0 && normalization > guard, "beta16 prepare must exit before normalizing an already-prepared runtime");

console.log("0.3.6-beta17 underlay and multi-mower notification checks passed");
