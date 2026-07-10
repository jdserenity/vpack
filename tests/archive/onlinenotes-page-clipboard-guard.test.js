const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("page clipboard guard patches write and writeText at document_start", () => {
  const p = path.join(
    __dirname,
    "..",
    "extensions",
    "onlinenotes-expand",
    "page-clipboard-guard.js"
  );
  const src = fs.readFileSync(p, "utf8");
  assert.match(src, /Page MAIN world/);
  assert.match(src, /\.writeText/);
  assert.match(src, /\.write\b/);
  assert.match(src, /shouldBlockClipboardWrite/);
  assert.match(src, /__vpackOnNotesClip/);
});
