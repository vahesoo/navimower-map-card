import { readFileSync } from "node:fs";

const source = readFileSync("src/navimower-map-card.js", "utf8");
const sections = [...source.matchAll(/^\/\/ src\/([^\n]+)$/gm)].map((match) => match[1]);
const patchMarkers = new Set([...source.matchAll(/__navimower[A-Za-z0-9_]+/g)].map((match) => match[0]));
const prototypeAssignments = [...source.matchAll(/(?:Card\.prototype|proto(?:\w+)?)\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g)];
const overrides = new Map();
for (const match of prototypeAssignments) {
  overrides.set(match[1], (overrides.get(match[1]) || 0) + 1);
}
const repeatedOverrides = [...overrides.entries()]
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1]);

const report = {
  source_bytes: Buffer.byteLength(source),
  source_lines: source.split("\n").length,
  source_sections: sections.length,
  patch_markers: patchMarkers.size,
  patch_iifes: (source.match(/\(\(\)\s*=>\s*\{/g) || []).length,
  prototype_function_assignments: prototypeAssignments.length,
  repeatedly_overridden_methods: repeatedOverrides.length,
  console_info_calls: (source.match(/console\.info\(/g) || []).length,
  h2_svg_bytes: Buffer.byteLength(source.match(/var H2_MOWER_SVG = `([\s\S]*?)`;/)?.[1] || ""),
};

console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--details")) {
  console.log("\nRepeated prototype overrides:");
  for (const [name, count] of repeatedOverrides) console.log(`${String(count).padStart(2)}  ${name}`);
}
