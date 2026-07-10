const container = document.getElementById("extensions");
const YT_LOG_PREFIX = "[VPack][YT Transcript][Popup]";
let ytLogSeq = 0;
const popupBootAt = Date.now();
const HIDDEN_EXTENSION_IDS = new Set([
  "geohot-blog-dark",
  "hn-auto-collapse",
  "youtube-speed-hotkeys",
  "clean-pirate-bay",
]);

const storageKeys = [
  ...EXTENSIONS.map((e) => e.id),
  ...EXTENSIONS.flatMap((e) =>
    (e.settings || []).map((setting) => getSettingStorageKey(e, setting.key))
  ),
];

// Build UI for each micro extension.
ytLog("popup boot", {
  hasContainer: Boolean(container),
  extensionsInRegistry: EXTENSIONS.length,
});
chrome.storage.local.get(storageKeys, (stored) => {
  ytLog("storage loaded for menu", {
    storageKeyCount: storageKeys.length,
    storedKeyCount: Object.keys(stored || {}).length,
  });
  const visibleExtensions = [];
  const hiddenExtensions = [];

  for (const ext of EXTENSIONS) {
    ytLog("classifying extension", {
      id: ext.id,
      hidden: HIDDEN_EXTENSION_IDS.has(ext.id),
      enabled: stored[ext.id] !== false,
    });
    if (HIDDEN_EXTENSION_IDS.has(ext.id)) hiddenExtensions.push(ext);
    else visibleExtensions.push(ext);
  }

  for (const ext of visibleExtensions) {
    container.appendChild(createExtensionCard(ext, stored));
  }

  if (hiddenExtensions.length) {
    container.appendChild(createHiddenExtensionsSection(hiddenExtensions, stored));
  }
});

function createHiddenExtensionsSection(hiddenExtensions, stored) {
  const dropdown = document.createElement("details");
  dropdown.className = "ext-hidden-dropdown";

  const summary = document.createElement("summary");
  summary.className = "ext-hidden-summary";
  summary.textContent = `Hidden extensions (${hiddenExtensions.length})`;

  const body = document.createElement("div");
  body.className = "ext-hidden-list";
  for (const ext of hiddenExtensions) {
    body.appendChild(createExtensionCard(ext, stored));
  }

  dropdown.appendChild(summary);
  dropdown.appendChild(body);
  return dropdown;
}

function createExtensionCard(ext, stored) {
  const enabled = stored[ext.id] !== false;
  ytLog("createExtensionCard", {
    id: ext.id,
    enabled,
    hasCopyAction: Boolean(ext.copyIconAction),
    hasLiveAction: Boolean(ext.liveAction),
  });

  const card = document.createElement("div");
  card.className = "ext-card";
  const settingsHtml = (ext.settings || [])
    .map((setting) => {
      const storageKey = getSettingStorageKey(ext, setting.key);
      const value = stored[storageKey] ?? setting.defaultValue ?? "";
      const placeholder = setting.placeholder || "";
      return `
        <label class="ext-setting-row">
          <span class="ext-setting-label">${setting.label}</span>
          <input
            class="ext-setting-input"
            type="text"
            data-setting-key="${storageKey}"
            value="${escapeHtml(value)}"
            placeholder="${escapeHtml(placeholder)}"
          />
        </label>
      `;
    })
    .join("");

  const menuActionsHtml = (ext.menuActions || [])
    .map(
      (ma) => `
        <button class="ext-menu-action" data-action="${escapeHtml(ma.action)}">
          ${escapeHtml(ma.label)}
        </button>
      `
    )
    .join("");

  card.innerHTML = `
    <div class="ext-main">
      <div class="ext-info">
        <span class="ext-name">${ext.name}</span>
        <span class="ext-version">v${ext.version}</span>
        <div class="ext-desc">${ext.description}</div>
        ${ext.liveAction ? `
          <div class="ext-live-row">
            <div class="ext-live-result">—</div>
            <button class="ext-copy-icon" title="Copy page text" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        ` : ""}
        ${ext.copyIconAction && !ext.liveAction ? `
          <div class="ext-copy-only-row">
            <button class="ext-copy-icon" data-action="${escapeHtml(ext.copyIconAction)}" title="Copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            ${ext.id === "youtube-transcript-copy" ? `
              <button class="ext-copy-icon" data-action="openYoutubeWatchFromShorts" title="Open Shorts in watch page">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7"></path>
                  <path d="M7 7h10v10"></path>
                </svg>
              </button>
            ` : ""}
          </div>
        ` : ""}
      </div>
      <label class="toggle">
        <input type="checkbox" data-id="${ext.id}" ${enabled ? "checked" : ""} />
        <span class="slider"></span>
      </label>
    </div>
    ${menuActionsHtml ? `<div class="ext-menu-actions">${menuActionsHtml}</div>` : ""}
    ${settingsHtml ? `<div class="ext-settings">${settingsHtml}</div>` : ""}
  `;

  if (ext.liveAction && enabled) {
    const resultEl = card.querySelector(".ext-live-result");
    const copyBtn = card.querySelector(".ext-copy-icon");
    let cachedText = null;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: ext.liveAction }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resultEl.textContent = "Reload page to count";
          return;
        }
        resultEl.textContent = response.count.toLocaleString() + " words";
        if (response.text) {
          cachedText = response.text;
          copyBtn.disabled = false;
        }
      });
    });

    copyBtn.addEventListener("click", () => {
      if (!cachedText) return;
      navigator.clipboard.writeText(cachedText).then(() => {
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 2000);
      });
    });
  }

  card.querySelector("input[type='checkbox']").addEventListener("change", (e) => {
    chrome.storage.local.set({ [ext.id]: e.target.checked });
  });

  card.querySelectorAll(".ext-setting-input").forEach((input) => {
    const saveSetting = () => {
      chrome.storage.local.set({ [input.dataset.settingKey]: input.value.trim() });
    };
    input.addEventListener("change", saveSetting);
    input.addEventListener("blur", saveSetting);
  });

  card.querySelectorAll(".ext-menu-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      handleMenuAction(action, btn);
    });
  });

  card.querySelectorAll(".ext-copy-icon[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      handleMenuAction(action, btn);
    });
  });

  return card;
}

function getSettingStorageKey(ext, settingKey) {
  return `${ext.id}.settings.${settingKey}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function handleMenuAction(action, button) {
  ytLog("handleMenuAction invoked", { action });
  if (action === "copyYoutubeTranscript") {
    copyYoutubeTranscript(button);
    return;
  }

  if (action === "openYoutubeWatchFromShorts") {
    openYoutubeWatchFromShorts(button);
  }
}

function copyYoutubeTranscript(button) {
  const originalTitle = button.getAttribute("title") || "Copy";
  ytLog("copyYoutubeTranscript: click", {
    originalTitle,
    buttonDisabled: button.disabled,
  });
  button.disabled = true;
  button.setAttribute("title", "Copying transcript...");

  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    ytLog("copyYoutubeTranscript: active tab query result", {
      hasTab: Boolean(activeTab),
      tabId: activeTab?.id ?? null,
      url: activeTab?.url || "",
      title: activeTab?.title || "",
    });
    if (!activeTab?.id) {
      ytWarn("copyYoutubeTranscript: no active tab id");
      flashCopyIconResult(button, originalTitle, "No active tab");
      return;
    }

    ytLog("copyYoutubeTranscript: requesting transcript", {
      tabId: activeTab.id,
      url: activeTab.url || "",
    });
    requestTranscriptFromTab(activeTab.id, (response, error) => {
      ytLog("copyYoutubeTranscript: transcript response", {
        ok: Boolean(response?.ok),
        hasTranscript: Boolean(response?.transcript),
        responseError: response?.error || "",
        runtimeError: error?.message || "",
      });
      if (error || !response?.ok || !response?.transcript) {
        ytWarn("copyYoutubeTranscript: request failed", {
          mappedError: mapTranscriptError(error, response),
        });
        flashCopyIconResult(button, originalTitle, mapTranscriptError(error, response));
        return;
      }

      ytLog("copyYoutubeTranscript: clipboard write start", {
        chars: response.transcript.length,
      });
      navigator.clipboard.writeText(response.transcript)
        .then(() => {
          ytLog("copyYoutubeTranscript: clipboard write success");
          button.classList.add("copied");
          button.disabled = false;
          button.setAttribute("title", "Copied!");
          setTimeout(() => {
            button.classList.remove("copied");
            button.setAttribute("title", originalTitle);
          }, 1600);
        })
        .catch(() => {
          ytWarn("copyYoutubeTranscript: clipboard write failed");
          flashCopyIconResult(button, originalTitle, "Clipboard blocked");
        });
    });
  });
}

function requestTranscriptFromTab(tabId, callback) {
  ytLog("requestTranscriptFromTab start", { tabId });
  sendMessageWithInjection(
    tabId,
    { action: "getYoutubeTranscript" },
    "extensions/youtube-transcript-copy/content.js",
    callback
  );
}

function sendMessageWithInjection(tabId, message, contentScript, callback) {
  ytLog("sendMessageWithInjection entry", {
    tabId,
    action: message?.action || "",
    contentScript,
  });
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const firstError = chrome.runtime.lastError;
    if (!firstError) {
      ytLog("sendMessageWithInjection: primary sendMessage succeeded", { tabId });
      ytLog("sendMessageWithInjection: primary response summary", {
        hasResponse: Boolean(response),
        ok: Boolean(response?.ok),
        hasTranscript: Boolean(response?.transcript),
        responseError: response?.error || "",
      });
      callback(response, null);
      return;
    }

    ytWarn("sendMessageWithInjection: primary sendMessage error", {
      tabId,
      message: firstError.message || "",
      shouldInject: shouldInjectAndRetry(firstError),
    });
    if (!shouldInjectAndRetry(firstError)) {
      ytWarn("sendMessageWithInjection: sendMessage failed", {
        tabId,
        message: firstError.message || "",
      });
      callback(response, firstError);
      return;
    }

    ytLog("sendMessageWithInjection: injecting content script", {
      tabId,
      contentScript,
    });
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: [contentScript],
      },
      () => {
        const injectionError = chrome.runtime.lastError;
        if (injectionError) {
          ytWarn("sendMessageWithInjection: injection failed", {
            tabId,
            message: injectionError.message || "",
          });
          callback(null, injectionError);
          return;
        }

        ytLog("sendMessageWithInjection: retrying sendMessage", { tabId });
        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
          if (chrome.runtime.lastError) {
            ytWarn("sendMessageWithInjection: retry failed", {
              tabId,
              message: chrome.runtime.lastError.message || "",
            });
          }
          if (!chrome.runtime.lastError && !retryResponse) {
            ytWarn("sendMessageWithInjection: retry got empty response", { tabId });
          }
          if (!chrome.runtime.lastError) {
            ytLog("sendMessageWithInjection: retry response summary", {
              hasResponse: Boolean(retryResponse),
              ok: Boolean(retryResponse?.ok),
              hasTranscript: Boolean(retryResponse?.transcript),
              responseError: retryResponse?.error || "",
            });
          }
          callback(retryResponse, chrome.runtime.lastError || null);
        });
      }
    );
  });
}

function shouldInjectAndRetry(error) {
  const message = String(error?.message || "").toLowerCase();
  const result =
    message.includes("receiving end does not exist") ||
    message.includes("message port closed before a response was received");
  ytLog("shouldInjectAndRetry evaluated", {
    message,
    result,
  });
  return result;
}

function mapTranscriptError(error, response) {
  ytLog("mapTranscriptError input", {
    runtimeError: error?.message || "",
    responseError: response?.error || "",
    ok: Boolean(response?.ok),
    hasTranscript: Boolean(response?.transcript),
  });
  if (response?.error) {
    if (response.error.includes("does not have a transcript")) return "No transcript";
    if (response.error.includes("Open a YouTube")) return "Open a YouTube video";
    if (response.error.includes("Could not open")) return "Could not open transcript";
    if (response.error.includes("Transcript did not load")) return "Transcript timed out";
    if (response.error.includes("empty")) return "Transcript was empty";
  }

  if (!error?.message) return "Failed";
  if (error.message.includes("Cannot access")) return "No access";
  return "Copy failed";
}

function openYoutubeWatchFromShorts(button) {
  const originalTitle = button.getAttribute("title") || "Open watch";
  ytLog("openYoutubeWatchFromShorts: click", {
    originalTitle,
    buttonDisabled: button.disabled,
  });
  button.disabled = true;
  button.setAttribute("title", "Opening watch page...");

  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    ytLog("openYoutubeWatchFromShorts: active tab query result", {
      hasTab: Boolean(activeTab),
      tabId: activeTab?.id ?? null,
      url: activeTab?.url || "",
    });
    if (!activeTab?.id || !activeTab.url) {
      flashCopyIconResult(button, originalTitle, "No active tab");
      return;
    }

    if (!isYoutubeShortsUrl(activeTab.url)) {
      ytWarn("openYoutubeWatchFromShorts: active tab is not Shorts", {
        url: activeTab.url || "",
      });
      flashCopyIconResult(button, originalTitle, "Open a Shorts page");
      return;
    }

    const videoId = getYoutubeVideoIdFromUrl(activeTab.url);
    ytLog("openYoutubeWatchFromShorts: parsed video id", { videoId });
    if (!videoId) {
      flashCopyIconResult(button, originalTitle, "No Shorts video id");
      return;
    }

    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    ytLog("openYoutubeWatchFromShorts: opening watch URL", { watchUrl });
    chrome.tabs.update(activeTab.id, { url: watchUrl }, () => {
      if (chrome.runtime.lastError) {
        ytWarn("openYoutubeWatchFromShorts: tab update failed", {
          message: chrome.runtime.lastError.message || "",
        });
        flashCopyIconResult(button, originalTitle, "Could not open watch");
        return;
      }

      button.classList.add("copied");
      button.disabled = false;
      button.setAttribute("title", "Opened watch page");
      setTimeout(() => {
        button.classList.remove("copied");
        button.setAttribute("title", originalTitle);
      }, 1600);
    });
  });
}

function isYoutubeShortsUrl(rawUrl) {
  ytLog("isYoutubeShortsUrl input", { rawUrl });
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    ytWarn("isYoutubeShortsUrl invalid URL", { rawUrl });
    return false;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const result =
    (host === "youtube.com" || host === "m.youtube.com") &&
    /^\/shorts\/[^/?#]+/.test(parsed.pathname);
  ytLog("isYoutubeShortsUrl evaluated", {
    host,
    pathname: parsed.pathname,
    result,
  });
  return result;
}

function getYoutubeVideoIdFromUrl(rawUrl) {
  ytLog("getYoutubeVideoIdFromUrl input", { rawUrl });
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    ytWarn("getYoutubeVideoIdFromUrl invalid URL", { rawUrl });
    return "";
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shortsMatch?.[1]) {
      ytLog("getYoutubeVideoIdFromUrl shorts match", { id: shortsMatch[1] });
      return shortsMatch[1];
    }

    const vParam = parsed.searchParams.get("v");
    if (vParam) {
      ytLog("getYoutubeVideoIdFromUrl v param match", { id: vParam });
      return vParam;
    }
  }

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id) {
      ytLog("getYoutubeVideoIdFromUrl youtu.be match", { id });
      return id;
    }
  }

  ytWarn("getYoutubeVideoIdFromUrl no id found", {
    host,
    pathname: parsed.pathname,
    search: parsed.search,
  });
  return "";
}

function flashCopyIconResult(button, originalTitle, failureTitle) {
  ytWarn("flashCopyIconResult", {
    originalTitle,
    failureTitle,
  });
  button.classList.add("error");
  button.setAttribute("title", failureTitle);
  setTimeout(() => {
    button.classList.remove("error");
    button.setAttribute("title", originalTitle);
    button.disabled = false;
  }, 1600);
}

function ytLog(_message, _details) {}

function ytWarn(_message, _details) {}
