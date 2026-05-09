const container = document.getElementById("extensions");
const HIDDEN_EXTENSION_IDS = new Set([
  "geohot-blog-dark",
  "hn-auto-collapse",
  "youtube-speed-hotkeys",
]);

const storageKeys = [
  ...EXTENSIONS.map((e) => e.id),
  ...EXTENSIONS.flatMap((e) =>
    (e.settings || []).map((setting) => getSettingStorageKey(e, setting.key))
  ),
];

// Build UI for each micro extension.
chrome.storage.local.get(storageKeys, (stored) => {
  const visibleExtensions = [];
  const hiddenExtensions = [];

  for (const ext of EXTENSIONS) {
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
  if (action === "openNewNote") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
      chrome.runtime.sendMessage({
        action: "onlinenotes-open-new",
        openerTabId: activeTab?.id,
        openerTitle: activeTab?.title ?? null,
      });
    });
    return;
  }

  if (action === "copyYoutubeTranscript") {
    copyYoutubeTranscript(button);
  }
}

function copyYoutubeTranscript(button) {
  const originalTitle = button.getAttribute("title") || "Copy";
  button.disabled = true;
  button.setAttribute("title", "Copying transcript...");

  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    if (!activeTab?.id) {
      flashCopyIconResult(button, originalTitle, "No active tab");
      return;
    }

    requestTranscriptFromTab(activeTab.id, (response, error) => {
      if (error || !response?.ok || !response?.transcript) {
        flashCopyIconResult(button, originalTitle, mapTranscriptError(error, response));
        return;
      }

      navigator.clipboard.writeText(response.transcript)
        .then(() => {
          button.classList.add("copied");
          button.disabled = false;
          button.setAttribute("title", "Copied!");
          setTimeout(() => {
            button.classList.remove("copied");
            button.setAttribute("title", originalTitle);
          }, 1600);
        })
        .catch(() => {
          flashCopyIconResult(button, originalTitle, "Clipboard blocked");
        });
    });
  });
}

function requestTranscriptFromTab(tabId, callback) {
  sendMessageWithInjection(
    tabId,
    { action: "getYoutubeTranscript" },
    "extensions/youtube-transcript-copy/content.js",
    (response, error) => {
      if (!error && response?.ok && response?.transcript) {
        callback(response, null);
        return;
      }

      runMainWorldTranscriptFallback(tabId, (fallbackResponse, fallbackError) => {
        if (!fallbackError && fallbackResponse?.ok && fallbackResponse?.transcript) {
          callback(fallbackResponse, null);
          return;
        }

        callback(response || fallbackResponse, error || fallbackError);
      });
    }
  );
}

function sendMessageWithInjection(tabId, message, contentScript, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const firstError = chrome.runtime.lastError;
    if (!firstError) {
      callback(response, null);
      return;
    }

    if (!String(firstError.message || "").includes("Receiving end does not exist")) {
      callback(response, firstError);
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: [contentScript],
      },
      () => {
        const injectionError = chrome.runtime.lastError;
        if (injectionError) {
          callback(null, injectionError);
          return;
        }

        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
          callback(retryResponse, chrome.runtime.lastError || null);
        });
      }
    );
  });
}

function runMainWorldTranscriptFallback(tabId, callback) {
  const run = (useMainWorld) => {
    const scriptConfig = {
      target: { tabId },
      func: async () => {
        const result = { ok: false, error: "Failed to get transcript." };

        try {
          const videoId = (() => {
            try {
              const parsed = new URL(window.location.href);
              const host = parsed.hostname.replace(/^www\./, "");
              if (host === "youtube.com" || host === "m.youtube.com") {
                const vParam = parsed.searchParams.get("v");
                if (/^[A-Za-z0-9_-]{11}$/.test(vParam || "")) return vParam;
                const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
                if (shortsMatch && /^[A-Za-z0-9_-]{11}$/.test(shortsMatch[1])) {
                  return shortsMatch[1];
                }
              }
            } catch {
              return "";
            }
            return "";
          })();

          if (!videoId) {
            result.error = "Open a YouTube video page";
            return result;
          }

          const html = document.documentElement?.innerHTML || "";
          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
          const clientNameMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/);
          const clientVersionMatch =
            html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/);
          const paramsMatch =
            html.match(/"getTranscriptEndpoint":\{"params":"([^"]+)"\}/);

          const contextToken = '"INNERTUBE_CONTEXT":';
          const contextIndex = html.indexOf(contextToken);
          if (
            !apiKeyMatch ||
            !paramsMatch ||
            contextIndex === -1
          ) {
            result.error = "Could not read YouTube metadata";
            return result;
          }

          const contextStart = html.indexOf("{", contextIndex + contextToken.length);
          if (contextStart === -1) {
            result.error = "Could not read YouTube metadata";
            return result;
          }

          const sliceBalancedObject = (text, startIndex) => {
            let depth = 0;
            let inString = false;
            let escaped = false;

            for (let i = startIndex; i < text.length; i++) {
              const char = text[i];

              if (inString) {
                if (escaped) escaped = false;
                else if (char === "\\") escaped = true;
                else if (char === '"') inString = false;
                continue;
              }

              if (char === '"') {
                inString = true;
                continue;
              }

              if (char === "{") depth++;
              else if (char === "}") {
                depth--;
                if (depth === 0) return text.slice(startIndex, i + 1);
              }
            }

            return "";
          };

          const contextJsonText = sliceBalancedObject(html, contextStart);
          if (!contextJsonText) {
            result.error = "Could not read YouTube metadata";
            return result;
          }

          let context;
          try {
            context = JSON.parse(contextJsonText);
          } catch {
            result.error = "Could not read YouTube metadata";
            return result;
          }

          const decodeInline = (value) =>
            String(value || "")
              .replaceAll("\\u0026", "&")
              .replaceAll("\\u003d", "=")
              .replaceAll("\\u0025", "%")
              .replaceAll("\\/", "/");

          const apiKey = decodeInline(apiKeyMatch[1]);
          const transcriptParams = decodeInline(paramsMatch[1]);
          const endpoint =
            `/youtubei/v1/get_transcript?prettyPrint=false&key=${encodeURIComponent(apiKey)}`;

          const headers = { "Content-Type": "application/json" };
          if (clientNameMatch?.[1]) {
            headers["X-Youtube-Client-Name"] = clientNameMatch[1];
          }
          if (clientVersionMatch?.[1]) {
            headers["X-Youtube-Client-Version"] = decodeInline(clientVersionMatch[1]);
          }
          if (context?.client?.visitorData) {
            headers["X-Goog-Visitor-Id"] = context.client.visitorData;
          }

          const decodeURIComponentSafe = (value) => {
            try {
              return decodeURIComponent(value);
            } catch {
              return "";
            }
          };
          const paramsCandidates = [
            transcriptParams,
            decodeURIComponentSafe(transcriptParams),
          ].filter(Boolean);

          const collectCueLines = (node, lines) => {
            if (!node || typeof node !== "object") return;

            if (Array.isArray(node)) {
              node.forEach((item) => collectCueLines(item, lines));
              return;
            }

            if (
              node.transcriptCueRenderer &&
              typeof node.transcriptCueRenderer === "object"
            ) {
              const cue = node.transcriptCueRenderer.cue || node.transcriptCueRenderer;
              let line = "";
              if (typeof cue?.simpleText === "string") line = cue.simpleText;
              else if (Array.isArray(cue?.runs)) {
                line = cue.runs.map((run) => run?.text || "").join("");
              }

              line = String(line || "").replace(/\s+/g, " ").trim();
              if (line && lines[lines.length - 1] !== line) lines.push(line);
            }

            Object.values(node).forEach((value) => collectCueLines(value, lines));
          };

          for (const params of paramsCandidates) {
            const response = await fetch(endpoint, {
              method: "POST",
              credentials: "include",
              headers,
              body: JSON.stringify({
                context,
                params,
              }),
            });
            if (!response.ok) continue;

            const payload = await response.json();
            const lines = [];
            collectCueLines(payload, lines);
            const transcript = lines.join("\n").trim();
            if (transcript) {
              return { ok: true, transcript };
            }
          }

          result.error = "No transcript available";
          return result;
        } catch (error) {
          result.error =
            error && typeof error.message === "string"
              ? error.message
              : "Failed to get transcript.";
          return result;
        }
      },
    };

    if (useMainWorld) scriptConfig.world = "MAIN";

    chrome.scripting.executeScript(scriptConfig, (results) => {
      if (chrome.runtime.lastError) {
        if (
          useMainWorld &&
          String(chrome.runtime.lastError.message || "").toLowerCase().includes("world")
        ) {
          run(false);
          return;
        }
        callback(null, chrome.runtime.lastError);
        return;
      }

      callback(results?.[0]?.result || null, null);
    });
  };

  run(true);
}

function mapTranscriptError(error, response) {
  if (response?.error) {
    if (response.error.includes("No transcript")) return "No transcript available";
    if (response.error.includes("Open a YouTube")) return "Open a YouTube video page";
    if (response.error.includes("metadata")) return "Could not read YouTube metadata";
  }

  if (!error?.message) return "Failed";
  if (error.message.includes("Cannot access")) return "No access";
  return "Copy failed";
}

function flashCopyIconResult(button, originalTitle, failureTitle) {
  button.classList.add("error");
  button.setAttribute("title", failureTitle);
  setTimeout(() => {
    button.classList.remove("error");
    button.setAttribute("title", originalTitle);
    button.disabled = false;
  }, 1600);
}
