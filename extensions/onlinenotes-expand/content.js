// onlinenotes Hijack v0.1.0
// Forces the textarea on onlinenotes.app to fill the entire viewport,
// and stays responsive to Vivaldi tab tiling / resize via ResizeObserver.

(function () {
  const STYLE_ID = "vpack-onlinenotes-expand";

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

    /* Make the main content area fill everything */
    body > *:not(script):not(style) {
      height: 100% !important;
    }

    /* The actual textarea / contenteditable */
    textarea, [contenteditable="true"], [contenteditable=""] {
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

  // Insert two spaces on Tab, instead of letting the browser move focus.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const el = document.activeElement;
    if (!el || (el.tagName !== "TEXTAREA" && !el.isContentEditable)) return;
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  }, true);

  // ResizeObserver keeps the textarea snapped to the viewport whenever
  // Vivaldi reflows the tab tile (the viewport size changes).
  const ro = new ResizeObserver(() => {
    const editors = document.querySelectorAll(
      "textarea, [contenteditable='true'], [contenteditable='']"
    );
    editors.forEach((el) => {
      // Force a reflow tick so the browser recalculates 100vw/100vh
      el.style.width = "100vw";
      el.style.height = "100vh";
    });
  });
  ro.observe(document.documentElement);
})();
