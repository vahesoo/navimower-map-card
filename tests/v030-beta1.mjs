import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  archiveSvg,
  deriveSessionPaths,
  layoutMatrix,
  sanitizeMapPayload,
  sessionsForDay,
} from "../src/navimower-map-card-v030.js";

const paths = deriveSessionPaths("/api/navimower/map/entry-1?old=1");
assert.equal(paths.sessionsPath, "/api/navimower/sessions/entry-1");
assert.equal(paths.renderTemplate, "/api/navimower/session-render/entry-1/{session_id}");
assert.match(paths.lightweightMapPath, /include_sessions=0/);
assert.match(paths.lightweightMapPath, /include_daily_trails=0/);

const payload = sanitizeMapPayload({
  daily_trails: { zones: [] },
  sessions: [
    {
      id: "old",
      active: false,
      ended_at: "2026-08-05T08:00:00Z",
      points: [[1, 2]],
      segments: [[[1, 2]]],
    },
    {
      id: "live",
      active: true,
      ended_at: null,
      started_at: "2026-08-05T09:00:00Z",
      points: [[3, 4]],
      segments: [[[3, 4], [4, 5]]],
    },
  ],
});
assert.equal("daily_trails" in payload, false);
assert.equal("points" in payload.sessions[0], false);
assert.equal("segments" in payload.sessions[0], false);
assert.deepEqual(payload.sessions[1].points, [[3, 4]]);

const layout = { sx: (x) => 100 + x * 10, sy: (y) => 900 - y * 10 };
assert.deepEqual(layoutMatrix(layout), {
  a: 10,
  d: -10,
  e: 100,
  f: 900,
  value: "matrix(10 0 0 -10 100 900)",
});
const svg = archiveSvg({
  fingerprint: "abc",
  mowed_area: {
    path_d: "M 0 0 L 1 0 L 1 1 Z M .25 .25 L .75 .25 L .75 .75 Z",
    fill_rule: "evenodd",
  },
  travel: { path_d: "M 0 0 L 2 2", stroke_width_m: 0.08 },
}, layout, "#00aa00", 0.55, "s1");
assert.match(svg, /fill-rule="evenodd"/);
assert.match(svg, /nm-session-travel/);
assert.match(svg, /matrix\(10 0 0 -10 100 900\)/);
assert.doesNotMatch(svg, /polyline/);

const now = new Date();
const today = new Date(now);
today.setHours(12, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const daySessions = [
  { id: "today", started_at: today.toISOString(), ended_at: today.toISOString() },
  { id: "yesterday", started_at: yesterday.toISOString(), ended_at: yesterday.toISOString() },
];
assert.equal(sessionsForDay(daySessions, 0, 6)[0].id, "today");
assert.equal(sessionsForDay(daySessions, 1, 6)[0].id, "yesterday");

const source = readFileSync("src/navimower-map-card-v030.js", "utf8");
assert.match(source, /_dailyTrailRecords = function noCompletedLineFallback/);
assert.match(source, /this\._scheduleDialogOpen = false/);
assert.match(source, /overflow: hidden !important/);
assert.match(source, /MAX_HISTORY_DAYS = 31/);

console.log("0.3.0-beta1 archive checks passed");
