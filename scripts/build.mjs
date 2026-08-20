import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");

const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") {
  throw new Error(`src must contain exactly navimower-map-card.js; found: ${sourceJs.join(", ")}`);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.version === "0.3.4-beta1") {
  let runtime = await readFile(source, "utf8");
  if (!runtime.includes("function mowerCuttingWidthMeters034(model)")) {
    const oldVersion = 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.3";';
    const oldWidth = "const width = Math.min(Math.max(0.25 * this._layout.scale, 5), 28);";
    const versionCount = runtime.split(oldVersion).length - 1;
    const widthCount = runtime.split(oldWidth).length - 1;
    if (versionCount !== 1) {
      throw new Error(`Expected one 0.3.3 runtime version marker, found ${versionCount}`);
    }
    if (widthCount !== 3) {
      throw new Error(`Expected three legacy trail-width sites, found ${widthCount}`);
    }
    runtime = runtime.replace(oldVersion, 'var NAVIMOWER_MAP_CARD_VERSION2 = "0.3.4-beta1";');
    runtime = runtime.split(oldWidth).join("const width = trailWidth034(this);");
    runtime += `

// 0.3.4-beta1: model-aware rendered mowing width.
// The visible trail represents the cut swath plus 5 cm of display tolerance on
// each side of the route centreline. Unknown models intentionally retain the
// historical 25 cm display width until their cutting width is confirmed.
function mowerCuttingWidthMeters034(model) {
  const raw = String(model || "").trim().toUpperCase();
  const compact = raw.replace(/[\\s_-]+/g, "");
  if (/^X4/.test(compact) || /\\bX4\\b/.test(raw)) return 0.43;
  if (/^X3/.test(compact) || /\\bX3\\b/.test(raw)) return 0.237;
  if (/^H/.test(compact) || /\\bH[123]/.test(raw)) return 0.21;
  if (/^I1/.test(compact) || /\\bI1/.test(raw)) return 0.18;
  return null;
}
function renderedTrailWidthMeters034(model) {
  const cuttingWidth = mowerCuttingWidthMeters034(model);
  return cuttingWidth === null ? 0.25 : cuttingWidth + 0.10;
}
function trailWidth034(card) {
  const scale = Number(card?._layout?.scale);
  if (!Number.isFinite(scale) || scale <= 0) return 5;
  const model = typeof mowerModel032 === "function" ? mowerModel032(card) : "";
  return Math.max(renderedTrailWidthMeters034(model) * scale, 5);
}
`;
    await writeFile(source, runtime, "utf8");
    console.log("Applied 0.3.4-beta1 model-aware trail width transform");
  }

  const changelogPath = resolve(root, "CHANGELOG.md");
  let changelog = await readFile(changelogPath, "utf8");
  if (!changelog.includes("## 0.3.4-beta1 - 2026-08-20")) {
    const header = "# Changelog\n\n";
    if (!changelog.startsWith(header)) throw new Error("Unexpected changelog header");
    const section = `## 0.3.4-beta1 - 2026-08-20

### Changed

- Make mowing-trail width model-aware instead of using one 25 cm visual width for every mower.
- Render the trail as the mower's confirmed cutting width plus 5 cm on each side of the route centreline to prevent small visual gaps between adjacent mowing passes.
- Use 53 cm for X4 (43 cm cutting width), 33.7 cm for X3 (23.7 cm), 31 cm for H-series (21 cm), and 28 cm for i1-series (18 cm).
- Keep the historical 25 cm width as a safe fallback for models whose cutting width is not yet mapped.
- Apply the same width calculation to live, Today/history, and session-highlight route rendering.

`;
    changelog = header + section + changelog.slice(header.length);
    await writeFile(changelogPath, changelog, "utf8");
  }

  const readmePath = resolve(root, "README.md");
  let readme = await readFile(readmePath, "utf8");
  if (!readme.includes("Trail thickness is model-aware.")) {
    const needle = "There are no separate active-trail or old-trail color and opacity controls.\n";
    if (!readme.includes(needle)) throw new Error("README trail paragraph not found");
    const addition = `${needle}\nTrail thickness is model-aware. For mower families with a confirmed cutting width, the card renders the mowing swath as the physical cutting width plus 5 cm of visual tolerance on each side of the route centreline. This prevents small gaps between adjacent passes caused by route sampling/rendering while leaving mower data and coverage untouched. Unknown models keep the legacy 25 cm display width.\n`;
    readme = readme.replace(needle, addition);
    await writeFile(readmePath, readme, "utf8");
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Built ${target}`);
