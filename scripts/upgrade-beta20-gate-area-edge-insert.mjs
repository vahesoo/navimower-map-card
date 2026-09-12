import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BETA20_MARKER = "// 0.3.6-beta20: edge-aware gate-area point insertion and geometry guard.";
const BETA19_MARKER = "// 0.3.6-beta19: visual gate-area polygon editor.";
export const EDGE_INSERT_THRESHOLD_PX = 28;

const replaceExact = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
};

export function distanceToSegment20(point, start, end) {
  const px = Number(point?.[0]), py = Number(point?.[1]);
  const ax = Number(start?.[0]), ay = Number(start?.[1]);
  const bx = Number(end?.[0]), by = Number(end?.[1]);
  if (![px, py, ax, ay, bx, by].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dx = bx - ax, dy = by - ay;
  const length2 = dx * dx + dy * dy;
  if (length2 <= 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function nearestEdgeIndex20(points, point) {
  if (!Array.isArray(points) || points.length < 2) return null;
  let index = null;
  let distance = Number.POSITIVE_INFINITY;
  for (let current = 0; current < points.length; current += 1) {
    const next = (current + 1) % points.length;
    const candidate = distanceToSegment20(point, points[current], points[next]);
    if (candidate < distance) {
      distance = candidate;
      index = current;
    }
  }
  return index === null ? null : { index, distance };
}

export function polygonSelfIntersects20(points) {
  if (!Array.isArray(points) || points.length < 4) return false;
  const cross = (a, b, c) =>
    (Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(a[1])) -
    (Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(a[0]));
  const epsilon = 1e-9;
  const onSegment = (p, a, b) => {
    if (Math.abs(cross(a, b, p)) > epsilon) return false;
    return Number(p[0]) >= Math.min(Number(a[0]), Number(b[0])) - epsilon &&
      Number(p[0]) <= Math.max(Number(a[0]), Number(b[0])) + epsilon &&
      Number(p[1]) >= Math.min(Number(a[1]), Number(b[1])) - epsilon &&
      Number(p[1]) <= Math.max(Number(a[1]), Number(b[1])) + epsilon;
  };
  const intersects = (a1, a2, b1, b2) => {
    const c1 = cross(a1, a2, b1), c2 = cross(a1, a2, b2);
    const c3 = cross(b1, b2, a1), c4 = cross(b1, b2, a2);
    if (((c1 > epsilon && c2 < -epsilon) || (c1 < -epsilon && c2 > epsilon)) &&
        ((c3 > epsilon && c4 < -epsilon) || (c3 < -epsilon && c4 > epsilon))) return true;
    return (Math.abs(c1) <= epsilon && onSegment(b1, a1, a2)) ||
      (Math.abs(c2) <= epsilon && onSegment(b2, a1, a2)) ||
      (Math.abs(c3) <= epsilon && onSegment(a1, b1, b2)) ||
      (Math.abs(c4) <= epsilon && onSegment(a2, b1, b2));
  };

  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (intersects(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

export function applyBeta20Patch(input) {
  let source = String(input || "");
  if (source.includes(BETA20_MARKER)) return source;
  if (!source.includes(BETA19_MARKER)) {
    throw new Error("0.3.6-beta20 requires the beta19 visual gate-area editor runtime");
  }

  source = replaceExact(
    source,
    '  const MAX_POINTS = 64;\n',
    '  const MAX_POINTS = 64;\n  const EDGE_INSERT_THRESHOLD_PX = 28;\n',
    "edge insertion threshold",
  );

  const helperAnchor = `  const defaultName19 = (payload) => {`;
  const helpers = String.raw`  const distanceToSegment20 = (point, start, end) => {
    const px = Number(point?.[0]), py = Number(point?.[1]);
    const ax = Number(start?.[0]), ay = Number(start?.[1]);
    const bx = Number(end?.[0]), by = Number(end?.[1]);
    if (![px, py, ax, ay, bx, by].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
    const dx = bx - ax, dy = by - ay;
    const length2 = dx * dx + dy * dy;
    if (length2 <= 1e-12) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  const nearestEdge20 = (card, editor, clientX, clientY) => {
    const click = rootPoint19(card, clientX, clientY);
    if (!click || !editor || editor.points.length < 3) return null;
    const points = editor.points.map((point) => localToRoot19(card, editor.target, point));
    if (points.some((point) => !point || !point.every(Number.isFinite))) return null;
    const unit = Math.max(1e-9, rootUnitsPerPixel19(card));
    let index = null;
    let distancePx = Number.POSITIVE_INFINITY;
    for (let current = 0; current < points.length; current += 1) {
      const next = (current + 1) % points.length;
      const candidate = distanceToSegment20(click, points[current], points[next]) / unit;
      if (candidate < distancePx) {
        distancePx = candidate;
        index = current;
      }
    }
    return index !== null && distancePx <= EDGE_INSERT_THRESHOLD_PX ? { index, distancePx } : null;
  };

  const polygonSelfIntersects20 = (points) => {
    if (!Array.isArray(points) || points.length < 4) return false;
    const epsilon = 1e-9;
    const cross = (a, b, c) =>
      (Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(a[1])) -
      (Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(a[0]));
    const onSegment = (point, start, end) => {
      if (Math.abs(cross(start, end, point)) > epsilon) return false;
      return Number(point[0]) >= Math.min(Number(start[0]), Number(end[0])) - epsilon &&
        Number(point[0]) <= Math.max(Number(start[0]), Number(end[0])) + epsilon &&
        Number(point[1]) >= Math.min(Number(start[1]), Number(end[1])) - epsilon &&
        Number(point[1]) <= Math.max(Number(start[1]), Number(end[1])) + epsilon;
    };
    const intersects = (a1, a2, b1, b2) => {
      const c1 = cross(a1, a2, b1), c2 = cross(a1, a2, b2);
      const c3 = cross(b1, b2, a1), c4 = cross(b1, b2, a2);
      if (((c1 > epsilon && c2 < -epsilon) || (c1 < -epsilon && c2 > epsilon)) &&
          ((c3 > epsilon && c4 < -epsilon) || (c3 < -epsilon && c4 > epsilon))) return true;
      return (Math.abs(c1) <= epsilon && onSegment(b1, a1, a2)) ||
        (Math.abs(c2) <= epsilon && onSegment(b2, a1, a2)) ||
        (Math.abs(c3) <= epsilon && onSegment(a1, b1, b2)) ||
        (Math.abs(c4) <= epsilon && onSegment(a2, b1, b2));
    };
    const count = points.length;
    for (let first = 0; first < count; first += 1) {
      const firstNext = (first + 1) % count;
      for (let second = first + 1; second < count; second += 1) {
        const secondNext = (second + 1) % count;
        if (first === second || firstNext === second || secondNext === first) continue;
        if (intersects(points[first], points[firstNext], points[second], points[secondNext])) return true;
      }
    }
    return false;
  };

`;
  source = replaceExact(source, helperAnchor, helpers + helperAnchor, "gate geometry helpers");

  source = replaceExact(
    source,
    `  const editorHint19 = (editor) => {
    if (!editor) return "";
    if (editor.creating && editor.points.length < 3) return "Tap the map to add at least 3 corner points.";
    return "Drag corner points. Tap + on an edge to add another point.";
  };`,
    `  const editorHint19 = (editor) => {
    if (!editor) return "";
    if (editor.creating && editor.points.length < 3) return "Tap the map to add the first 3 corner points.";
    if (polygonSelfIntersects20(editor.points)) return "Polygon edges cross. Move a corner until the shape no longer intersects itself.";
    return "Drag corners. Tap near an edge or use + to insert another point.";
  };`,
    "editor hint",
  );

  source = replaceExact(
    source,
    `    const color = esc19(card?._config?.gate_area_color || "#8e24aa");\n    const parts = [];`,
    `    const invalidGeometry = polygonSelfIntersects20(editor.points);\n    const color = esc19(invalidGeometry ? "var(--error-color,#db4437)" : (card?._config?.gate_area_color || "#8e24aa"));\n    const parts = [];`,
    "invalid polygon preview",
  );

  source = replaceExact(
    source,
    `    const selected = Number.isInteger(editor.selected) && editor.selected >= 0 && editor.selected < editor.points.length ? editor.points[editor.selected] : null;
    if (meta) meta.textContent = editor.points.length + " points" + (selected ? " · X " + selected[0].toFixed(2) + " · Y " + selected[1].toFixed(2) : "");
    if (hint) hint.textContent = editorHint19(editor);
    if (status) {
      status.textContent = editor.status || "";
      status.className = "nm-gate19-status " + (editor.statusKind || "");
    }
    if (save) save.disabled = editor.busy || editor.points.length < 3 || !String(editor.name || "").trim();`,
    `    const selected = Number.isInteger(editor.selected) && editor.selected >= 0 && editor.selected < editor.points.length ? editor.points[editor.selected] : null;
    const invalidGeometry = polygonSelfIntersects20(editor.points);
    if (meta) meta.textContent = editor.points.length + " points" + (selected ? " · X " + selected[0].toFixed(2) + " · Y " + selected[1].toFixed(2) : "");
    if (hint) hint.textContent = editorHint19(editor);
    if (status) {
      status.textContent = editor.status || (invalidGeometry ? "Fix crossing edges before saving." : "");
      status.className = "nm-gate19-status " + (editor.statusKind || (invalidGeometry ? "error" : ""));
    }
    if (save) save.disabled = editor.busy || editor.points.length < 3 || invalidGeometry || !String(editor.name || "").trim();`,
    "save geometry guard",
  );

  source = replaceExact(
    source,
    `    if (editor.points.length > MAX_POINTS) {
      editor.status = "A gate area can contain at most " + MAX_POINTS + " points.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    if (editor.target.mode === "multi" && !editor.target.deviceId) {`,
    `    if (editor.points.length > MAX_POINTS) {
      editor.status = "A gate area can contain at most " + MAX_POINTS + " points.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    if (polygonSelfIntersects20(editor.points)) {
      editor.status = "Polygon edges must not cross.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    if (editor.target.mode === "multi" && !editor.target.deviceId) {`,
    "save self-intersection validation",
  );

  source = replaceExact(
    source,
    `    if (editor.creating && local && editor.points.length < MAX_POINTS) {
      editor.points.push(local);
      editor.selected = editor.points.length - 1;
      editor.confirmDelete = false;
      renderOverlay19(card);
      updatePanelState19(card);
    }`,
    `    if (!local || editor.points.length >= MAX_POINTS) return;

    if (editor.creating && editor.points.length < 3) {
      editor.points.push(local);
      editor.selected = editor.points.length - 1;
      editor.confirmDelete = false;
      editor.status = "";
      editor.statusKind = "";
      renderOverlay19(card);
      updatePanelState19(card);
      return;
    }

    if (editor.points.length >= 3) {
      const nearest = nearestEdge20(card, editor, event.clientX, event.clientY);
      if (!nearest) {
        editor.status = "Tap near an existing edge or use + to add another point.";
        editor.statusKind = "warning";
        updatePanelState19(card);
        return;
      }
      const index = nearest.index + 1;
      editor.points.splice(index, 0, local);
      editor.selected = index;
      editor.confirmDelete = false;
      editor.status = "";
      editor.statusKind = "";
      renderOverlay19(card);
      updatePanelState19(card);
    }`,
    "edge-aware map click insertion",
  );

  source += `\n${BETA20_MARKER}\nconsole.info("[Navimower Map Card] 0.3.6-beta20 edge-aware gate-area editing enabled");\n`;
  return source;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
  const before = await readFile(sourcePath, "utf8");
  const after = applyBeta20Patch(before);
  if (after !== before) {
    await writeFile(sourcePath, after, "utf8");
    console.log("Applied 0.3.6-beta20 edge-aware gate-area editing");
  } else {
    console.log("0.3.6-beta20 gate-area editing already applied");
  }
}
