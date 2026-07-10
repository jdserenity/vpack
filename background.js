importScripts("registry.js");
importScripts("url-matcher.js");

// Set all extensions enabled by default on install.
chrome.runtime.onInstalled.addListener(() => {
  const defaults = {};
  for (const ext of EXTENSIONS) {
    defaults[ext.id] = true;
    if (ext.settings) {
      for (const setting of ext.settings) {
        defaults[getSettingStorageKey(ext, setting.key)] = setting.defaultValue;
      }
    }
  }
  chrome.storage.local.get(Object.keys(defaults), (stored) => {
    const toSet = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (stored[key] === undefined) toSet[key] = value;
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });
});

// Inject matching content scripts when a page finishes loading.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  chrome.storage.local.get(
    EXTENSIONS.map((e) => e.id),
    (stored) => {
      for (const ext of EXTENSIONS) {
        // Missing key means enabled (same contract as the popup).
        if (stored[ext.id] === false) continue;
        const matches = ext.matches.some((pattern) =>
          urlMatchesPattern(tab.url, pattern)
        );
        if (matches) {
          chrome.scripting.executeScript({
            target: { tabId },
            files: [ext.contentScript],
          });
        }
      }
    }
  );
});

function getSettingStorageKey(ext, settingKey) {
  return `${ext.id}.settings.${settingKey}`;
}
