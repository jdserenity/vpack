importScripts("registry.js");

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

// Open a fresh onlinenotes.app note, wait for the generated URL link to appear,
// then redirect the tab to that permanent note URL.
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== "onlinenotes-open-new") return;

  const openerTitle = message.openerTitle ?? null;

  const createProps = { url: "https://onlinenotes.app/" };
  if (message.openerTabId) createProps.openerTabId = message.openerTabId;
  chrome.tabs.create(createProps, (tab) => {
    const listenerId = (tabId, changeInfo) => {
      if (tabId !== tab.id || changeInfo.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listenerId);

      // Poll for the generated note link — it may be inserted by JS after load.
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => {
              const a = document.querySelector(
                'a[href^="https://onlinenotes.app/"]'
              );
              // Ignore the homepage link itself
              if (!a) return null;
              const href = a.getAttribute("href");
              if (href === "https://onlinenotes.app/" || href === "https://onlinenotes.app") return null;
              return href;
            },
          },
          ([result]) => {
            const noteUrl = result?.result;
            if (noteUrl) {
              clearInterval(poll);
              chrome.tabs.update(tab.id, { url: noteUrl }, () => {
                if (!openerTitle) return;
                const titleListenerId = (titleTabId, titleChangeInfo) => {
                  if (titleTabId !== tab.id || titleChangeInfo.status !== "complete") return;
                  chrome.tabs.onUpdated.removeListener(titleListenerId);
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (title) => { document.title = title; },
                    args: [`Quick Note - ${openerTitle}`],
                  });
                };
                chrome.tabs.onUpdated.addListener(titleListenerId);
              });
            } else if (attempts >= 40) {
              // Give up after ~4 seconds — the tab stays on the homepage.
              clearInterval(poll);
            }
          }
        );
      }, 100);
    };

    chrome.tabs.onUpdated.addListener(listenerId);
  });
});

// Inject matching content scripts when a page finishes loading.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  chrome.storage.local.get(
    EXTENSIONS.map((e) => e.id),
    (stored) => {
      for (const ext of EXTENSIONS) {
        if (!stored[ext.id]) continue;
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

// Simple pattern matcher that supports trailing wildcards and "*" for all URLs.
function urlMatchesPattern(url, pattern) {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    return url.startsWith(pattern.slice(0, -1));
  }
  return url === pattern;
}

function getSettingStorageKey(ext, settingKey) {
  return `${ext.id}.settings.${settingKey}`;
}
