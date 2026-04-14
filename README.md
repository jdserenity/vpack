# VPack

A single Chrome extension that bundles multiple micro extensions, each doing one specific thing. Avoids cluttering the extensions page while letting you customize your browser however you want.

## Structure

```
VPack/
  manifest.json          # Chrome MV3 extension manifest
  background.js          # Service worker - injects scripts for enabled extensions
  registry.js            # Central list of all micro extensions
  menu/                  # Popup UI (click toolbar icon)
    menu.html
    menu.css
    menu.js
  extensions/            # Each micro extension gets its own folder
    hn-auto-collapse/
      content.js
```

## How it works

- **registry.js** defines each micro extension: id, name, description, version, URL match patterns, and content script path.
- **background.js** listens for page loads and dynamically injects the content script for any enabled micro extension whose URL pattern matches.
- The **popup menu** (toolbar icon) shows all micro extensions with version numbers and individual toggle switches. State is persisted in `chrome.storage.local`.

## Adding a new micro extension

1. Create a folder under `extensions/` with your content script.
2. Add an entry to the `EXTENSIONS` array in `registry.js` with `id`, `name`, `description`, `version`, `matches` (URL patterns), and `contentScript` (path to the script).
3. Reload the extension in `chrome://extensions`.

## Current micro extensions

| Name | Version | Description |
|------|---------|-------------|
| HN Auto Collapse | 0.0.3 | Auto-collapses Hacker News comments, showing the first 5 top-level comments and their first reply |
| YouTube Speed Hotkeys | 0.1.0 | Adds configurable hotkeys to increase/decrease YouTube playback speed by 0.05 |

## Install

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `VPack/` folder
