// Grok Focus v0.1.0
// Press Escape while on grok.com to move focus from the URL bar into Grok's text entry box.
(() => {
  if (window.__vpackGrokFocusLoaded) return;
  window.__vpackGrokFocusLoaded = true;

  function focusGrokInput() {
    // Grok's composer is a contenteditable div inside the prompt area.
    const selectors = [
      'div[contenteditable="true"]',
      'textarea[placeholder]',
      'textarea',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.focus();
        // Place cursor at end for contenteditable elements.
        if (el.isContentEditable) {
          const range = document.createRange();
          const sel2 = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel2.removeAllRanges();
          sel2.addRange(range);
        }
        return true;
      }
    }
    return false;
  }

  // Handle Escape keydown — if focus is anywhere on the page but not already
  // in an input/composer, jump to Grok's text entry box.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        // Only act when no input/textarea/contenteditable is already focused.
        const active = document.activeElement;
        const alreadyInInput =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active && active.isContentEditable);
        if (!alreadyInInput) {
          const focused = focusGrokInput();
          if (focused) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    },
    true
  );
})();
