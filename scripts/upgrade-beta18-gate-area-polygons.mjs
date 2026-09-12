import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BETA18_MARKER = "// 0.3.6-beta18: exact polygon gate-area rendering in Single and Multi mower views.";

export function applyBeta18Patch(input) {
  let source = String(input || "");
  if (source.includes(BETA18_MARKER)) return source;

  const replaceOnce = (before, after, label) => {
    const index = source.indexOf(before);
    if (index < 0) throw new Error("Missing beta18 source anchor: " + label);
    if (source.indexOf(before, index + before.length) >= 0) {
      throw new Error("Ambiguous beta18 source anchor: " + label);
    }
    source = source.slice(0, index) + after + source.slice(index + before.length);
  };

  replaceOnce(
`    if (this._config.show_gate_areas) {
      gateAreas.forEach((channel) => {
        stable.push(
          [channel.x_min, channel.y_min],
          [channel.x_min, channel.y_max],
          [channel.x_max, channel.y_min],
          [channel.x_max, channel.y_max]
        );
      });
    }`,
`    if (this._config.show_gate_areas) {
      gateAreas.forEach((channel) => {
        const polygon = (Array.isArray(channel?.polygon) ? channel.polygon : [])
          .map((point) => [Number(point?.[0]), Number(point?.[1])])
          .filter((point) => point.every(Number.isFinite));
        if (polygon.length >= 3) {
          polygon.forEach((point) => stable.push(point));
          return;
        }
        stable.push(
          [channel.x_min, channel.y_min],
          [channel.x_min, channel.y_max],
          [channel.x_max, channel.y_min],
          [channel.x_max, channel.y_max]
        );
      });
    }`,
    "single-mower layout gate-area bounds",
  );

  replaceOnce(
`    if (c.show_gate_areas) {
      gateAreas.forEach((channel) => {
        const x1 = sx(Number(channel.x_min));
        const x2 = sx(Number(channel.x_max));
        const y1 = sy(Number(channel.y_max));
        const y2 = sy(Number(channel.y_min));
        details.push(\`<rect x="\${Math.min(x1, x2).toFixed(1)}" y="\${Math.min(y1, y2).toFixed(1)}" width="\${Math.abs(x2 - x1).toFixed(1)}" height="\${Math.abs(y2 - y1).toFixed(1)}" fill="\${escapeHtml(c.gate_area_color)}" fill-opacity=".14" stroke="\${escapeHtml(c.gate_area_color)}" stroke-width="3" stroke-dasharray="10 6"/>\`);
        const gateLabel = channel.name || "Gate area";
        const gateX = (x1 + x2) / 2;
        const gateY = Math.min(y1, y2) + 24;
        labels.push(this._label(gateX, gateY, gateLabel, 19));
        const gateWidth = Math.max(54, String(gateLabel).length * 11.5);
        labelObstacles.push({ left: gateX - gateWidth / 2, right: gateX + gateWidth / 2, top: gateY - 21, bottom: gateY + 7 });
      });
    }`,
`    if (c.show_gate_areas) {
      gateAreas.forEach((channel) => {
        const polygon = (Array.isArray(channel?.polygon) ? channel.polygon : [])
          .map((point) => [Number(point?.[0]), Number(point?.[1])])
          .filter((point) => point.every(Number.isFinite));
        let gateX;
        let gateY;
        if (polygon.length >= 3) {
          const screen = polygon.map((point) => [sx(point[0]), sy(point[1])]);
          details.push(\`<polygon points="\${this._pointString(polygon)}" fill="\${escapeHtml(c.gate_area_color)}" fill-opacity=".14" stroke="\${escapeHtml(c.gate_area_color)}" stroke-width="3" stroke-dasharray="10 6" stroke-linejoin="round"/>\`);
          gateX = screen.reduce((sum, point) => sum + point[0], 0) / screen.length;
          gateY = Math.min(...screen.map((point) => point[1])) + 24;
        } else {
          const x1 = sx(Number(channel.x_min));
          const x2 = sx(Number(channel.x_max));
          const y1 = sy(Number(channel.y_max));
          const y2 = sy(Number(channel.y_min));
          details.push(\`<rect x="\${Math.min(x1, x2).toFixed(1)}" y="\${Math.min(y1, y2).toFixed(1)}" width="\${Math.abs(x2 - x1).toFixed(1)}" height="\${Math.abs(y2 - y1).toFixed(1)}" fill="\${escapeHtml(c.gate_area_color)}" fill-opacity=".14" stroke="\${escapeHtml(c.gate_area_color)}" stroke-width="3" stroke-dasharray="10 6"/>\`);
          gateX = (x1 + x2) / 2;
          gateY = Math.min(y1, y2) + 24;
        }
        const gateLabel = channel.name || "Gate area";
        labels.push(this._label(gateX, gateY, gateLabel, 19));
        const gateWidth = Math.max(54, String(gateLabel).length * 11.5);
        labelObstacles.push({ left: gateX - gateWidth / 2, right: gateX + gateWidth / 2, top: gateY - 21, bottom: gateY + 7 });
      });
    }`,
    "single-mower gate-area renderer",
  );

  replaceOnce(
`      if (c.show_gate_areas !== false) {
        for (const gate of payload?.gate_areas || []) {
          const x1 = finite036(gate?.x_min, null), x2 = finite036(gate?.x_max, null), y1 = finite036(gate?.y_min, null), y2 = finite036(gate?.y_max, null);
          if ([x1, x2, y1, y2].every((value) => value !== null)) local.push("<rect x=\\\"" + Math.min(x1, x2).toFixed(4) + "\\\" y=\\\"" + Math.min(y1, y2).toFixed(4) + "\\\" width=\\\"" + Math.abs(x2 - x1).toFixed(4) + "\\\" height=\\\"" + Math.abs(y2 - y1).toFixed(4) + "\\\" fill=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" fill-opacity=\\\".14\\\" stroke=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" stroke-width=\\\"" + clamp036(c.gate_area_stroke_width, 0.5, 12).toFixed(2) + "\\\" stroke-dasharray=\\\"10 6\\\" vector-effect=\\\"non-scaling-stroke\\\"/>");
        }
      }`,
`      if (c.show_gate_areas !== false) {
        for (const gate of payload?.gate_areas || []) {
          const polygon = rawPoints036(gate?.polygon);
          if (polygon && (Array.isArray(gate?.polygon) ? gate.polygon.length : 0) >= 3) {
            local.push("<polygon points=\\\"" + polygon + "\\\" fill=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" fill-opacity=\\\".14\\\" stroke=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" stroke-width=\\\"" + clamp036(c.gate_area_stroke_width, 0.5, 12).toFixed(2) + "\\\" stroke-dasharray=\\\"10 6\\\" stroke-linejoin=\\\"round\\\" vector-effect=\\\"non-scaling-stroke\\\"/>");
            continue;
          }
          const x1 = finite036(gate?.x_min, null), x2 = finite036(gate?.x_max, null), y1 = finite036(gate?.y_min, null), y2 = finite036(gate?.y_max, null);
          if ([x1, x2, y1, y2].every((value) => value !== null)) local.push("<rect x=\\\"" + Math.min(x1, x2).toFixed(4) + "\\\" y=\\\"" + Math.min(y1, y2).toFixed(4) + "\\\" width=\\\"" + Math.abs(x2 - x1).toFixed(4) + "\\\" height=\\\"" + Math.abs(y2 - y1).toFixed(4) + "\\\" fill=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" fill-opacity=\\\".14\\\" stroke=\\\"" + esc(c.gate_area_color || "#8e24aa") + "\\\" stroke-width=\\\"" + clamp036(c.gate_area_stroke_width, 0.5, 12).toFixed(2) + "\\\" stroke-dasharray=\\\"10 6\\\" vector-effect=\\\"non-scaling-stroke\\\"/>");
        }
      }`,
    "multi-mower gate-area renderer",
  );

  return source + "\n\n" + BETA18_MARKER + "\n";
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
  const before = await readFile(sourcePath, "utf8");
  const after = applyBeta18Patch(before);
  if (after !== before) {
    await writeFile(sourcePath, after, "utf8");
    console.log("Applied 0.3.6-beta18 exact polygon gate-area rendering");
  } else {
    console.log("0.3.6-beta18 gate-area rendering already applied");
  }
}
