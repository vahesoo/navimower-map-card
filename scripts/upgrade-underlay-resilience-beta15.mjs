import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const marker = "// 0.3.6-beta15: single-underlay metadata isolation and null-safe coordinates.";
if (source.includes(marker)) {
  console.log("0.3.6-beta15 underlay resilience already applied");
  process.exit(0);
}
if (!source.includes("// 0.3.6-beta14: manual underlay position and rotation calibration.")) {
  throw new Error("Expected 0.3.6-beta14 runtime was not found");
}

const replaceOnce = (label, before, after) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
};

const nullSafeFinite = (name) => `  const ${name} = (value, fallback = null) => {\n    if (value === null || value === undefined || value === "") return fallback;\n    const parsed = Number(value);\n    return Number.isFinite(parsed) ? parsed : fallback;\n  };`;
for (const name of ["finite", "finite10", "finite11", "finite14"]) {
  replaceOnce(
    `${name} null safety`,
    `  const ${name} = (value, fallback = null) => {\n    const parsed = Number(value);\n    return Number.isFinite(parsed) ? parsed : fallback;\n  };`,
    nullSafeFinite(name),
  );
}

replaceOnce(
  "single underlay metadata isolation",
  `  const frontendUnderlayMetadata = (card) => {\n    const multi = card?._multi036Site?.anchor_frontend?.map_underlays;\n    if (multi && typeof multi === "object") return multi;\n    const single = card?._mapPayload?.frontend?.map_underlays;\n    return single && typeof single === "object" ? single : {};\n  };`,
  `  const frontendUnderlayMetadata = (card) => {\n    const single = card?._mapPayload?.frontend?.map_underlays;\n    const multiVisible = Boolean(card?._multi036Layer && card._multi036Layer.style.display !== "none");\n    if (!multiVisible && single && typeof single === "object") return single;\n    const multi = card?._multi036Site?.anchor_frontend?.map_underlays;\n    if (multi && typeof multi === "object") return multi;\n    return single && typeof single === "object" ? single : {};\n  };`,
);

replaceOnce(
  "single provider frame isolation",
  `  const providerFrontend13 = (card) => card?._multi036Site?.anchor_frontend || card?._mapPayload?.frontend || {};`,
  `  const providerFrontend13 = (card) => {\n    const single = card?._mapPayload?.frontend;\n    const multiVisible = Boolean(card?._multi036Layer && card._multi036Layer.style.display !== "none");\n    if (!multiVisible && single && typeof single === "object") return single;\n    const multi = card?._multi036Site?.anchor_frontend;\n    if (multi && typeof multi === "object") return multi;\n    return single && typeof single === "object" ? single : {};\n  };`,
);

source += `\n\n${marker}\nconsole.info("[Navimower Map Card] 0.3.6-beta15 underlay metadata isolation and null-safe coordinate handling enabled");\n`;

await writeFile(sourcePath, source, "utf8");
console.log("Applied 0.3.6-beta15 underlay resilience");
