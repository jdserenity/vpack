const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeUrlForMatching,
  normalizePatternForMatching,
  urlMatchesPattern,
} = require("../url-matcher.js");

test("normalizes repeated slashes in URL path", () => {
  const normalized = normalizeUrlForMatching(
    "https://geohot.github.io//blog/jekyll/update/2026/05/09/real-singularity.html"
  );
  assert.equal(
    normalized,
    "https://geohot.github.io/blog/jekyll/update/2026/05/09/real-singularity.html"
  );
});

test("normalizes repeated slashes in wildcard pattern prefix", () => {
  const normalized = normalizePatternForMatching("https://geohot.github.io//blog/*");
  assert.equal(normalized, "https://geohot.github.io/blog/*");
});

test("matches geohot blog URL with single slash path", () => {
  assert.equal(
    urlMatchesPattern(
      "https://geohot.github.io/blog/jekyll/update/2026/05/09/real-singularity.html",
      "https://geohot.github.io/blog/*"
    ),
    true
  );
});

test("matches geohot blog URL with double slash path", () => {
  assert.equal(
    urlMatchesPattern(
      "https://geohot.github.io//blog/jekyll/update/2026/05/09/real-singularity.html",
      "https://geohot.github.io/blog/*"
    ),
    true
  );
});
