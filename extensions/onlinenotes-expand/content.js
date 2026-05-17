// onlinenotes Hijack v0.2.4
// Forces the primary editor on onlinenotes.app to fill the entire viewport.
// Clipboard: `page-clipboard-guard.js` runs MAIN at document_start (see manifest).

const STYLE_ID = "vpack-onlinenotes-expand";
const TARGET_CLASS = "vpack-onlinenotes-editor";
const EDITOR_SELECTOR = "textarea, [contenteditable='true'], [contenteditable='']";
const MIN_VISIBLE_EDITOR_WIDTH = 120;
const MIN_VISIBLE_EDITOR_HEIGHT = 80;

function isEditorElement(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  if (typeof el.getAttribute !== "function") return false;
  const contentEditable = el.getAttribute("contenteditable");
  return contentEditable === "true" || contentEditable === "";
}

function isLikelyVisibleEditor(el, getComputedStyleFn) {
  if (!isEditorElement(el)) return false;
  if (el.tagName === "TEXTAREA" && (el.disabled || el.readOnly)) return false;
  if (typeof el.getBoundingClientRect !== "function") return false;
  const rect = el.getBoundingClientRect();
  if (!rect) return false;
  if (rect.width < MIN_VISIBLE_EDITOR_WIDTH || rect.height < MIN_VISIBLE_EDITOR_HEIGHT) return false;
  const styleGetter = getComputedStyleFn || (typeof window !== "undefined" ? window.getComputedStyle : null);
  if (typeof styleGetter !== "function") return true;
  const style = styleGetter(el);
  if (!style) return true;
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
  if (Number(style.opacity) === 0) return false;
  return true;
}

function getEditorArea(el) {
  if (!el || typeof el.getBoundingClientRect !== "function") return 0;
  const rect = el.getBoundingClientRect();
  if (!rect) return 0;
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function isBareOnlinenotesShareUrl(text) {
  const t = String(text ?? "").trim();
  if (!t || t.includes("\n") || t.includes("\r")) return false;
  if (t.length > 700) return false;
  return /^https:\/\/onlinenotes\.app\/[^\s]+$/i.test(t);
}

// onlinenotes often has a second textarea (or similar) holding only the share URL; after autosave
// it can briefly win "largest editor" heuristics and steal hijack + focus from the real note body.
function isShareUrlOnlyTextarea(el) {
  if (!el || el.tagName !== "TEXTAREA") return false;
  return isBareOnlinenotesShareUrl(el.value);
}

function pickPrimaryEditor(editors, getComputedStyleFn) {
  const visibleEditors = Array.from(editors || []).filter((el) =>
    isLikelyVisibleEditor(el, getComputedStyleFn) && !isShareUrlOnlyTextarea(el)
  );
  if (!visibleEditors.length) return null;
  visibleEditors.sort((a, b) => getEditorArea(b) - getEditorArea(a));
  return visibleEditors[0];
}

function applyTargetClassToEditors(editors, primaryEditor) {
  for (const editor of editors) {
    if (editor === primaryEditor && primaryEditor) editor.classList.add(TARGET_CLASS);
    else editor.classList.remove(TARGET_CLASS);
  }
}

function retargetPrimaryEditor(doc, getComputedStyleFn) {
  const editors = Array.from(doc.querySelectorAll(EDITOR_SELECTOR));
  const primaryEditor = pickPrimaryEditor(editors, getComputedStyleFn);
  applyTargetClassToEditors(editors, primaryEditor);
  return primaryEditor;
}

function insertTwoSpaces(el) {
  if (!el) return;
  if (el.tagName === "TEXTAREA" && typeof el.setRangeText === "function") {
    const start = Number.isInteger(el.selectionStart) ? el.selectionStart : el.value.length;
    const end = Number.isInteger(el.selectionEnd) ? el.selectionEnd : start;
    el.setRangeText("  ", start, end, "end");
    if (typeof Event === "function") el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (typeof document.execCommand === "function") document.execCommand("insertText", false, "  ");
}

(function () {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html, body {
      height: 100% !important;
      overflow: hidden !important;
    }

    /* Hide surrounding chrome that shrinks usable space */
    header, nav, .header, .nav, .toolbar, .top-bar,
    footer, .footer, .bottom-bar,
    .sidebar, .side-bar, aside {
      display: none !important;
    }

    /* Only hijack the primary visible editor */
    .${TARGET_CLASS} {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 16px !important;
      border: none !important;
      border-radius: 0 !important;
      outline: none !important;
      resize: none !important;
      box-sizing: border-box !important;
      font-size: 15px !important;
      line-height: 1.6 !important;
      z-index: 999999 !important;
    }
  `;
  document.head.appendChild(style);

  const getComputed = (n) => window.getComputedStyle(n);
  let lockedEditor = null;
  const editorStillUsable = (el) =>
    el &&
    el.isConnected &&
    isLikelyVisibleEditor(el, getComputed) &&
    !isShareUrlOnlyTextarea(el);

  // Insert two spaces on Tab, instead of letting the browser move focus.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const el = document.activeElement;
    if (!el || el !== lockedEditor) return;
    e.preventDefault();
    insertTwoSpaces(el);
  }, true);

  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!isEditorElement(t)) return;
    if (isShareUrlOnlyTextarea(t)) return;
    if (!isLikelyVisibleEditor(t, getComputed)) return;
    if (t.tagName === "TEXTAREA" && (t.disabled || t.readOnly)) return;
    lockedEditor = t;
    queueRefresh();
  }, true);

  let refreshQueued = false;
  const refreshEditorTarget = () => {
    if (!editorStillUsable(lockedEditor)) {
      lockedEditor = pickPrimaryEditor(
        Array.from(document.querySelectorAll(EDITOR_SELECTOR)),
        getComputed
      );
    }
    const editors = Array.from(document.querySelectorAll(EDITOR_SELECTOR));
    applyTargetClassToEditors(editors, lockedEditor);
    if (!lockedEditor) return;
    lockedEditor.style.width = "100vw";
    lockedEditor.style.height = "100vh";
  };
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      refreshEditorTarget();
    });
  };

  lockedEditor = pickPrimaryEditor(
    Array.from(document.querySelectorAll(EDITOR_SELECTOR)),
    getComputed
  );
  queueRefresh();

  // Keep the selected editor snapped to viewport when tiling/resizing.
  const ro = new ResizeObserver(() => {
    queueRefresh();
  });
  ro.observe(document.documentElement);

  // Onlinenotes may replace nodes while autosaving; refresh layout without re-picking while lock is valid.
  const mo = new MutationObserver(() => {
    queueRefresh();
  });
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "contenteditable"],
  });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EDITOR_SELECTOR,
    TARGET_CLASS,
    isEditorElement,
    isLikelyVisibleEditor,
    isBareOnlinenotesShareUrl,
    isShareUrlOnlyTextarea,
    getEditorArea,
    pickPrimaryEditor,
    retargetPrimaryEditor,
    insertTwoSpaces,
  };
}
