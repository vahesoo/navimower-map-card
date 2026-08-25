import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.4-beta9: current-cycle live history label.";
if (source.includes(marker)) {
  console.log("Current-cycle UI upgrade already applied");
  process.exit(0);
}

const patch = String.raw`

// 0.3.4-beta9: current-cycle live history label.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower034Beta9Patched) return;
  Card.__navimower034Beta9Patched = true;

  const proto = Card.prototype;
  const previousRenderHistoryBar = proto._renderHistoryBar;
  proto._renderHistoryBar = function (...args) {
    const result = previousRenderHistoryBar?.apply(this, args);
    if (this._mapPayload?.daily_trails?.scope === "current_cycle") {
      this._historyBarEl
        ?.querySelectorAll?.('[data-history-offset="today"]')
        ?.forEach?.((button) => {
          button.textContent = "Current cycle";
          button.title = "Current mowing cycle since the latest confirmed reset";
        });
    }
    return result;
  };

  console.info("[Navimower Map Card] 0.3.4-beta9 current-cycle live history label enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied current-cycle UI upgrade");
