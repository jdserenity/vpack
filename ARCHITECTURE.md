# VPack Architecture

A single Manifest V3 Chrome extension that bundles multiple micro-extensions ("mods") under one popup UI.

---

## File Structure

```
manifest.json                  MV3 manifest — declares permissions, background worker, popup
background.js                  Service worker — injects content scripts, handles messages
registry.js                    Single source of truth for all mods (imported by both background and popup)
menu/
  menu.html                    Popup shell
  menu.js                      Builds popup UI from registry; handles toggles, settings, actions
  menu.css                     Popup styles
extensions/
  <mod-id>/
    content.js                 Injected into matching pages
```

---

## How a Mod Works

1. Register it in `registry.js` (see schema below).
2. Write a `content.js` that does its thing when injected.
3. That's it. The background and popup consume the registry automatically.

### Registry Schema

```js
{
  id: "my-mod",               // unique key, used as storage key for enabled state
  name: "My Mod",
  description: "...",
  version: "0.1.0",
  matches: ["https://example.com/*"],  // URL patterns; "*" matches everything
  contentScript: "extensions/my-mod/content.js",

  // Optional — renders user-configurable text inputs in the popup card
  settings: [
    {
      key: "myKey",           // stored as "<id>.settings.<key>"
      label: "Label",
      defaultValue: "...",
      placeholder: "...",
    }
  ],

  // Optional — renders buttons in the popup card that fire background actions
  menuActions: [
    { label: "Do something", action: "action-name" }
  ],

  // Optional — popup queries the active tab for a live result (e.g. word count)
  liveAction: "messageName",
}
```

---

## Data Flow

### Content script injection
```
tabs.onUpdated (complete)
  → background reads enabled state from storage
  → if mod matches URL: scripting.executeScript → content.js
```

### Toggle / settings (popup)
```
User interaction in popup
  → chrome.storage.local.set({ [id]: bool } or { [settingKey]: value })
  → background re-reads storage on next page load
```

### menuActions (popup buttons that trigger background logic)
```
User clicks button in popup
  → menu.js queries active tab (in popup context, where currentWindow is reliable)
  → sends message to background: { action, ...payload }
  → background.js handles the message
```

The popup queries the active tab itself before sending the message because `chrome.tabs.query` in a service worker uses `currentWindow`, which is unreliable with no window context — it can return wrong or no results.

### liveAction (live data in popup)
```
Popup opens
  → menu.js sends message to active tab's content script
  → content script responds with live data (e.g. word count + page text)
  → popup renders result
```

---

## URL Pattern Matching

Background uses a simple custom matcher (not the full Chrome glob spec):

- `"*"` — matches every URL
- `"https://example.com/*"` — prefix match (trailing `*` stripped, `startsWith` used)
- anything else — exact match

---

## Storage Keys

| Key | Value |
|-----|-------|
| `<mod-id>` | `true` / `false` — whether the mod is enabled |
| `<mod-id>.settings.<key>` | string — user-configured setting value |

All mods default to `true` on install. Defaults are only written if the key doesn't already exist (safe to re-install without wiping user settings).

---

## Vivaldi-Specific Notes

### onlinenotes-expand — tab stack placement

`menuActions` on this mod open a new tab at `onlinenotes.app`, scrape the generated note URL from the DOM (polled up to 4s), then redirect the tab to it.

**Known limitation:** the new tab opens *after* the active tab stack rather than *inside* it.

Everything was tried:
- `chrome.tabs.create` with no hints → Vivaldi places after stack
- `index: activeTab.index + 1` → no effect
- `openerTabId` queried from service worker → no effect (`currentWindow` unreliable in service worker context)
- `openerTabId` queried from popup and passed via message → no effect

**Conclusion:** Vivaldi does not honor `openerTabId` for stack placement when tabs are created by extensions. The "Open Tabs in Current Stack" setting only applies to tabs opened from in-page links, not programmatic `chrome.tabs.create` calls. There is no Chrome extension API surface that can force a tab into an existing Vivaldi stack.
