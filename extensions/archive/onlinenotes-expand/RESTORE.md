# Restore notes — Online Notes Hijack (`onlinenotes-expand`) v0.2.4

Archived: inactive, kept for possible restore.

## `registry.js` entry

```js
{
  id: "onlinenotes-expand",
  name: "Online Notes Hijack",
  description: "Makes the text editor on onlinenotes.app fill the entire screen. Responsive to Vivaldi tab tiling.",
  version: "0.2.4",
  matches: ["https://onlinenotes.app/*"],
  contentScript: "extensions/onlinenotes-expand/content.js",
  menuActions: [
    {
      label: "Create new note",
      action: "openNewNote",
    },
  ],
},
```

## `manifest.json` — static MAIN-world content script

```json
"content_scripts": [
  {
    "matches": ["https://onlinenotes.app/*"],
    "js": ["extensions/onlinenotes-expand/page-clipboard-guard.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

## `menu/menu.js` — in `handleMenuAction`

```js
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
```

## `background.js` — message listener (before inject listener)

```js
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
              clearInterval(poll);
            }
          }
        );
      }, 100);
    };

    chrome.tabs.onUpdated.addListener(listenerId);
  });
});
```
