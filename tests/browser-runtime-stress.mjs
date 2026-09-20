import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const runtimeRoot = process.argv[2] === "dist" ? "dist" : "src";
const chrome = process.env.CHROME_BIN || ["/usr/bin/chromium", "/usr/bin/google-chrome", "/opt/google/chrome/chrome"].find(existsSync);
assert.ok(chrome, "Chromium/Chrome is required for runtime stress checks");

let runtime = readFileSync(`${runtimeRoot}/navimower-map-card.js`, "utf8");
runtime = runtime.replace(/export\s*\{[^}]*\};?\s*$/, "");

const checks = async () => {
  const sleepFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const Card = customElements.get("navimower-map-card");
  if (typeof Card !== "function") throw new Error("Navimower Map Card custom element missing");

  const card = document.createElement("navimower-map-card");
  document.body.appendChild(card);
  card.setConfig({
    entity: "lawn_mower.test",
    mower_entity: "lawn_mower.test",
    map_entity: "sensor.test_map",
    x_entity: "sensor.test_x",
    y_entity: "sensor.test_y",
    heading_entity: "sensor.test_heading",
    battery_entity: "sensor.test_battery",
    zone_entity: "sensor.test_zone",
    auto_entities: false,
    multi_mower: false,
    map_underlay: "none",
    terrain_overlay: false,
    show_session_legend: false,
  });

  let mapChecks = 0;
  const originalMaybeLoadMap = card._maybeLoadMap?.bind(card);
  card._maybeLoadMap = () => { mapChecks += 1; };

  let queued = 0;
  const originalQueueRender = card._queueRender?.bind(card);
  card._queueRender = (flags) => {
    queued += 1;
    return originalQueueRender?.(flags);
  };

  let microtasks = 0;
  let microtasksDone = 0;
  const nativeQueueMicrotask = globalThis.queueMicrotask.bind(globalThis);
  globalThis.queueMicrotask = (callback) => {
    microtasks += 1;
    return nativeQueueMicrotask(() => {
      microtasksDone += 1;
      callback();
    });
  };

  const state = (value, updated = "1") => ({ state: String(value), last_updated: updated, last_changed: updated, attributes: {} });
  const baseStates = {
    "lawn_mower.test": { state: "docked", last_updated: "1", last_changed: "1", attributes: { activity: "docked" } },
    "sensor.test_map": { state: "ready", last_updated: "1", last_changed: "1", attributes: { api_path: "/api/navimower/map/test", activity: "docked", trail_active: false } },
    "sensor.test_x": state(1),
    "sensor.test_y": state(2),
    "sensor.test_heading": state(90),
    "sensor.test_battery": state(80),
    "sensor.test_zone": state("Yard"),
  };
  const hassBase = {
    states: baseStates,
    services: { navimower: { resume: {}, set_schedule_queue: {} } },
    config: { time_zone: "UTC" },
    callWS: async () => [],
    callApi: async () => ({}),
    fetchWithAuth: async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  };

  card.hass = hassBase;
  await sleepFrame();
  await sleepFrame();

  const baseline = { mapChecks, queued, microtasks, microtasksDone };
  const start = performance.now();
  for (let index = 0; index < 1000; index += 1) {
    card.hass = {
      ...hassBase,
      states: {
        ...baseStates,
        "sensor.unrelated": state(index, String(index + 2)),
      },
    };
  }
  await Promise.resolve();
  await Promise.resolve();
  await sleepFrame();
  await sleepFrame();
  const unrelatedMs = performance.now() - start;

  const unrelated = {
    mapChecks: mapChecks - baseline.mapChecks,
    queued: queued - baseline.queued,
    microtasks: microtasks - baseline.microtasks,
    microtasksDone: microtasksDone - baseline.microtasksDone,
    elapsedMs: unrelatedMs,
  };

  if (unrelated.mapChecks !== 0) throw new Error("Unrelated HA updates triggered map checks: " + unrelated.mapChecks);
  if (unrelated.queued !== 0) throw new Error("Unrelated HA updates queued card renders: " + unrelated.queued);
  if (unrelated.microtasksDone !== unrelated.microtasks) throw new Error("Microtask queue did not settle");
  if (unrelated.elapsedMs > 5000) throw new Error("1000 unrelated HA updates took too long: " + unrelated.elapsedMs.toFixed(1) + " ms");

  queued = 0;
  const relevantStart = performance.now();
  let relevantHass = hassBase;
  for (let index = 0; index < 250; index += 1) {
    relevantHass = {
      ...hassBase,
      states: {
        ...baseStates,
        "sensor.test_x": state(1 + index / 100, String(index + 2000)),
        "sensor.test_heading": state((90 + index) % 360, String(index + 2000)),
      },
    };
    card.hass = relevantHass;
  }
  await Promise.resolve();
  await sleepFrame();
  await sleepFrame();
  const relevantMs = performance.now() - relevantStart;
  if (relevantMs > 5000) throw new Error("250 relevant HA updates took too long: " + relevantMs.toFixed(1) + " ms");

  card.remove();
  globalThis.queueMicrotask = nativeQueueMicrotask;
  document.body.dataset.testResult = "passed";
  document.body.dataset.testMetrics = JSON.stringify({
    runtimeRoot: "${runtimeRoot}",
    unrelated,
    relevant: { elapsedMs: relevantMs, queued },
  });
};

const dir = mkdtempSync(join(tmpdir(), "navimower-runtime-stress-"));
const browser = spawn(chrome, [
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-background-networking",
  "--remote-debugging-pipe",
  `--user-data-dir=${dir}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], detached: true });

let sequence = 0;
let buffer = "";
let stderr = "";
const pending = new Map();
browser.stderr.on("data", (data) => { stderr = (stderr + data).slice(-4000); });
browser.stdio[4].on("data", (data) => {
  buffer += data.toString();
  let index;
  while ((index = buffer.indexOf("\0")) >= 0) {
    const raw = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (!raw) continue;
    const message = JSON.parse(raw);
    const waiter = pending.get(message.id);
    if (!waiter) continue;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  }
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Browser timeout: " + method + " " + stderr));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  });
}

try {
  await command("Browser.getVersion");
  const { targetId } = await command("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
  await command("Page.enable", {}, sessionId);
  const { frameTree } = await command("Page.getFrameTree", {}, sessionId);
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<script>' + runtime.replaceAll("</script", "<\\/script") + '</script>'
    + '<script>(' + checks.toString() + ')().catch(error=>{document.body.dataset.testResult="failed";document.body.dataset.testError=error.stack;});</script>'
    + '</body></html>';
  await command("Page.setDocumentContent", { frameId: frameTree.frame.id, html }, sessionId);

  let result;
  for (let index = 0; index < 200; index += 1) {
    const response = await command("Runtime.evaluate", {
      expression: "JSON.stringify({result:document.body.dataset.testResult,error:document.body.dataset.testError,metrics:document.body.dataset.testMetrics})",
      returnByValue: true,
    }, sessionId);
    result = JSON.parse(response.result.value);
    if (result.result) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(result?.result, "passed", JSON.stringify(result));
  console.log(`Browser runtime stress passed for ${runtimeRoot}: ${result.metrics}`);
} finally {
  try { await command("Browser.close"); } catch (_error) {}
  try { process.kill(-browser.pid, "SIGKILL"); } catch (_error) {}
  for (const waiter of pending.values()) clearTimeout(waiter.timer);
  rmSync(dir, { recursive: true, force: true });
}
