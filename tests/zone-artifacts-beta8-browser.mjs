import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { prepareZoneArtifactsBeta8 } from "../scripts/prepare-zone-artifacts-beta8.mjs";

const chrome = process.env.CHROME_BIN || ["/usr/bin/chromium", "/usr/bin/google-chrome", "/opt/google/chrome/chrome"].find(existsSync);
assert.ok(chrome, "Chromium/Chrome is required for the native SVG image regression test");
let source = readFileSync(process.env.NAVIMOWER_TEST_RUNTIME || "src/navimower-map-card.js", "utf8");
assert.equal(await prepareZoneArtifactsBeta8(source, process.cwd()), source, "preparation is idempotent");
source = source.replace(/^export\s*\{[^}]*\};?/m, "");
const multiTestAnchor = '  proto._beta8RefreshMultiRender = function() { if (multiActive036(this)) renderMultiMap036(this, true); };';
assert.ok(source.includes(multiTestAnchor), "multi-mower beta8 test hook anchor missing");
source = source.replace(
  multiTestAnchor,
  multiTestAnchor + '\n  globalThis.multiTest = {renderMultiMap036, memberState036, refreshMemberMap036, refreshMemberCurrentCycle036};',
);
const checks = async () => {
  const ok = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async (predicate, label) => {
    for (let i = 0; i < 300; i += 1) { if (predicate()) return; await new Promise((r) => setTimeout(r, 10)); }
    throw new Error("Timed out: " + label);
  };
  const id = (n) => n.toString(16).padStart(64, "0");
  const revokes = [];
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (url) => { revokes.push(url); revoke(url); };
  const calls = [], legacy = [], manifests = new Map(), gates = new Map(), failures = new Map();
  const sharedAuth = {};
  const hass = (connection = sharedAuth) => ({
    connection, states: {}, config: {time_zone: "UTC"},
    async callApi(method, path) { if (path.includes("current_cycle_only")) legacy.push(path); return {}; },
    async fetchWithAuth(path) {
      calls.push(path);
      const entry = decodeURIComponent(path.match(/\/map\/([^?]+)/)[1]);
      if (path.includes("artifacts_only")) return new Response(JSON.stringify(manifests.get(entry)), {headers: {"Content-Type": "application/json"}});
      const resource = new URL(path, "http://localhost").searchParams.get("artifact_id");
      if (gates.has(resource)) await gates.get(resource).promise;
      if (failures.has(resource)) return new Response("not ready", {status: failures.get(resource)});
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -10 20 30"><path fill="black" fill-rule="evenodd" d="M-4 -9L14 -9L-4 19Z M-2 -7L0 -7L0 -5L-2 -5Z"/></svg>', {headers: {"Content-Type": "image/svg+xml"}});
    },
  });
  const artifact = (entry, zone, revision) => ({ resource_id: id(revision), format: "svg", usage: "alpha_mask", coordinate_space: "map_xy_m",
    geometry_revision: revision, byte_length: 200, bounds: [-5,-10,15,20], url: `/api/navimower/map/${entry}?zone_artifact=${zone}&artifact_id=${id(revision)}` });
  const manifest = (entry, a, b, cycle = "cycle-a") => ({schema_version: 1, scope: "current_cycle_artifacts", entry_id: entry, coordinate_space: "map_xy_m",
    publication_revision: a || 0, building: !a, cycle_identity: [["36",cycle],["37","cycle-street"]], fallback_zone_ids: [],
    zones: [{zone_id: 36, cycle_id: cycle, pending: !a, artifact: a ? artifact(entry, 36, a) : null},
      {zone_id: 37, cycle_id: "cycle-street", pending: false, artifact: artifact(entry, 37, b)}]});
  const payload = (entry, revision, cycle = "cycle-a") => ({frontend: {entry_id: entry, map_api_path: `/api/navimower/map/${entry}`},
    map_artifacts: {schema_version:1, manifest_url:`/api/navimower/map/${entry}?artifacts_only=1`, format:"svg", ready_only:true},
    trail_session: 1, trail_revision: revision, trail_segments: [[[0,0],[10,0]]],
    map: {revision:"map-1", zones:[{id:36, polygon:[[0,0],[10,0],[10,10]]},{id:37, polygon:[[20,0],[30,0],[30,10]]}]},
    vendor_trail_debug: {store_version:1, current_cycle_key:String(revision), revision, cycle_ids:{"36":cycle,"37":"cycle-street"}, owned_zone_ids:[36,37], backend_tail_authoritative:true, live_tail_allowed:true}});
  const ns = "http://www.w3.org/2000/svg";
  const root = document.createElementNS(ns, "svg"); root.setAttribute("viewBox", "0 0 1000 1000"); root.style.width="450px"; root.style.height="450px"; document.body.appendChild(root);
  function card(entry, connection) {
    const c = new (customElements.get("navimower-map-card"))();
    c._config = {entity:"lawn_mower."+entry, trail_color:"#12ab80", trail_opacity:0.5, show_zone_labels:false, show_map_legend:false};
    c._hass = hass(connection); c._queueRender = () => {};
    c._apiPath = () => `/api/navimower/map/${entry}`;
    c._staticCacheKey = () => "test-map"; c._payloadStaticSignature = () => "test-map";
    c._buildLayout = () => ({scale:10, sx:(x)=>200+10*x, sy:(y)=>300-10*y, zones:[]});
    c._applyStaticLayers = () => {};
    c._historyEl = document.createElementNS(ns,"g"); root.appendChild(c._historyEl);
    c._trailEl = document.createElementNS(ns,"g"); c._highlightEl = document.createElementNS(ns,"g");
    c._historyDayOffset = null;
    c.apply = (p) => { c._applyMapPayload(p,{entry_id:entry},String(p.trail_revision)); c._layout = c._buildLayout(); c._renderHistory(); };
    return c;
  }
  const zone = (c,z) => c._historyEl.querySelector(`[data-zone-id="${z}"]`);
  const mounted = (c,z,n) => zone(c,z)?.getAttribute("data-resource-id") === id(n);
  const binaryCount = (n) => calls.filter((p)=>p.includes("artifact_id="+id(n))).length;
  const gate = (n) => { let resolve; const promise=new Promise((r)=>{resolve=r;}); gates.set(id(n),{promise,resolve}); return resolve; };

  manifests.set("m1",manifest("m1",1,2));
  const first=card("m1"), second=card("m1"); first.apply(payload("m1",1)); second.apply(payload("m1",1));
  await wait(()=>mounted(first,36,1)&&mounted(second,37,2),"initial shared resources");
  ok(binaryCount(1)===1 && binaryCount(2)===1,"two cards share binary downloads");
  ok(legacy.length===0,"both legacy deferred producers are suppressed in the cumulative runtime");
  const unchanged=zone(first,37), old36=zone(first,36), oldHref=old36.querySelector("image").getAttribute("href");
  const before=calls.length;
  for(let i=0;i<100;i++) first.apply(payload("m1",1));
  ok(calls.length===before,"100 unchanged refreshes perform no extra artifact request");
  ok(zone(first,37)===unchanged,"unchanged zone DOM remains mounted");
  ok(first._historyEl.querySelector(".nm-zone-artifacts").getAttribute("transform")==="matrix(10 0 0 -10 200 300)","mower-local Y inversion applied once");
  ok(getComputedStyle(old36.querySelector("mask")).maskType==="alpha","black vendor image uses alpha, not luminance");
  ok(old36.querySelector("image").getAttribute("y")==="-10","negative local image coordinates are preserved");

  const release3=gate(3); manifests.set("m1",manifest("m1",3,2)); first.apply(payload("m1",2));
  await wait(()=>binaryCount(3)===1,"changed-zone download");
  ok(zone(first,36).querySelector("image").getAttribute("href")===oldHref,"keep prior valid image while replacement loads");
  release3(); await wait(()=>mounted(first,36,3),"decoded replacement");
  ok(zone(first,36)===old36 && zone(first,37)===unchanged,"swap only image attributes, not zone elements");
  ok(binaryCount(2)===1,"Street is not downloaded again for Yard update");
  ok(!revokes.includes(oldHref),"second card still retains the shared old revision");

  const release4=gate(4); manifests.set("m1",manifest("m1",4,2)); first.apply(payload("m1",3));
  await wait(()=>binaryCount(4)===1,"in-flight old-cycle request");
  manifests.set("m1",manifest("m1",null,2,"cycle-b")); first.apply(payload("m1",4,"cycle-b"));
  ok(!zone(first,36),"reset removes only affected zone immediately");
  ok(zone(first,37)===unchanged,"reset does not remove unchanged Street");
  release4(); await new Promise((r)=>setTimeout(r,40)); ok(!mounted(first,36,4),"late old-cycle response never reappears");
  manifests.set("m1",manifest("m1",5,2,"cycle-b")); first.apply(payload("m1",5,"cycle-b"));
  await wait(()=>mounted(first,36,5),"new-cycle resource");

  failures.set(id(6),410); manifests.set("m1",manifest("m1",6,2,"cycle-b")); first.apply(payload("m1",6,"cycle-b"));
  await wait(()=>first._nmBeta8Clients.get("m1").metrics.errors>0,"410 recovery");
  ok(mounted(first,36,5),"evicted same-cycle resource does not blank last valid image");
  manifests.set("m1",manifest("m1",7,2,"cycle-b")); first.apply(payload("m1",7,"cycle-b"));
  await wait(()=>mounted(first,36,7),"recovery after manifest refresh");
  const bad=manifest("m1",8,2,"cycle-b"); bad.zones[0].artifact.url="https://example.invalid/secret";
  manifests.set("m1",bad); first.apply(payload("m1",8,"cycle-b"));
  await wait(()=>first._nmBeta8Clients.get("m1").retryAt>0,"invalid descriptor backoff");
  ok(binaryCount(8)===0 && mounted(first,36,7),"external resource URL rejected without losing current image");

  const fallback=card("fallback"); const fp=payload("fallback",1); fp.vendor_trail_debug.owned_zone_ids=[37];
  fallback.apply(fp); ok(fallback._zoneArtifactsMode("fallback")==="legacy","partial ownership preserves whole-member legacy fallback");
  ok(!calls.some((p)=>p.includes("/fallback?")),"no speculative binary/manifest calls for fallback member");
  fallback._mapPayload.current_cycle_render={scope:"current_cycle",revision:"fallback",mowed_area:{path_d:"M0 0L10 0L10 10Z"}};
  fallback._renderHistory(); ok(fallback._historyEl.innerHTML.includes("M0 0L10 0L10 10Z"),"fallback geometry remains visible");

  if (globalThis.multiTest) {
    manifests.set("m1",manifest("m1",7,2,"cycle-b")); manifests.set("m2",manifest("m2",11,12));
    const multi=card("m1"); multi._config.multi_mower=true;
    multi._mapPayload=payload("m1",7,"cycle-b"); multi._layout=multi._buildLayout();
    multi._multi036Layer=document.createElementNS(ns,"g"); root.appendChild(multi._multi036Layer);
    multi._multi036Site={multi_mower:true,member_order:"west_to_east",combined_svg_bounds:{min_x:-20,min_y:-20,max_x:80,max_y:80},
      members:[{entry_id:"m1",svg_matrix:[1,0,0,-1,0,0]},{entry_id:"m2",svg_matrix:[0,1,1,0,40,0]}]};
    for(const m of multi._multi036Site.members) multiTest.memberState036(multi,m.entry_id).map=payload(m.entry_id,m.entry_id==="m1"?7:1,m.entry_id==="m1"?"cycle-b":"cycle-a");
    multiTest.renderMultiMap036(multi,true);
    await wait(()=>multi._multi036Layer.querySelector(`[data-entry-id="m2"] [data-resource-id="${id(11)}"]`),"non-anchor member mask");
    const multiNode=multi._multi036Layer.querySelector(`[data-entry-id="m2"] [data-zone-id="37"]`);
    multiTest.memberState036(multi,"m2").map.trail_segments=[[[0,0],[15,15]]]; multiTest.renderMultiMap036(multi,true);
    ok(multi._multi036Layer.querySelector(`[data-entry-id="m2"] [data-zone-id="37"]`)===multiNode,"Multi tail updates preserve zone nodes");
    const selected={mowed_area:{path_d:"M1 1L2 1L2 2Z"},travel:{path_d:""}};
    multi._multi036RenderCache=new Map([["m2:session-a",selected]]); multi._multi036SelectedSessionKey="m2:session-a";
    multiTest.renderMultiMap036(multi,true);
    ok([...multi._multi036Layer.querySelectorAll("[data-nm-artifacts-entry]")].every((n)=>n.style.display==="none"),"History selection hides all cumulative masks");
    ok(multi._multi036Layer.querySelectorAll(".nm-multi-selected-session").length===1,"exactly selected History session is shown");
    multi._multi036SelectedSessionKey=null; multiTest.renderMultiMap036(multi,true);
    ok(multi._multi036Layer.querySelector(`[data-entry-id="m2"] [data-zone-id="37"]`)===multiNode,"History return reuses masks");
    multi.disconnectedCallback();
  }
  const isolate=card("m1",{}); manifests.set("m1",manifest("m1",1,2)); isolate.apply(payload("m1",1));
  await wait(()=>mounted(isolate,37,2),"separate auth context"); ok(binaryCount(2)===2,"different auth connections do not share private image cache");
  const beforeClose=revokes.length; first.disconnectedCallback(); second.disconnectedCallback(); fallback.disconnectedCallback(); isolate.disconnectedCallback();
  ok(first._nmBeta8Clients.size===0 && revokes.length>beforeClose,"disconnect releases decoded resources");
  document.body.setAttribute("data-test-result","passed");
};
// Native browser over its debugging pipe: no npm browser dependency, file URL,
// external HTTP server, user account, or real mower is needed by this test.
const dir = mkdtempSync(join(tmpdir(), "navimower-beta8-"));
const browser = spawn(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--remote-debugging-pipe", `--user-data-dir=${dir}`, "about:blank"],
  {stdio:["ignore", "ignore", "pipe", "pipe", "pipe"], detached:true});
let sequence = 0, buffer = "", stderr = "";
const pending = new Map();
browser.stderr.on("data", (data) => { stderr = (stderr + data).slice(-4000); });
browser.stdio[4].on("data", (data) => {
  buffer += data.toString();
  let index;
  while ((index = buffer.indexOf("\0")) >= 0) {
    const raw = buffer.slice(0,index); buffer = buffer.slice(index+1);
    if (!raw) continue;
    const message = JSON.parse(raw), waiter = pending.get(message.id);
    if (!waiter) continue;
    pending.delete(message.id); clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  }
});
function command(method, params={}, sessionId) {
  return new Promise((resolve,reject) => {
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error("Browser timeout: "+method+" "+stderr));},15000);
    pending.set(id,{resolve,reject,timer});
    browser.stdio[3].write(JSON.stringify({id,method,params,sessionId})+"\0");
  });
}
try {
  await command("Browser.getVersion");
  const {targetId}=await command("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await command("Target.attachToTarget",{targetId,flatten:true});
  await command("Page.enable",{},sessionId);
  const {frameTree}=await command("Page.getFrameTree",{},sessionId);
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.customCards=[];'+source.replaceAll('</script','<\\/script')+'</script><script>('+checks.toString()+')().catch(error=>{document.body.dataset.testResult="failed";document.body.dataset.testError=error.stack;});</script></body></html>';
  await command("Page.setDocumentContent",{frameId:frameTree.frame.id,html},sessionId);
  let result;
  for(let i=0;i<160;i++) {
    const response=await command("Runtime.evaluate",{expression:"JSON.stringify({result:document.body.dataset.testResult,error:document.body.dataset.testError})",returnByValue:true},sessionId);
    result=JSON.parse(response.result.value);
    if(result.result) break;
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
  assert.equal(result?.result,"passed",JSON.stringify(result));
  console.log("beta8 native-browser/cumulative-runtime resource, reset, auth, fallback and DOM regressions passed");
} finally {
  try { await command("Browser.close"); } catch (_error) { /* terminate below */ }
  try { process.kill(-browser.pid,"SIGKILL"); } catch (_error) { /* already closed */ }
  for(const waiter of pending.values()) clearTimeout(waiter.timer);
  rmSync(dir,{recursive:true,force:true});
}
