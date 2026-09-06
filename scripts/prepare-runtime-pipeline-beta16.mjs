import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/navimower-map-card.js", import.meta.url);
let source = await readFile(sourcePath, "utf8");
const startMarker = "function withLightweightMapQuery(path) {";
const endMarker = "\n}\nfunction deriveSessionPaths";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0) {
  throw new Error("Unable to normalize the cumulative lightweight-map helper");
}

const helper = `function withLightweightMapQuery(path) {
  if (!path) return path;
  const text = String(path);
  const separator = text.includes("?") ? "&" : "?";
  return \`\${text}\${separator}include_sessions=0&include_daily_trails=0\`;
}`;
source = source.slice(0, start) + helper + source.slice(end + 2);
await writeFile(sourcePath, source, "utf8");

await import("./upgrade-runtime-pipeline-beta16.mjs");
