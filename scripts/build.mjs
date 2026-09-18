import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const source = resolve(srcDir, "navimower-map-card.js");
const target = resolve(distDir, "navimower-map-card.js");

const sourceJs = (await readdir(srcDir)).filter((name) => name.endsWith(".js"));
if (sourceJs.length !== 1 || sourceJs[0] !== "navimower-map-card.js") {
  throw new Error("src runtime layout invalid");
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
await new Promise((resolvePromise, reject) => {
  const child = spawn(
    npx,
    [
      "--yes",
      "esbuild@0.25.10",
      source,
      "--minify",
      "--format=esm",
      "--target=es2022",
      "--legal-comments=none",
      `--outfile=${target}`,
    ],
    { stdio: "inherit" },
  );
  child.once("error", reject);
  child.once("exit", (code) => code === 0
    ? resolvePromise()
    : reject(new Error(`esbuild exited with code ${code}`)));
});

const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)]);
console.log(
  `Built minified ${target} (${targetStat.size} bytes, ${Math.round((1 - targetStat.size / sourceStat.size) * 100)}% smaller than source)`,
);
