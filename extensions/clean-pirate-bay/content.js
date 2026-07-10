// Clean Pirate Bay v0.1.1
// Hides The Pirate Bay search/browse/top results whose main category is Porn.

const HIDDEN_CLASS = "vpack-clean-pirate-bay-hidden";
const STYLE_ID = "vpack-clean-pirate-bay-style";
const ENTRY_SELECTOR = "li.list-entry";
const TYPE_SELECTOR = ".item-type";

/** True when category label text is main category Porn (e.g. "Porn", "Porn > HD Movies"). */
function isPornCategoryLabel(text) {
  if (text == null) return false;
  return /^\s*porn(\s|>|$)/i.test(String(text));
}

/**
 * True when a category cell is under main category Porn.
 * Matches plain "Porn", "Porn > …", and hrefs like category:5xx / top100:5xx.
 */
function entryIsPorn(entry) {
  if (!entry || typeof entry.querySelector !== "function") return false;
  const typeEl = entry.querySelector(TYPE_SELECTOR);
  if (!typeEl) return false;

  if (isPornCategoryLabel(typeEl.textContent || "")) return true;

  const links = typeof typeEl.querySelectorAll === "function"
    ? typeEl.querySelectorAll("a[href]")
    : [];
  for (const a of links) {
    const href = a.getAttribute ? (a.getAttribute("href") || "") : (a.href || "");
    // category:500–599, top100:5xx, top100:48h_5xx
    if (/(?:category:|top100:(?:48h_)?)5\d{0,2}\b/i.test(href)) return true;
  }
  return false;
}

function ensureHideStyle(doc) {
  const documentRef = doc || (typeof document !== "undefined" ? document : null);
  if (!documentRef || !documentRef.head) return null;
  let style = documentRef.getElementById(STYLE_ID);
  if (style) return style;
  style = documentRef.createElement("style");
  if (typeof style.setAttribute === "function") style.setAttribute("id", STYLE_ID);
  else style.id = STYLE_ID;
  // !important so TPB's filter_list2 (which sets style.display = '') cannot unhide.
  style.textContent = `li.list-entry.${HIDDEN_CLASS}{display:none!important}`;
  documentRef.head.appendChild(style);
  return style;
}

/** Hide all porn-category list entries under root. Returns count newly/already marked. */
function hidePornResults(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope || typeof scope.querySelectorAll !== "function") return 0;
  ensureHideStyle(scope.ownerDocument || scope);
  let count = 0;
  const entries = scope.querySelectorAll(ENTRY_SELECTOR);
  for (const entry of entries) {
    if (!entryIsPorn(entry)) continue;
    if (entry.classList) entry.classList.add(HIDDEN_CLASS);
    else if (typeof entry.className === "string") {
      if (!entry.className.includes(HIDDEN_CLASS)) entry.className += " " + HIDDEN_CLASS;
    }
    count++;
  }
  return count;
}

function startCleanPirateBay(doc) {
  const documentRef = doc || (typeof document !== "undefined" ? document : null);
  if (!documentRef) return;
  ensureHideStyle(documentRef);
  hidePornResults(documentRef);

  // TPB builds the list via document.write + sync XHR; re-run shortly after inject
  // in case we raced the first paint, and watch for later DOM changes.
  if (typeof setTimeout === "function") {
    setTimeout(() => hidePornResults(documentRef), 0);
    setTimeout(() => hidePornResults(documentRef), 250);
    setTimeout(() => hidePornResults(documentRef), 1000);
  }

  if (typeof MutationObserver === "undefined" || !documentRef.documentElement) return;
  const mo = new MutationObserver(() => {
    hidePornResults(documentRef);
  });
  mo.observe(documentRef.documentElement, { childList: true, subtree: true });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HIDDEN_CLASS,
    STYLE_ID,
    ENTRY_SELECTOR,
    isPornCategoryLabel,
    entryIsPorn,
    ensureHideStyle,
    hidePornResults,
    startCleanPirateBay,
  };
} else {
  startCleanPirateBay();
}
