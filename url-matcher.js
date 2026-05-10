function normalizeUrlForMatching(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_err) {
    return rawUrl;
  }
}

function normalizePatternForMatching(pattern) {
  if (pattern === "*") return pattern;
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return `${normalizeUrlForMatching(prefix)}*`;
  }
  return normalizeUrlForMatching(pattern);
}

function urlMatchesPattern(url, pattern) {
  const normalizedUrl = normalizeUrlForMatching(url);
  const normalizedPattern = normalizePatternForMatching(pattern);
  if (normalizedPattern === "*") return true;
  if (normalizedPattern.endsWith("*")) {
    return normalizedUrl.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedUrl === normalizedPattern;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeUrlForMatching, normalizePatternForMatching, urlMatchesPattern };
}
