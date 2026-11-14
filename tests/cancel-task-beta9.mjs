import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("src/navimower-map-card.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "0.4.0-beta9");
assert.match(source, /else if \(command === "dock"\) void this\._dockWithCancellationDialog\(\)/);
assert.match(source, /if \(command === "dock"\) \{\s*const getMower =/);
assert.match(source, /async _dockWithCancellationDialog\(\)/);
assert.match(source, /mow: kind === "docked" \|\| kind === "returning"/);
assert.match(source, /const canMow = controlMode === "docked" \|\| controlMode === "returning"/);

// Execute the actual dialog functions in a tiny mock DOM to ensure all
// dismiss paths are fail-closed, and only Yes can authorize the caller.
const marker = "// 0.4.0-beta9: native-app-style Cancel mowing task confirmation.";
const block = source.split(marker)[1];
assert.ok(block, "dialog implementation is present");
const context = {
  globalThis: { customElements: null },
  escapeHtml: (value) => String(value).replaceAll("<", "&lt;"),
  mowerControlMode: (state) => state?.state || "unavailable",
};
vm.createContext(context);
vm.runInContext(marker + block, context);
function fixture(initial = "mowing") {
  let state = initial;
  const listeners = new Map();
  const buttons = Object.fromEntries(["yes", "no"].map((id) => [id, {
    addEventListener(_type, cb) { listeners.set(id, cb); },
    focus() {},
    click() { listeners.get(id)?.({ target: this }); },
  }]));
  const backdrop = {
    addEventListener(type, cb) { listeners.set(type === "keydown" ? "backdrop-keydown" : "backdrop", cb); },
  };
  const host = {
    innerHTML: "",
    querySelector(selector) {
      if (selector.includes('="yes"')) return buttons.yes;
      if (selector.includes('="no"')) return buttons.no;
      if (selector.includes('="backdrop"')) return backdrop;
      return null;
    },
  };
  const card = {
    _modalHostEl: host, _commandBusy: false,
    _renderDialog() {
      if (this._dockCancelTaskDialog) context.renderCancelMowingTaskDialog(this);
      else this._modalHostEl.innerHTML = "";
    },
  };
  return { card, buttons, listeners, backdrop, setState(next) { state = next; }, getState: () => ({ state }) };
}
{
  const f = fixture();
  const pending = context.confirmCancelMowingTask(f.card, f.getState);
  assert.match(f.card._modalHostEl.innerHTML, /Cancel mowing task/);
  assert.equal(f.card._dockCancelTaskDialog !== null, true);
  f.buttons.no.click();
  assert.equal(await pending, false, "No never authorizes Dock");
  assert.equal(f.card._dockCancelTaskDialog, null);
}
{
  const f = fixture("paused");
  const pending = context.confirmCancelMowingTask(f.card, f.getState);
  f.buttons.yes.click();
  assert.equal(await pending, true, "Yes authorizes Dock for confirmed Paused");
}
{
  const f = fixture();
  const pending = context.confirmCancelMowingTask(f.card, f.getState);
  f.setState("returning");
  f.buttons.yes.click();
  assert.equal(await pending, false, "state changes invalidate the dialog");
}
{
  const f = fixture();
  const pending = context.confirmCancelMowingTask(f.card, f.getState);
  f.listeners.get("backdrop")({ target: f.backdrop });
  assert.equal(await pending, false, "backdrop cancels");
}
{
  const f = fixture();
  const pending = context.confirmCancelMowingTask(f.card, f.getState);
  let prevented = false;
  f.listeners.get("backdrop-keydown")?.({ key: "Escape", preventDefault() { prevented = true; }, stopPropagation() {} });
  // The fixture binds both click and keydown to the same backdrop; the key
  // handler must cancel without reaching the Dock command callback.
  assert.equal(await pending, false, "Escape cancels");
  assert.equal(prevented, true);
}
{
  const f = fixture("returning");
  assert.equal(await context.confirmCancelMowingTask(f.card, f.getState), false, "no dialog when already returning");
  assert.equal(f.card._modalHostEl.innerHTML, "");
}
console.log("beta9: native Dock confirmation is explicit and fail-closed in both layouts");
