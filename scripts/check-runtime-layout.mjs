import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const expected = ["navimower-map-card.js"];
const jsFiles = async (dir) => (await readdir(dir)).filter((name) => name.endsWith(".js")).sort();

assert.deepEqual(await jsFiles("src"), expected, "src must contain exactly one runtime JavaScript file");
assert.deepEqual(await jsFiles("dist"), expected, "dist must contain exactly one runtime JavaScript file");

const source = await readFile("src/navimower-map-card.js", "utf8");
const dist = await readFile("dist/navimower-map-card.js", "utf8");
assert.ok(dist.length < source.length * 0.9, "dist runtime must be a meaningfully smaller minified build");
assert.doesNotMatch(source, /(?:from\s+|import\s*)["']\.\/navimower-map-card-/,
  "runtime must not reintroduce version-specific local loader imports");
assert.doesNotMatch(dist, /(?:from\s+|import\s*)["']\.\/navimower-map-card-/,
  "minified runtime must stay self-contained");

console.log(`Single-runtime layout checks passed (source ${source.length}, dist ${dist.length})`);
