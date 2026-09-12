import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BETA21_MARKER = "// 0.3.6-beta21: unrestricted nearest-edge gate-area insertion.";
const BETA20_MARKER = "// 0.3.6-beta20: edge-aware gate-area point insertion and geometry guard.";

const replaceExact = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
};

export function applyBeta21Patch(input) {
  let source = String(input || "");
  if (source.includes(BETA21_MARKER)) return source;
  if (!source.includes(BETA20_MARKER)) {
    throw new Error("0.3.6-beta21 requires the beta20 edge-aware gate-area editor runtime");
  }

  source = replaceExact(
    source,
    "  const EDGE_INSERT_THRESHOLD_PX = 28;\n",
    "",
    "remove gate-area edge distance threshold",
  );

  source = replaceExact(
    source,
    "    return index !== null && distancePx <= EDGE_INSERT_THRESHOLD_PX ? { index, distancePx } : null;",
    "    return index !== null ? { index, distancePx } : null;",
    "always select nearest gate-area edge",
  );

  source = replaceExact(
    source,
    '    return "Drag corners. Tap near an edge or use + to insert another point.";',
    '    return "Drag corners. Tap anywhere to insert another point on the nearest edge, or use +.";',
    "editor insertion hint",
  );

  source = replaceExact(
    source,
    '        editor.status = "Tap near an existing edge or use + to add another point.";\n        editor.statusKind = "warning";',
    '        editor.status = "Could not determine the nearest polygon edge. Try again.";\n        editor.statusKind = "warning";',
    "nearest-edge fallback message",
  );

  source += `\n${BETA21_MARKER}\nconsole.info("[Navimower Map Card] 0.3.6-beta21 unrestricted nearest-edge gate-area insertion enabled");\n`;
  return source;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
  const before = await readFile(sourcePath, "utf8");
  const after = applyBeta21Patch(before);
  if (after !== before) {
    await writeFile(sourcePath, after, "utf8");
    console.log("Applied 0.3.6-beta21 unrestricted nearest-edge gate-area insertion");
  } else {
    console.log("0.3.6-beta21 gate-area insertion refinement already applied");
  }
}
