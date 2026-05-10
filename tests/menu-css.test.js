const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("copied icon keeps success color while hovered or focused", () => {
  const cssPath = path.join(__dirname, "..", "menu", "menu.css");
  const css = fs.readFileSync(cssPath, "utf8");
  assert.match(css, /\.ext-copy-icon\.copied:hover:not\(:disabled\)/);
  assert.match(css, /\.ext-copy-icon\.copied:focus-visible:not\(:disabled\)/);
});

test("copy icon color transition is smooth", () => {
  const cssPath = path.join(__dirname, "..", "menu", "menu.css");
  const css = fs.readFileSync(cssPath, "utf8");
  assert.match(css, /\.ext-copy-icon[\s\S]*transition:\s*color 0\.28s ease-in-out;/);
});
