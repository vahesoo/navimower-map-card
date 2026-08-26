import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.5-beta9: backend-owned current-cycle mowed-area render.";
if (source.includes(marker)) {
  console.log("Backend current-cycle render upgrade already applied");
  process.exit(0);
}

const patch = `

${marker}
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower035Beta9CurrentCycleRender) return;
  Card.__navimower035Beta9CurrentCycleRender = true;
  const proto = Card.prototype;

  const previousRenderHistory = proto._renderHistory;
  proto._renderHistory = function backendCurrentCycleHistory() {
    const current = this._mapPayload?.current_cycle_render;
    if (this._historyDayOffset !== null || current?.scope !== "current_cycle") {
      return previousRenderHistory?.call(this);
    }
    if (!this._historyEl || !this._layout) return;

    const area = current?.mowed_area;
    const render = area && typeof area === "object" ? {
      version: current.render_schema_version,
      coordinate_space: current.coordinate_space || "map_xy_m",
      mowed_area: area,
      travel: { path_d: "", stroke_width_m: 0 },
      route: { path_d: "", stroke_width_m: 0 },
    } : null;
    const revision = String(current?.revision ?? "");
    const renderKey = [
      "backend-current-cycle",
      this._mapStaticSignature,
      revision,
      this._config?.trail_color,
      this._config?.trail_opacity,
      this._layout?.scale,
      String(area?.path_d || "").length,
    ].join("|");
    if (renderKey === this._historyRenderKey) return;
    this._historyRenderKey = renderKey;

    this._historyEl.innerHTML = render && String(area?.path_d || "").trim()
      ? archiveSvg(
          render,
          this._layout,
          this._config.trail_color,
          this._config.trail_opacity,
          "current-cycle"
        )
      : "";
  };

  const previousRenderHistoryBar = proto._renderHistoryBar;
  proto._renderHistoryBar = function backendCurrentCycleHistoryBar(...args) {
    const result = previousRenderHistoryBar?.apply(this, args);
    if (this._mapPayload?.current_cycle_render?.scope === "current_cycle") {
      this._historyBarEl
        ?.querySelectorAll?.('[data-history-offset="today"]')
        ?.forEach?.((button) => {
          button.textContent = "Current cycle";
          button.title = "Current mowing cycle since the latest confirmed reset";
        });
    }
    return result;
  };

  console.info("[Navimower Map Card] 0.3.5-beta9 backend current-cycle render enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied backend current-cycle render upgrade");
