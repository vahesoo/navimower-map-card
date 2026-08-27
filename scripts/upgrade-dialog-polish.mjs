import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.env.NAVIMOWER_MAP_CARD_SOURCE || new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta14: consistent card-dialog backdrop closing and schedule header alignment.";
if (source.includes(marker)) {
  console.log("Beta14 dialog polish patch already applied");
  process.exit(0);
}
if (!source.includes("0.3.5-beta13: legend visibility follows map toggles and managed schedule gets an enable switch.")) {
  throw new Error("Expected beta13 marker was not found");
}

source += `\n\n${marker}\n(() => {\n  const Card = globalThis.customElements?.get?.("navimower-map-card");\n  if (!Card || Card.__navimower035Beta14DialogPolish) return;\n  Card.__navimower035Beta14DialogPolish = true;\n  const proto = Card.prototype;\n\n  function attachBackdropClose(root, closeSelector, markerName) {\n    if (!root || root[markerName]) return;\n    root[markerName] = true;\n    root.addEventListener("click", (event) => {\n      if (event.target !== root) return;\n      root.querySelector(closeSelector)?.click();\n    });\n  }\n\n  function polishSettings(card) {\n    const root = card?._modalHostEl?.querySelector?.("[data-beta8-settings-root]");\n    attachBackdropClose(root, "[data-beta8-settings-close]", "__navimowerBeta14SettingsBackdrop");\n  }\n\n  function polishSchedule(card) {\n    const root = card?._modalHostEl?.querySelector?.("[data-beta11-root], [data-beta2-root]");\n    if (!root) return;\n\n    const head = root.querySelector(".nm-schedule-dialog-head");\n    const copy = head?.firstElementChild;\n    const close = head?.querySelector(".nm-schedule-close");\n    if (head) head.style.alignItems = "flex-start";\n    if (copy && copy !== close) {\n      copy.style.flex = "1 1 auto";\n      copy.style.minWidth = "0";\n    }\n    if (close) {\n      close.style.marginLeft = "auto";\n      close.style.flex = "0 0 auto";\n    }\n\n    attachBackdropClose(root, "[data-beta11-close], [data-beta2-close]", "__navimowerBeta14ScheduleBackdrop");\n  }\n\n  function polishDialogs(card) {\n    polishSettings(card);\n    polishSchedule(card);\n  }\n\n  const previousRenderDialog = proto._renderDialog;\n  if (typeof previousRenderDialog === "function") {\n    proto._renderDialog = function beta14RenderDialog(...args) {\n      const result = previousRenderDialog.apply(this, args);\n      polishDialogs(this);\n      globalThis.queueMicrotask?.(() => polishDialogs(this));\n      return result;\n    };\n  }\n\n  const previousHass = Object.getOwnPropertyDescriptor(proto, "hass");\n  if (previousHass?.set) {\n    Object.defineProperty(proto, "hass", {\n      configurable: true,\n      get: previousHass.get,\n      set(value) {\n        previousHass.set.call(this, value);\n        polishDialogs(this);\n        globalThis.queueMicrotask?.(() => polishDialogs(this));\n      },\n    });\n  }\n\n  console.info("[Navimower Map Card] 0.3.5-beta14 dialog backdrop closing and schedule header alignment enabled");\n})();\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied beta14 dialog polish patch");
