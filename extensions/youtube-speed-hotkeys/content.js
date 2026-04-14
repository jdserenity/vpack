// YouTube Speed Hotkeys v0.1.0
// Configure two shortcuts in VPack popup settings to adjust playback speed by +/-0.05.
(() => {
  if (window.__vpackYoutubeSpeedHotkeysLoaded) return;
  window.__vpackYoutubeSpeedHotkeysLoaded = true;

  const STORAGE_KEYS = {
    faster: "youtube-speed-hotkeys.settings.hotkeyFaster",
    slower: "youtube-speed-hotkeys.settings.hotkeySlower",
  };

  const DEFAULTS = {
    [STORAGE_KEYS.faster]: "Command+Shift+Period",
    [STORAGE_KEYS.slower]: "Command+Shift+Comma",
  };

  let fasterHotkey = parseShortcut(DEFAULTS[STORAGE_KEYS.faster]);
  let slowerHotkey = parseShortcut(DEFAULTS[STORAGE_KEYS.slower]);

  loadSettings();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_KEYS.faster]) {
      fasterHotkey = parseShortcut(changes[STORAGE_KEYS.faster].newValue);
    }
    if (changes[STORAGE_KEYS.slower]) {
      slowerHotkey = parseShortcut(changes[STORAGE_KEYS.slower].newValue);
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (shouldIgnoreKeydown(event)) return;

      if (matchesShortcut(event, fasterHotkey)) {
        event.preventDefault();
        event.stopPropagation();
        adjustPlaybackRate(0.05);
        return;
      }

      if (matchesShortcut(event, slowerHotkey)) {
        event.preventDefault();
        event.stopPropagation();
        adjustPlaybackRate(-0.05);
      }
    },
    true
  );

  function loadSettings() {
    chrome.storage.local.get(DEFAULTS, (stored) => {
      fasterHotkey = parseShortcut(stored[STORAGE_KEYS.faster]);
      slowerHotkey = parseShortcut(stored[STORAGE_KEYS.slower]);
    });
  }

  function shouldIgnoreKeydown(event) {
    const el = event.target;
    if (!el) return false;
    if (el instanceof HTMLInputElement) return true;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLSelectElement) return true;
    return Boolean(el.closest("[contenteditable='true']"));
  }

  function adjustPlaybackRate(delta) {
    const video =
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video");
    if (!video) return;

    video.playbackRate = video.playbackRate + delta;
    video.playbackRate = clamp(roundToHundredth(video.playbackRate), 0.05, 16);
    try {
      showSpeedToast(video.playbackRate);
    } catch (err) {
      console.error("[VPack][YouTube Speed] Toast render failed:", err);
    }
  }

  function showSpeedToast(rate) {
    let toast = document.getElementById("vpack-speed-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "vpack-speed-toast";
      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "999999",
        background: "rgba(0, 0, 0, 0.72)",
        color: "#fff",
        padding: "18px 24px",
        borderRadius: "10px",
        fontSize: "34px",
        fontWeight: "600",
        letterSpacing: "0.2px",
        lineHeight: "1",
        fontFamily:
          '"YouTube Sans", "Roboto", "Arial", system-ui, sans-serif',
        pointerEvents: "none",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      });
      (document.body || document.documentElement).appendChild(toast);
    }
    toast.textContent = `Speed: ${rate.toFixed(2)}x`;
    clearTimeout(showSpeedToast._timeoutId);
    showSpeedToast._timeoutId = setTimeout(() => {
      toast.remove();
    }, 900);
  }

  function parseShortcut(value) {
    const fallback = {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      code: "",
    };

    if (typeof value !== "string" || !value.trim()) return fallback;
    const tokens = value
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return fallback;

    const out = { ...fallback };
    for (const token of tokens) {
      const normalized = token.toLowerCase();
      if (normalized === "alt" || normalized === "option") {
        out.altKey = true;
        continue;
      }
      if (normalized === "ctrl" || normalized === "control") {
        out.ctrlKey = true;
        continue;
      }
      if (normalized === "cmd" || normalized === "command" || normalized === "meta") {
        out.metaKey = true;
        continue;
      }
      if (normalized === "shift") {
        out.shiftKey = true;
        continue;
      }
      out.code = normalizeCodeToken(token);
    }
    return out;
  }

  function matchesShortcut(event, shortcut) {
    return (
      shortcut.code &&
      event.altKey === shortcut.altKey &&
      event.ctrlKey === shortcut.ctrlKey &&
      event.metaKey === shortcut.metaKey &&
      event.shiftKey === shortcut.shiftKey &&
      matchesKey(event, shortcut.code)
    );
  }

  function matchesKey(event, expectedCode) {
    if (event.code === expectedCode) return true;
    const keyAsCode = normalizeCodeToken(event.key || "");
    return keyAsCode === expectedCode;
  }

  function normalizeCodeToken(token) {
    const raw = token.trim();
    const lower = raw.toLowerCase();
    const map = {
      ",": "Comma",
      "<": "Comma",
      comma: "Comma",
      ".": "Period",
      ">": "Period",
      period: "Period",
      "-": "Minus",
      "_": "Minus",
      minus: "Minus",
      "=": "Equal",
      "+": "Equal",
      equal: "Equal",
      "[": "BracketLeft",
      "{": "BracketLeft",
      bracketleft: "BracketLeft",
      "]": "BracketRight",
      "}": "BracketRight",
      bracketright: "BracketRight",
      "/": "Slash",
      "?": "Slash",
      slash: "Slash",
      "\\": "Backslash",
      "|": "Backslash",
      backslash: "Backslash",
      ";": "Semicolon",
      ":": "Semicolon",
      semicolon: "Semicolon",
      "'": "Quote",
      '"': "Quote",
      quote: "Quote",
      "`": "Backquote",
      "~": "Backquote",
      backquote: "Backquote",
      space: "Space",
      arrowup: "ArrowUp",
      arrowdown: "ArrowDown",
      arrowleft: "ArrowLeft",
      arrowright: "ArrowRight",
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    };
    if (map[lower]) return map[lower];
    if (raw.length === 1 && /[a-z]/i.test(raw)) return `Key${raw.toUpperCase()}`;
    if (raw.length === 1 && /[0-9]/.test(raw)) return `Digit${raw}`;
    return raw;
  }

  function roundToHundredth(num) {
    return Math.round(num * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
