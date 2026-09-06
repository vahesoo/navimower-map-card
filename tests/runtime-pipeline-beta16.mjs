import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const source = readFileSync("src/navimower-map-card.js", "utf8");
const dist = readFileSync("dist/navimower-map-card.js", "utf8");
const notes = readFileSync(".github/release-notes/0.3.6-beta16.md", "utf8");

assert.equal(pkg.version, "0.3.6-beta16");
assert.equal(dist, source, "dist must remain the deterministic single-file build");
assert.ok(notes.startsWith("title: Navimower Map Card 0.3.6-beta16\n"));

assert.equal(
  pkg.scripts["prepare-release"],
  "node scripts/sync-version.mjs && node scripts/prepare-runtime-pipeline-beta16.mjs && node scripts/build.mjs",
  "current source must not replay historical upgrade scripts on every build",
);
assert.ok(pkg.scripts.test.includes("tests/runtime-pipeline-beta16.mjs"));
assert.ok(!pkg.scripts["prepare-release"].includes("upgrade-multi-mower-beta4.mjs"));
assert.ok(!pkg.scripts["prepare-release"].includes("upgrade-underlay-resilience-beta15.mjs"));

for (const token of [
  "// 0.3.6-beta16: prioritized phased loading and selective multi-mower updates.",
  "include_current_cycle=0",
  "current_cycle_only=1",
  "MULTI_REQUEST_CONCURRENCY = 2",
  "MULTI_RENDER_RETRY_MS = 30_000",
  "MULTI_RENDER_CACHE_LIMIT = 96",
  "runLimited036",
  "scheduleMemberDetails036",
  "refreshMemberCurrentCycle036",
  "_multi036RenderFailures",
  "_multi036Generation",
  "generationMatches036",
  "_multi036PendingSelectionKey",
  "updateMultiMowers036",
  "data-multi-mower-entry",
  "_multi036ControlsRenderKey",
  "_multi036SessionsRenderKey",
  "_beta16PerformanceContract",
  "config?.time_zone",
  "dateKeyInZone036",
]) {
  assert.ok(source.includes(token), `beta16 runtime is missing ${token}`);
}

assert.ok(
  !source.includes("SESSION_RENDER_LIMIT_PER_MOWER"),
  "multi-mower History must not silently discard sessions after eight rows",
);
assert.ok(
  !source.includes("card._multi036RenderCache.set(key, null)"),
  "a temporary render failure must not become a permanent null cache entry",
);

const refreshStart = source.indexOf("async function refreshMembers036(card, force = false)");
const refreshEnd = source.indexOf("const sessionRenderEndpoint036", refreshStart);
const refreshBody = source.slice(refreshStart, refreshEnd);
assert.ok(refreshBody.includes("refreshMemberMap036"));
assert.ok(refreshBody.includes("scheduleMemberDetails036"));
assert.ok(
  refreshBody.indexOf("refreshMemberMap036") < refreshBody.indexOf("scheduleMemberDetails036"),
  "member maps must be requested before deferred session metadata",
);
assert.ok(
  !refreshBody.includes("refreshMemberSessions036"),
  "session metadata must not block the first multi-mower map pass",
);

const renderStart = source.indexOf("function renderMultiMap036(card, force = false)");
const renderEnd = source.indexOf("const displayName036", renderStart);
const renderBody = source.slice(renderStart, renderEnd);
assert.ok(renderBody.includes("updateMultiMowers036(card, site, layout, liveSignature)"));
assert.ok(
  !renderBody.includes("[mapSignature, liveSignature,"),
  "pose-only changes must not invalidate all static multi-mower SVG layers",
);

const historyStart = source.indexOf("async function ensureHistoryRenders036");
const historyEnd = source.indexOf("const bounds036", historyStart);
const historyBody = source.slice(historyStart, historyEnd);
assert.ok(historyBody.includes("runLimited036"));
assert.ok(!historyBody.includes("await Promise.all("));

const selectStart = source.indexOf("async function selectSession036");
const selectEnd = source.indexOf("const notificationItems036", selectStart);
const selectBody = source.slice(selectStart, selectEnd);
assert.ok(selectBody.includes("_multi036PendingSelectionKey !== requestKey"));
assert.ok(selectBody.includes("generationMatches036"));

console.log("0.3.6-beta16 prioritized runtime pipeline checks passed");
