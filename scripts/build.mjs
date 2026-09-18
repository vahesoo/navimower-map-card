import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TERSER_VERSION = "5.51.2";
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
await new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(npx, [
    "--yes",
    `terser@${TERSER_VERSION}`,
    source,
    "--module",
    "--compress",
    "passes=3",
    "--mangle",
    "--output",
    target,
  ], { cwd: root, stdio: "inherit" });
  child.on("error", rejectPromise);
  child.on("exit", (code) => {
    if (code === 0) resolvePromise();
    else rejectPromise(new Error(`Terser build failed with exit code ${code}`));
  });
});

const [sourceBytes, targetBytes] = await Promise.all([
  stat(source).then((entry) => entry.size),
  stat(target).then((entry) => entry.size),
]);
if (targetBytes >= sourceBytes) {
  throw new Error(`Optimized runtime did not shrink: ${sourceBytes} -> ${targetBytes} bytes`);
}
console.log(`Built optimized ${target} (${sourceBytes} -> ${targetBytes} bytes)`);
