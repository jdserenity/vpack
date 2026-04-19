const container = document.getElementById("extensions");

const storageKeys = [
  ...EXTENSIONS.map((e) => e.id),
  ...EXTENSIONS.flatMap((e) =>
    (e.settings || []).map((setting) => getSettingStorageKey(e, setting.key))
  ),
];

// Build UI for each micro extension.
chrome.storage.local.get(
  storageKeys,
  (stored) => {
    for (const ext of EXTENSIONS) {
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
          if (action === "openNewNote") {
            chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
              chrome.runtime.sendMessage({
                action: "onlinenotes-open-new",
                openerTabId: activeTab?.id,
                openerTitle: activeTab?.title ?? null,
              });
            });
          }
        });
      });

      container.appendChild(card);
    }
  }
);

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
