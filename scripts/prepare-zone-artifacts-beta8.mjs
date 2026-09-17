import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Patch the cumulative runtime once. Subsequent preparation is byte-stable;
// historical upgrades are not replayed. Missing/ambiguous anchors fail closed.
export async function prepareZoneArtifactsBeta8(source, root) {
  if (source.includes("__navimower037Beta8Artifacts")) return source;
  function once(before, after) {
    const index = source.indexOf(before);
    if (index < 0 || source.indexOf(before, index + before.length) >= 0) throw new Error("Invalid beta8 anchor: " + before.slice(0, 90));
    source = source.slice(0, index) + after + source.slice(index + before.length);
  }
  for (const name of ["queueDeferredCycle", "queueStableCycle"]) {
    const anchor = `  const ${name} = (card) => {`;
    once(anchor, anchor + '\n    if (card._zoneArtifactsHandled?.()) return;');
  }
  once('  async function refreshMemberCurrentCycle036(card, member, generation) {\n    const state = memberState036(card, member.entry_id);',
    '  async function refreshMemberCurrentCycle036(card, member, generation) {\n    const state = memberState036(card, member.entry_id);\n    if (card._zoneArtifactsHandled?.(state.map, member.entry_id)) return;');
  once('      if (state.map?.vendor_trail_debug?.current_cycle_key !== sourceKey) return;',
    '      if (card._zoneArtifactsHandled?.(state.map, member.entry_id)) return;\n      if (state.map?.vendor_trail_debug?.current_cycle_key !== sourceKey) return;');
  once('        const render = payload?.current_cycle_render;\n        if (render?.scope === "current_cycle" && card._mapPayload) {',
    '        if (card._zoneArtifactsHandled?.()) return;\n        const render = payload?.current_cycle_render;\n        if (render?.scope === "current_cycle" && card._mapPayload) {');
  once('        const currentInfo = stableCycleInfo(card?._mapPayload);\n        if (!currentInfo',
    '        if (card._zoneArtifactsHandled?.()) return;\n        const currentInfo = stableCycleInfo(card?._mapPayload);\n        if (!currentInfo');
  once('      const currentInfo = stableCycleInfo(this?._mapPayload);\n      const currentRender',
    '      if (this._zoneArtifactsHandled?.()) return result;\n      const currentInfo = stableCycleInfo(this?._mapPayload);\n      const currentRender');
  once('      return [member.entry_id, payload?.map?.revision, payload?.current_cycle_render?.revision, payload?.trail_revision, liveTrailSignature036(card, member, payload)].join(":");',
    '      card._zoneArtifactsHandled?.(payload, member.entry_id);\n      return [member.entry_id, payload?.map?.revision, card._zoneArtifactsMode?.(member.entry_id), payload?.current_cycle_render?.revision, payload?.trail_revision, liveTrailSignature036(card, member, payload)].join(":");');
  once('      if (!card._multi036SelectedSessionKey && (card._historyDayOffset === null || card._historyDayOffset === undefined)) {\n        const current = payload?.current_cycle_render;\n        if (current?.scope === "current_cycle") {',
    '      if (card._nmBeta8Clients?.has?.(String(member.entry_id))) local.push(\'<g data-nm-artifacts-entry="\' + esc(member.entry_id) + \'" pointer-events="none"></g>\');\n      if (!card._multi036SelectedSessionKey && (card._historyDayOffset === null || card._historyDayOffset === undefined)) {\n        const current = payload?.current_cycle_render;\n        if (!card._zoneArtifactsHandled?.(payload, member.entry_id) && current?.scope === "current_cycle") {');
  once('    layer.innerHTML = parts.join("");\n    card._multi036LiveRenderKey = liveSignature;',
    '    if (card._applyZoneArtifactMultiMarkup) card._applyZoneArtifactMultiMarkup(layer, parts.join(""));\n    else layer.innerHTML = parts.join("");\n    card._drawZoneArtifactMembers?.();\n    card._multi036LiveRenderKey = liveSignature;');
  once('      updateMultiMowers036(card, site, layout, liveSignature);\n      return;',
    '      updateMultiMowers036(card, site, layout, liveSignature);\n      card._drawZoneArtifactMembers?.();\n      return;');
  const multiMarker = '  console.info("[Navimower Map Card] 0.3.6-beta1 opt-in multi-mower site view enabled");';
  once(multiMarker, '  proto._beta8RefreshMultiRender = function() { if (multiActive036(this)) renderMultiMap036(this, true); };\n' + multiMarker);
  const runtime = await readFile(resolve(root, "scripts/runtime-v037-beta8.js.txt"), "utf8");
  return source.trimEnd() + "\n\n" + runtime.trim() + "\n";
}
