import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BETA17_MARKER = "// 0.3.6-beta17: extended underlay offsets and stable multi-mower notification paging.";

export function applyBeta17Patch(input) {
  let source = String(input || "");
  if (source.includes(BETA17_MARKER)) return source;

  const replaceOnce = (before, after, label) => {
    const index = source.indexOf(before);
    if (index < 0) throw new Error("Missing beta17 source anchor: " + label);
    if (source.indexOf(before, index + before.length) >= 0) {
      throw new Error("Ambiguous beta17 source anchor: " + label);
    }
    source = source.slice(0, index) + after + source.slice(index + before.length);
  };

  replaceOnce(
    "  const OFFSET_MIN14 = -5;\n  const OFFSET_MAX14 = 5;",
    "  const OFFSET_MIN14 = -10;\n  const OFFSET_MAX14 = 10;",
    "underlay east/north offset limits",
  );

  replaceOnce(
    "    card._notificationPage = Math.max(0, Math.min(pageCount - 1, Number(card._notificationPage) || 0));",
    "    card._multi036NotificationPage = Math.max(0, Math.min(pageCount - 1, Number(card._multi036NotificationPage) || 0));",
    "multi notification page clamp",
  );

  replaceOnce(
    "    const pageItems = items.slice(card._notificationPage * pageSize, card._notificationPage * pageSize + pageSize);",
    "    const pageItems = items.slice(card._multi036NotificationPage * pageSize, card._multi036NotificationPage * pageSize + pageSize);",
    "multi notification page slice",
  );

  replaceOnce(
    "    const pager = pageCount > 1 ? \"<div class=\\\"nm-notification-pager\\\"><button type=\\\"button\\\" data-multi-notification-page=\\\"previous\\\"\" + (card._notificationPage <= 0 ? \" disabled\" : \"\") + \">Previous</button><span class=\\\"nm-notification-page-label\\\">\" + (card._notificationPage + 1) + \" / \" + pageCount + \"</span><button type=\\\"button\\\" data-multi-notification-page=\\\"next\\\"\" + (card._notificationPage >= pageCount - 1 ? \" disabled\" : \"\") + \">Next</button></div>\" : \"\";",
    "    const pager = pageCount > 1 ? \"<div class=\\\"nm-notification-pager\\\"><button type=\\\"button\\\" data-multi-notification-page=\\\"previous\\\"\" + (card._multi036NotificationPage <= 0 ? \" disabled\" : \"\") + \">Previous</button><span class=\\\"nm-notification-page-label\\\">\" + (card._multi036NotificationPage + 1) + \" / \" + pageCount + \"</span><button type=\\\"button\\\" data-multi-notification-page=\\\"next\\\"\" + (card._multi036NotificationPage >= pageCount - 1 ? \" disabled\" : \"\") + \">Next</button></div>\" : \"\";",
    "multi notification pager state",
  );

  replaceOnce(
    "      card._notificationPage += button.dataset.multiNotificationPage === \"next\" ? 1 : -1;",
    "      card._multi036NotificationPage += button.dataset.multiNotificationPage === \"next\" ? 1 : -1;",
    "multi notification pager navigation",
  );

  replaceOnce(
    "      this._notificationDialogOpen = true;\n      this._notificationPage = 0;\n      renderMultiNotifications036(this);",
    "      this._notificationDialogOpen = true;\n      this._multi036NotificationPage = 0;\n      renderMultiNotifications036(this);",
    "multi notification dialog reset",
  );

  return source + "\n\n" + BETA17_MARKER + "\n";
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
  const before = await readFile(sourcePath, "utf8");
  const after = applyBeta17Patch(before);
  if (after !== before) {
    await writeFile(sourcePath, after, "utf8");
    console.log("Applied 0.3.6-beta17 underlay and multi-mower notification fixes");
  } else {
    console.log("0.3.6-beta17 runtime fixes already applied");
  }
}
