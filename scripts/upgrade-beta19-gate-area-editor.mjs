import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BETA19_MARKER = "// 0.3.6-beta19: visual gate-area polygon editor.";
const BETA18_MARKER = "// 0.3.6-beta18: exact polygon gate-area rendering in Single and Multi mower views.";

export function applyBeta19Patch(input) {
  const source = String(input || "");
  if (source.includes(BETA19_MARKER)) return source;
  if (!source.includes(BETA18_MARKER)) {
    throw new Error("0.3.6-beta19 requires the beta18 polygon gate-area runtime");
  }

  const patch = String.raw`

// 0.3.6-beta19: visual gate-area polygon editor.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower036Beta19GateEditor) return;
  Card.__navimower036Beta19GateEditor = true;

  const proto = Card.prototype;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MAX_POINTS = 64;

  const esc19 = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const finite19 = (value, fallback = null) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const round19 = (value) => Math.round(Number(value) * 1000) / 1000;
  const roundPoint19 = (point) => [round19(point[0]), round19(point[1])];

  const slug19 = (value) => {
    const slug = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug || "channel";
  };

  const normalizePolygon19 = (raw) => (Array.isArray(raw) ? raw : [])
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])])
    .filter((point) => point.every(Number.isFinite));

  const rectanglePolygon19 = (area) => {
    const x1 = finite19(area?.x_min), x2 = finite19(area?.x_max);
    const y1 = finite19(area?.y_min), y2 = finite19(area?.y_max);
    if ([x1, x2, y1, y2].some((value) => value === null)) return [];
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
  };

  const areaPolygon19 = (area) => {
    const polygon = normalizePolygon19(area?.polygon);
    return polygon.length >= 3 ? polygon : rectanglePolygon19(area);
  };

  const gateAreas19 = (payload) => Array.isArray(payload?.gate_areas) ? payload.gate_areas : [];

  const multiActive19 = (card) => Boolean(
    card?._config?.multi_mower &&
    card?._multi036Site?.multi_mower &&
    Array.isArray(card?._multi036Site?.members) &&
    card._multi036Site.members.length >= 2 &&
    card?._multi036Layer &&
    card._multi036Layer.style.display !== "none"
  );

  const singleEntryId19 = (card) => String(card?._mapPayload?.frontend?.entry_id || "single");

  const targets19 = (card) => {
    if (multiActive19(card)) {
      return (card._multi036Site?.members || []).map((member) => {
        const entryId = String(member?.entry_id || "");
        const state = card._multi036Members instanceof Map ? card._multi036Members.get(entryId) : null;
        const frontend = member?.frontend || {};
        return {
          mode: "multi",
          key: "multi:" + entryId,
          entryId,
          member,
          name: String(member?.name || member?.model || "Mower"),
          deviceId: frontend.device_id || null,
          mapPath: frontend.map_api_path || member?.map_api_path || null,
          payload: state?.map || null,
        };
      }).filter((target) => target.entryId && target.payload);
    }
    if (!card?._mapPayload) return [];
    return [{
      mode: "single",
      key: "single:" + singleEntryId19(card),
      entryId: singleEntryId19(card),
      member: null,
      name: String(card._mapPayload?.frontend?.name || card._mapPayload?.model || "Mower"),
      deviceId: card._mapPayload?.frontend?.device_id || card._deviceId || null,
      mapPath: card._mapPayload?.frontend?.map_api_path || card._apiPath?.() || null,
      payload: card._mapPayload,
    }];
  };

  const currentPayload19 = (card, target) => {
    if (!target) return null;
    if (target.mode === "multi") {
      const state = card._multi036Members instanceof Map ? card._multi036Members.get(String(target.entryId)) : null;
      return state?.map || target.payload || null;
    }
    return card._mapPayload || target.payload || null;
  };

  const memberGroup19 = (card, entryId) => {
    const groups = card?._multi036Layer?.querySelectorAll?.(".nm-multi-member-map") || [];
    return Array.from(groups).find((group) => String(group?.dataset?.entryId || "") === String(entryId)) || null;
  };

  const rootPoint19 = (card, clientX, clientY) => {
    const svg = card?._svgEl;
    if (!svg) return null;
    try {
      const matrix = svg.getScreenCTM?.();
      if (matrix && typeof DOMPoint === "function") {
        const point = new DOMPoint(Number(clientX), Number(clientY)).matrixTransform(matrix.inverse());
        return [point.x, point.y];
      }
    } catch (_error) { /* fall through to viewBox math */ }
    const rect = svg.getBoundingClientRect?.();
    const viewBox = svg.viewBox?.baseVal;
    if (!rect || !viewBox || !rect.width || !rect.height) return null;
    return [
      viewBox.x + (Number(clientX) - rect.left) / rect.width * viewBox.width,
      viewBox.y + (Number(clientY) - rect.top) / rect.height * viewBox.height,
    ];
  };

  const localToRoot19 = (card, target, point) => {
    if (!target || !Array.isArray(point)) return null;
    const x = Number(point[0]), y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (target.mode !== "multi") {
      const layout = card?._layout;
      if (!layout?.sx || !layout?.sy) return null;
      return [layout.sx(x), layout.sy(y)];
    }
    const group = memberGroup19(card, target.entryId);
    const svg = card?._svgEl;
    if (!group || !svg || typeof DOMPoint !== "function") return null;
    try {
      const groupScreen = group.getScreenCTM?.();
      const svgScreen = svg.getScreenCTM?.();
      if (!groupScreen || !svgScreen) return null;
      const screen = new DOMPoint(x, y).matrixTransform(groupScreen);
      const root = screen.matrixTransform(svgScreen.inverse());
      return [root.x, root.y];
    } catch (_error) {
      return null;
    }
  };

  const screenToLocal19 = (card, target, clientX, clientY) => {
    if (!target) return null;
    if (target.mode === "multi") {
      const group = memberGroup19(card, target.entryId);
      if (!group || typeof DOMPoint !== "function") return null;
      try {
        const matrix = group.getScreenCTM?.();
        if (!matrix) return null;
        const local = new DOMPoint(Number(clientX), Number(clientY)).matrixTransform(matrix.inverse());
        return roundPoint19([local.x, local.y]);
      } catch (_error) {
        return null;
      }
    }
    const root = rootPoint19(card, clientX, clientY);
    const layout = card?._layout;
    if (!root || !layout?.sx || !layout?.sy) return null;
    const sx0 = Number(layout.sx(0)), sx1 = Number(layout.sx(1));
    const sy0 = Number(layout.sy(0)), sy1 = Number(layout.sy(1));
    const dx = sx1 - sx0, dy = sy1 - sy0;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) return null;
    return roundPoint19([(root[0] - sx0) / dx, (root[1] - sy0) / dy]);
  };

  const rootUnitsPerPixel19 = (card) => {
    const svg = card?._svgEl;
    const rect = svg?.getBoundingClientRect?.();
    const viewBox = svg?.viewBox?.baseVal;
    if (!rect?.width || !viewBox?.width) return 1;
    return viewBox.width / rect.width;
  };

  const defaultName19 = (payload) => {
    const used = new Set(gateAreas19(payload).map((area) => slug19(area?.name || area?.slug)));
    if (!used.has("gate_area")) return "Gate area";
    for (let index = 2; index < 100; index += 1) {
      if (!used.has("gate_area_" + index)) return "Gate area " + index;
    }
    return "Gate area " + Date.now();
  };

  const areaId19 = (area) => String(area?.slug || slug19(area?.name || "Gate area"));

  const editorRecord19 = (editor) => {
    const points = editor.points.map(roundPoint19);
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      name: editor.name.trim(),
      slug: slug19(editor.name),
      x_min: Math.min(...xs),
      x_max: Math.max(...xs),
      y_min: Math.min(...ys),
      y_max: Math.max(...ys),
      polygon: points,
    };
  };

  const applyLocalWrite19 = (card, editor, deleting = false) => {
    const target = editor?.target;
    const payload = currentPayload19(card, target);
    if (!payload) return;
    const existing = gateAreas19(payload).map((item) => ({ ...item }));
    const matchId = String(editor.areaId || "");
    const index = matchId ? existing.findIndex((area) => areaId19(area) === matchId) : -1;
    if (deleting) {
      if (index >= 0) existing.splice(index, 1);
    } else {
      const record = editorRecord19(editor);
      if (index >= 0) existing[index] = record;
      else existing.push(record);
    }
    const nextPayload = { ...payload, gate_areas: existing };

    if (target.mode === "multi") {
      if (card._multi036Members instanceof Map) {
        const state = card._multi036Members.get(String(target.entryId));
        if (state) {
          state.map = nextPayload;
          state.mapAt = Date.now();
        }
      }
      if (String(card?._mapPayload?.frontend?.entry_id || "") === String(target.entryId)) {
        card._mapPayload = nextPayload;
      }
      card._multi036MapRenderKey = null;
      card._applyViewBox?.();
      return;
    }

    card._mapPayload = nextPayload;
    card._mapStaticSignature = card._payloadStaticSignature?.(nextPayload) || null;
    card._staticRenderKey = null;
    card._layout = null;
    card._buildLayout?.();
    card._renderStatic?.();
  };

  const editorHint19 = (editor) => {
    if (!editor) return "";
    if (editor.creating && editor.points.length < 3) return "Tap the map to add at least 3 corner points.";
    return "Drag corner points. Tap + on an edge to add another point.";
  };

  function renderOverlay19(card) {
    const layer = card?._gate19Layer;
    const editor = card?._gate19Editor;
    if (!layer) return;
    if (!editor) {
      layer.innerHTML = "";
      layer.style.display = "none";
      return;
    }
    layer.style.display = "";
    const rootPoints = editor.points.map((point) => localToRoot19(card, editor.target, point));
    if (rootPoints.some((point) => !point || !point.every(Number.isFinite))) {
      layer.innerHTML = "";
      return;
    }
    const unit = rootUnitsPerPixel19(card);
    const vertexRadius = Math.max(3 * unit, 7 * unit);
    const midpointRadius = Math.max(3 * unit, 6 * unit);
    const pointString = rootPoints.map((point) => point[0].toFixed(2) + "," + point[1].toFixed(2)).join(" ");
    const color = esc19(card?._config?.gate_area_color || "#8e24aa");
    const parts = [];
    if (rootPoints.length >= 3) {
      parts.push('<polygon class="nm-gate19-preview" points="' + pointString + '" fill="' + color + '" fill-opacity=".22" stroke="' + color + '" stroke-width="3" stroke-dasharray="10 6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>');
    } else if (rootPoints.length >= 2) {
      parts.push('<polyline class="nm-gate19-preview" points="' + pointString + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-dasharray="10 6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>');
    }

    if (rootPoints.length >= 3 && rootPoints.length < MAX_POINTS) {
      rootPoints.forEach((point, index) => {
        const next = rootPoints[(index + 1) % rootPoints.length];
        const mx = (point[0] + next[0]) / 2;
        const my = (point[1] + next[1]) / 2;
        parts.push('<g class="nm-gate19-midpoint" data-gate19-midpoint="' + index + '" tabindex="0" role="button" aria-label="Add gate-area point"><circle cx="' + mx.toFixed(2) + '" cy="' + my.toFixed(2) + '" r="' + midpointRadius.toFixed(2) + '" fill="var(--card-background-color,#fff)" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="' + mx.toFixed(2) + '" y="' + my.toFixed(2) + '" text-anchor="middle" dominant-baseline="central" font-size="' + (11 * unit).toFixed(2) + '" font-weight="800" fill="' + color + '" pointer-events="none">+</text></g>');
      });
    }

    rootPoints.forEach((point, index) => {
      const selected = Number(editor.selected) === index;
      parts.push('<circle class="nm-gate19-vertex' + (selected ? ' selected' : '') + '" data-gate19-vertex="' + index + '" cx="' + point[0].toFixed(2) + '" cy="' + point[1].toFixed(2) + '" r="' + vertexRadius.toFixed(2) + '" fill="' + (selected ? '#FF5A00' : color) + '" stroke="var(--card-background-color,#fff)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>');
    });
    layer.innerHTML = parts.join("");
  }

  function updatePanelState19(card) {
    const panel = card?._gate19Panel;
    const editor = card?._gate19Editor;
    if (!panel || !editor) return;
    const meta = panel.querySelector("[data-gate19-meta]");
    const hint = panel.querySelector("[data-gate19-hint]");
    const status = panel.querySelector("[data-gate19-status]");
    const save = panel.querySelector("[data-gate19-save]");
    const remove = panel.querySelector("[data-gate19-remove]");
    const deletion = panel.querySelector("[data-gate19-delete]");
    const selected = Number.isInteger(editor.selected) && editor.selected >= 0 && editor.selected < editor.points.length ? editor.points[editor.selected] : null;
    if (meta) meta.textContent = editor.points.length + " points" + (selected ? " · X " + selected[0].toFixed(2) + " · Y " + selected[1].toFixed(2) : "");
    if (hint) hint.textContent = editorHint19(editor);
    if (status) {
      status.textContent = editor.status || "";
      status.className = "nm-gate19-status " + (editor.statusKind || "");
    }
    if (save) save.disabled = editor.busy || editor.points.length < 3 || !String(editor.name || "").trim();
    if (remove) remove.disabled = editor.busy || !selected || editor.points.length <= 3;
    if (deletion) {
      deletion.disabled = editor.busy;
      deletion.textContent = editor.confirmDelete ? "Confirm delete" : "Delete area";
    }
  }

  function renderPanel19(card) {
    const panel = card?._gate19Panel;
    const editor = card?._gate19Editor;
    if (!panel) return;
    if (!editor) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    panel.hidden = false;
    panel.innerHTML =
      '<div class="nm-gate19-panel-head"><div class="nm-gate19-panel-title">' + (editor.creating ? 'Add gate area' : 'Edit gate area') + '</div><div class="nm-gate19-meta" data-gate19-meta></div></div>' +
      '<label class="nm-gate19-name"><span>Name</span><input type="text" maxlength="64" data-gate19-name value="' + esc19(editor.name) + '"></label>' +
      '<div class="nm-gate19-hint" data-gate19-hint></div>' +
      '<div class="nm-gate19-status" data-gate19-status aria-live="polite"></div>' +
      '<div class="nm-gate19-actions">' +
        '<button type="button" class="secondary" data-gate19-remove><ha-icon icon="mdi:minus-circle-outline"></ha-icon><span>Remove point</span></button>' +
        (editor.areaId ? '<button type="button" class="danger" data-gate19-delete>Delete area</button>' : '') +
        '<span class="nm-gate19-spacer"></span>' +
        '<button type="button" class="secondary" data-gate19-cancel>Cancel</button>' +
        '<button type="button" class="primary" data-gate19-save>Save</button>' +
      '</div>';

    panel.querySelector("[data-gate19-name]")?.addEventListener("input", (event) => {
      editor.name = String(event.target?.value || "");
      editor.confirmDelete = false;
      updatePanelState19(card);
    });
    panel.querySelector("[data-gate19-cancel]")?.addEventListener("click", () => closeEditor19(card));
    panel.querySelector("[data-gate19-remove]")?.addEventListener("click", () => {
      if (!Number.isInteger(editor.selected) || editor.points.length <= 3 || editor.busy) return;
      editor.points.splice(editor.selected, 1);
      editor.selected = null;
      editor.confirmDelete = false;
      renderOverlay19(card);
      updatePanelState19(card);
    });
    panel.querySelector("[data-gate19-save]")?.addEventListener("click", () => { void saveEditor19(card); });
    panel.querySelector("[data-gate19-delete]")?.addEventListener("click", () => {
      if (editor.busy) return;
      if (!editor.confirmDelete) {
        editor.confirmDelete = true;
        editor.status = "Tap Confirm delete again to remove this gate area.";
        editor.statusKind = "warning";
        updatePanelState19(card);
        return;
      }
      void deleteEditor19(card);
    });
    updatePanelState19(card);
  }

  function startEditor19(card, target, area = null) {
    if (!target) return;
    const polygon = area ? areaPolygon19(area) : [];
    card._gate19Editor = {
      target: { ...target },
      areaId: area ? areaId19(area) : null,
      name: area ? String(area.name || "Gate area") : defaultName19(currentPayload19(card, target)),
      points: polygon.map(roundPoint19),
      creating: !area,
      selected: null,
      busy: false,
      status: "",
      statusKind: "",
      confirmDelete: false,
    };
    card._gate19Drag = null;
    if (card._gate19Menu) card._gate19Menu.hidden = true;
    card._gate19Button?.classList?.add?.("active");
    card._svgEl?.classList?.add?.("nm-gate19-editing");
    if (card._zoneInfoEl) card._zoneInfoEl.hidden = true;
    renderPanel19(card);
    renderOverlay19(card);
  }

  function closeEditor19(card) {
    card._gate19Editor = null;
    card._gate19Drag = null;
    card._gate19Button?.classList?.remove?.("active");
    card._svgEl?.classList?.remove?.("nm-gate19-editing");
    if (card._gate19Panel) {
      card._gate19Panel.hidden = true;
      card._gate19Panel.innerHTML = "";
    }
    renderOverlay19(card);
  }

  function renderMenu19(card) {
    const menu = card?._gate19Menu;
    if (!menu) return;
    const targets = targets19(card);
    card._gate19Targets = targets;
    if (!targets.length) {
      menu.innerHTML = '<div class="nm-gate19-menu-title">Gate areas</div><div class="nm-gate19-empty">Waiting for map data…</div>';
      return;
    }
    const multi = targets.length > 1 || multiActive19(card);
    const groups = targets.map((target, targetIndex) => {
      const areas = gateAreas19(currentPayload19(card, target));
      const areaButtons = areas.map((area, areaIndex) =>
        '<button type="button" class="nm-gate19-menu-item" data-gate19-edit="' + areaIndex + '" data-gate19-target="' + targetIndex + '"><ha-icon icon="mdi:vector-polygon"></ha-icon><span>' + esc19(area?.name || "Gate area") + '</span></button>'
      ).join("");
      return '<div class="nm-gate19-group">' +
        (multi ? '<div class="nm-gate19-group-title">' + esc19(target.name) + '</div>' : '') +
        '<button type="button" class="nm-gate19-menu-item add" data-gate19-add="1" data-gate19-target="' + targetIndex + '"><ha-icon icon="mdi:plus"></ha-icon><span>Add gate area</span></button>' +
        areaButtons +
      '</div>';
    }).join("");
    menu.innerHTML = '<div class="nm-gate19-menu-title">Gate areas</div>' + groups;
  }

  async function saveEditor19(card) {
    const editor = card?._gate19Editor;
    if (!editor || editor.busy) return;
    editor.name = String(editor.name || "").trim();
    if (!editor.name || editor.points.length < 3) {
      editor.status = "Name and at least 3 points are required.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    if (editor.points.length > MAX_POINTS) {
      editor.status = "A gate area can contain at most " + MAX_POINTS + " points.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    if (editor.target.mode === "multi" && !editor.target.deviceId) {
      editor.status = "Mower device ID is unavailable. Refresh the map and try again.";
      editor.statusKind = "error";
      updatePanelState19(card);
      return;
    }
    editor.busy = true;
    editor.status = "Saving…";
    editor.statusKind = "saving";
    editor.confirmDelete = false;
    updatePanelState19(card);
    const data = {
      name: editor.name,
      polygon: editor.points.map(roundPoint19),
    };
    if (editor.areaId) data.gate_area_id = editor.areaId;
    if (editor.target.deviceId) data.device_id = editor.target.deviceId;
    try {
      await card._hass.callService("navimower", "set_gate_area", data);
      applyLocalWrite19(card, editor, false);
      closeEditor19(card);
    } catch (error) {
      editor.busy = false;
      editor.status = "Save failed: " + String(error?.message || error || "Unknown error");
      editor.statusKind = "error";
      updatePanelState19(card);
    }
  }

  async function deleteEditor19(card) {
    const editor = card?._gate19Editor;
    if (!editor?.areaId || editor.busy) return;
    if (editor.target.mode === "multi" && !editor.target.deviceId) {
      editor.status = "Mower device ID is unavailable. Refresh the map and try again.";
      editor.statusKind = "error";
      editor.confirmDelete = false;
      updatePanelState19(card);
      return;
    }
    editor.busy = true;
    editor.status = "Deleting…";
    editor.statusKind = "saving";
    updatePanelState19(card);
    const data = { gate_area_id: editor.areaId };
    if (editor.target.deviceId) data.device_id = editor.target.deviceId;
    try {
      await card._hass.callService("navimower", "delete_gate_area", data);
      applyLocalWrite19(card, editor, true);
      closeEditor19(card);
    } catch (error) {
      editor.busy = false;
      editor.confirmDelete = false;
      editor.status = "Delete failed: " + String(error?.message || error || "Unknown error");
      editor.statusKind = "error";
      updatePanelState19(card);
    }
  }

  function handlePointerDown19(card, event) {
    const editor = card?._gate19Editor;
    if (!editor || editor.busy) return;
    const vertex = event.target?.closest?.("[data-gate19-vertex]");
    const midpoint = event.target?.closest?.("[data-gate19-midpoint]");
    const local = screenToLocal19(card, editor.target, event.clientX, event.clientY);
    event.preventDefault();
    event.stopImmediatePropagation();

    if (midpoint && editor.points.length >= 3 && editor.points.length < MAX_POINTS) {
      const edge = Number(midpoint.dataset.gate19Midpoint);
      if (!Number.isInteger(edge) || edge < 0 || edge >= editor.points.length) return;
      const a = editor.points[edge];
      const b = editor.points[(edge + 1) % editor.points.length];
      const point = roundPoint19([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      const index = edge + 1;
      editor.points.splice(index, 0, point);
      editor.selected = index;
      editor.confirmDelete = false;
      card._gate19Drag = { pointerId: event.pointerId, index };
      try { card._svgEl?.setPointerCapture?.(event.pointerId); } catch (_error) { /* optional */ }
      renderOverlay19(card);
      updatePanelState19(card);
      return;
    }

    if (vertex) {
      const index = Number(vertex.dataset.gate19Vertex);
      if (!Number.isInteger(index) || index < 0 || index >= editor.points.length) return;
      editor.selected = index;
      editor.confirmDelete = false;
      card._gate19Drag = { pointerId: event.pointerId, index };
      try { card._svgEl?.setPointerCapture?.(event.pointerId); } catch (_error) { /* optional */ }
      renderOverlay19(card);
      updatePanelState19(card);
      return;
    }

    if (editor.creating && local && editor.points.length < MAX_POINTS) {
      editor.points.push(local);
      editor.selected = editor.points.length - 1;
      editor.confirmDelete = false;
      renderOverlay19(card);
      updatePanelState19(card);
    }
  }

  function handlePointerMove19(card, event) {
    const editor = card?._gate19Editor;
    const drag = card?._gate19Drag;
    if (!editor || !drag || drag.pointerId !== event.pointerId || editor.busy) return;
    const local = screenToLocal19(card, editor.target, event.clientX, event.clientY);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!local || drag.index < 0 || drag.index >= editor.points.length) return;
    editor.points[drag.index] = local;
    editor.selected = drag.index;
    editor.confirmDelete = false;
    renderOverlay19(card);
    updatePanelState19(card);
  }

  function handlePointerUp19(card, event) {
    const editor = card?._gate19Editor;
    if (!editor) return;
    const drag = card?._gate19Drag;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (drag?.pointerId === event.pointerId) {
      card._gate19Drag = null;
      try { card._svgEl?.releasePointerCapture?.(event.pointerId); } catch (_error) { /* optional */ }
      updatePanelState19(card);
    }
  }

  function ensureUi19(card) {
    if (!card?._domReady || typeof document === "undefined") return;
    const wrap = card.querySelector?.(".nm-wrap");
    if (!wrap || !card._svgEl) return;

    if (!card._gate19Button) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nm-gate19-button";
      button.setAttribute("aria-label", "Edit gate areas");
      button.setAttribute("title", "Edit gate areas");
      button.innerHTML = '<ha-icon icon="mdi:pencil"></ha-icon>';
      wrap.appendChild(button);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (card._gate19Editor) return;
        renderMenu19(card);
        card._gate19Menu.hidden = !card._gate19Menu.hidden;
        button.classList.toggle("active", !card._gate19Menu.hidden);
      });
      card._gate19Button = button;
    }

    if (!card._gate19Menu) {
      const menu = document.createElement("div");
      menu.className = "nm-gate19-menu";
      menu.hidden = true;
      wrap.appendChild(menu);
      menu.addEventListener("click", (event) => {
        const add = event.target?.closest?.("[data-gate19-add]");
        const edit = event.target?.closest?.("[data-gate19-edit]");
        const button = add || edit;
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const target = card._gate19Targets?.[Number(button.dataset.gate19Target)];
        if (!target) return;
        if (add) {
          startEditor19(card, target, null);
          return;
        }
        const payload = currentPayload19(card, target);
        const area = gateAreas19(payload)[Number(button.dataset.gate19Edit)];
        if (area) startEditor19(card, target, area);
      });
      card._gate19Menu = menu;
    }

    if (!card._gate19Panel) {
      const panel = document.createElement("div");
      panel.className = "nm-gate19-panel";
      panel.hidden = true;
      wrap.appendChild(panel);
      card._gate19Panel = panel;
    }

    if (!card._gate19Layer) {
      const layer = document.createElementNS(SVG_NS, "g");
      layer.setAttribute("class", "nm-gate19-layer");
      layer.style.display = "none";
      card._svgEl.appendChild(layer);
      card._gate19Layer = layer;
    } else if (card._gate19Layer.parentNode !== card._svgEl) {
      card._svgEl.appendChild(card._gate19Layer);
    } else {
      card._svgEl.appendChild(card._gate19Layer);
    }

    if (!card._gate19PointerBound) {
      card._gate19PointerBound = true;
      card._svgEl.addEventListener("pointerdown", (event) => handlePointerDown19(card, event), true);
      card._svgEl.addEventListener("pointermove", (event) => handlePointerMove19(card, event), true);
      card._svgEl.addEventListener("pointerup", (event) => handlePointerUp19(card, event), true);
      card._svgEl.addEventListener("pointercancel", (event) => handlePointerUp19(card, event), true);
      card.addEventListener("pointerdown", (event) => {
        if (!card._gate19Menu || card._gate19Menu.hidden || card._gate19Editor) return;
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (path.includes(card._gate19Menu) || path.includes(card._gate19Button)) return;
        card._gate19Menu.hidden = true;
        card._gate19Button?.classList?.remove?.("active");
      }, true);
    }

    if (!card._gate19Styles) {
      const style = document.createElement("style");
      style.dataset.gateEditor19 = "true";
      style.textContent = [
        ".nm-gate19-button{position:absolute;top:10px;right:10px;z-index:8;width:40px;height:40px;display:grid;place-items:center;padding:0;border:1px solid color-mix(in srgb,var(--divider-color) 75%,transparent);border-radius:50%;cursor:pointer;color:var(--primary-text-color);background:color-mix(in srgb,var(--card-background-color,#fff) 88%,transparent);box-shadow:0 2px 8px rgba(0,0,0,.22);backdrop-filter:blur(5px)}",
        ".nm-gate19-button:hover,.nm-gate19-button:focus-visible,.nm-gate19-button.active{color:#8e24aa;background:color-mix(in srgb,var(--card-background-color,#fff) 94%,#8e24aa 6%);outline:none}.nm-gate19-button ha-icon{--mdc-icon-size:21px}",
        ".nm-gate19-menu{position:absolute;top:56px;right:10px;z-index:8;width:min(270px,calc(100% - 20px));max-height:min(58%,360px);overflow:auto;padding:8px;border:1px solid var(--divider-color);border-radius:12px;color:var(--primary-text-color);background:color-mix(in srgb,var(--card-background-color,#fff) 94%,transparent);box-shadow:0 4px 18px rgba(0,0,0,.28);backdrop-filter:blur(7px)}.nm-gate19-menu[hidden]{display:none}",
        ".nm-gate19-menu-title{padding:5px 8px 7px;font-size:.86rem;font-weight:750}.nm-gate19-group+.nm-gate19-group{margin-top:7px;padding-top:7px;border-top:1px solid var(--divider-color)}.nm-gate19-group-title{padding:3px 8px;color:var(--secondary-text-color);font-size:.74rem;font-weight:750;text-transform:uppercase}",
        ".nm-gate19-menu-item{width:100%;min-height:38px;display:flex;align-items:center;gap:9px;padding:7px 9px;border:0;border-radius:9px;cursor:pointer;text-align:left;color:var(--primary-text-color);background:transparent;font:inherit;font-size:.86rem}.nm-gate19-menu-item:hover,.nm-gate19-menu-item:focus-visible{background:var(--secondary-background-color);outline:none}.nm-gate19-menu-item.add{color:#8e24aa;font-weight:700}.nm-gate19-menu-item ha-icon{--mdc-icon-size:19px}.nm-gate19-empty{padding:10px 8px;color:var(--secondary-text-color);font-size:.82rem}",
        ".nm-gate19-panel{position:absolute;left:10px;right:10px;bottom:10px;z-index:9;padding:11px;border:1px solid var(--divider-color);border-radius:12px;color:var(--primary-text-color);background:color-mix(in srgb,var(--card-background-color,#fff) 95%,transparent);box-shadow:0 4px 18px rgba(0,0,0,.30);backdrop-filter:blur(7px)}.nm-gate19-panel[hidden]{display:none}",
        ".nm-gate19-panel-head{display:flex;align-items:baseline;gap:10px}.nm-gate19-panel-title{flex:1;font-size:.92rem;font-weight:750}.nm-gate19-meta{color:var(--secondary-text-color);font-size:.72rem;white-space:nowrap}.nm-gate19-name{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;margin-top:8px;color:var(--secondary-text-color);font-size:.76rem}.nm-gate19-name input{min-width:0;height:34px;box-sizing:border-box;padding:6px 9px;border:1px solid var(--divider-color);border-radius:8px;color:var(--primary-text-color);background:var(--secondary-background-color);font:inherit}",
        ".nm-gate19-hint{margin-top:7px;color:var(--secondary-text-color);font-size:.73rem;line-height:1.3}.nm-gate19-status{min-height:0;margin-top:5px;font-size:.73rem}.nm-gate19-status:empty{display:none}.nm-gate19-status.error{color:var(--error-color,#db4437)}.nm-gate19-status.saving{color:var(--primary-color)}.nm-gate19-status.warning{color:#f57c00}",
        ".nm-gate19-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}.nm-gate19-actions button{min-height:34px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:6px 10px;border:0;border-radius:8px;cursor:pointer;font:inherit;font-size:.76rem;font-weight:700}.nm-gate19-actions button:disabled{opacity:.42;cursor:default}.nm-gate19-actions .secondary{color:var(--primary-text-color);background:var(--secondary-background-color)}.nm-gate19-actions .primary{color:var(--text-primary-color,#fff);background:var(--primary-color)}.nm-gate19-actions .danger{color:var(--error-color,#db4437);background:color-mix(in srgb,var(--error-color,#db4437) 10%,transparent)}.nm-gate19-actions ha-icon{--mdc-icon-size:18px}.nm-gate19-spacer{flex:1}",
        ".nm-map.nm-gate19-editing{touch-action:none!important;cursor:crosshair}.nm-gate19-layer{pointer-events:none}.nm-gate19-vertex,.nm-gate19-midpoint{pointer-events:all;cursor:grab;touch-action:none}.nm-gate19-vertex:active,.nm-gate19-midpoint:active{cursor:grabbing}",
        "@media(max-width:520px){.nm-gate19-panel{left:6px;right:6px;bottom:6px;padding:9px}.nm-gate19-actions{gap:5px}.nm-gate19-actions button{padding:6px 8px}.nm-gate19-actions button span{display:none}.nm-gate19-name{grid-template-columns:1fr}.nm-gate19-name span{display:none}.nm-gate19-meta{font-size:.68rem}}"
      ].join("\n");
      card.appendChild(style);
      card._gate19Styles = style;
    }
  }

  const previousEnsure19 = proto._ensureDom;
  if (typeof previousEnsure19 === "function") {
    proto._ensureDom = function beta19EnsureDom(...args) {
      const result = previousEnsure19.apply(this, args);
      ensureUi19(this);
      return result;
    };
  }

  const previousSetConfig19 = proto.setConfig;
  if (typeof previousSetConfig19 === "function") {
    proto.setConfig = function beta19SetConfig(...args) {
      if (this._gate19Editor) closeEditor19(this);
      const result = previousSetConfig19.apply(this, args);
      ensureUi19(this);
      return result;
    };
  }

  for (const method of ["_renderStatic", "_applyStaticLayers", "_applyViewBox"]) {
    const previous = proto[method];
    if (typeof previous !== "function") continue;
    proto[method] = function beta19GateEditorRefresh(...args) {
      const result = previous.apply(this, args);
      ensureUi19(this);
      renderOverlay19(this);
      return result;
    };
  }

  const previousDisconnect19 = proto.disconnectedCallback;
  proto.disconnectedCallback = function beta19Disconnected(...args) {
    if (this._gate19Editor) closeEditor19(this);
    return previousDisconnect19?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.6-beta19 visual gate-area editor enabled");
})();
`;

  return source + patch;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
  const before = await readFile(sourcePath, "utf8");
  const after = applyBeta19Patch(before);
  if (after !== before) {
    await writeFile(sourcePath, after, "utf8");
    console.log("Applied 0.3.6-beta19 visual gate-area editor");
  } else {
    console.log("0.3.6-beta19 gate-area editor already applied");
  }
}
