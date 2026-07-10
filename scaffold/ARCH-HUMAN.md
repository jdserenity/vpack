# Architecture (human-readable)

VPack is one Chrome extension (Manifest V3) that packs several small personal tools into a single install. You open one popup menu to toggle tools, change a few settings, and run actions (copy transcript, new note, etc.).

**Install (dev):** `chrome://extensions` → Developer mode → Load unpacked → this repo folder. Reload the extension after code changes.

**Ship helper:** `./push_to_prod.sh` copies the project into a fixed Proton Drive folder (staging temp dir, then replace).

---

## How the pieces fit

```text
┌─────────────────────────────────────────────────────────────┐
│  Chrome (Manifest V3 package)                               │
│                                                             │
│  ┌──────────────┐    storage     ┌───────────────────────┐  │
│  │ Popup menu   │◄──────────────►│ chrome.storage.local  │  │
│  │ menu/*       │  enable/settings│  <id> → on/off       │  │
│  └──────┬───────┘                │  <id>.settings.*     │  │
│         │ messages / inject       └───────────────────────┘  │
│         ▼                                                   │
│  ┌──────────────┐  on tab load   ┌───────────────────────┐  │
│  │ Background   │───────────────►│ Page content scripts  │  │
│  │ background.js│  match URL +   │ extensions/*/content  │  │
│  │ + registry   │  if enabled    │ (+ one MAIN-world     │  │
│  │ + url-matcher│                │  clipboard guard)     │  │
│  └──────────────┘                └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

1. **`registry.js`** lists every micro-extension (name, URL patterns, which script file, optional settings/buttons). Popup and background both use this list as the source of truth.
2. **Background** turns tools on by default on first install, and when a tab finishes loading, injects the matching content scripts for enabled tools.
3. **Popup** draws one card per tool (some sit under “Hidden extensions”), saves toggles/settings, and handles button actions.
4. **Content scripts** run inside the page (word count, dark mode, speed hotkeys, etc.). Almost all are injected only when needed; Online Notes also has a small script that always starts early so it can guard the clipboard API.

---

## Repo map

| Path | Role |
|------|------|
| `manifest.json` | Extension metadata, permissions, popup, background, static clipboard-guard script |
| `background.js` | Defaults on install, inject scripts on tab load, “create new Online Notes” flow |
| `registry.js` | Catalog of micro-extensions |
| `url-matcher.js` | Simple URL pattern matching (`*`, prefix `…*`, exact; normalizes `//` in paths) |
| `menu/` | Popup HTML/CSS/JS |
| `extensions/<id>/` | One folder per tool; main logic in `content.js` |
| `tests/` | Automated tests (URL matcher, Online Notes, YouTube speed, menu CSS) |
| `push_to_prod.sh` | Copy tree to Proton Drive |
| `scaffold/` | Agent rules + architecture docs (this file, `ARCH-LLM.md`, lessons) |

---

## Storage

- **On/off:** key = extension id (e.g. `word-count`) → `true` / `false`. Missing key means “on” in the UI.
- **Settings:** key = `<id>.settings.<name>` (e.g. YouTube speed hotkeys).

---

## Micro-extensions (what each does)

| Menu name | Id | Where it runs | Notes |
|-----------|-----|---------------|--------|
| Quick Copy | `word-count` | Any page | Word count + copy cleaned main text |
| YouTube Transcript Copy | `youtube-transcript-copy` | YouTube | Copy full transcript; optional Shorts → watch button |
| Online Notes Hijack | `onlinenotes-expand` | onlinenotes.app | Editor fills the window; “Create new note”; clipboard guard against bare share-URL copies |
| Geohot Blog Dark Mode | `geohot-blog-dark` | geohot blog | Dark styling *(hidden section in popup)* |
| HN Auto Collapse | `hn-auto-collapse` | HN item pages | First 5 top-level + first reply open; rest collapsed *(hidden)* |
| YouTube Speed Hotkeys | `youtube-speed-hotkeys` | YouTube | Configurable faster/slower keys, ±0.05 speed *(hidden)* |

**Hidden section:** Geohot dark, HN collapse, and YouTube speed sit under a collapsible “Hidden extensions” block so the main popup stays short. They still work when enabled.

---

## Adding or changing a micro-extension

1. Add or edit `extensions/<id>/content.js` (and any companion scripts).
2. Register it in `registry.js` (`matches`, `contentScript`, optional settings/actions).
3. If something must run in the page’s real JS world at start (like the Online Notes clipboard guard), also declare it under `content_scripts` in `manifest.json`.
4. Reload the unpacked extension in Chrome.
5. Prefer tests under `tests/` for logic that isn’t pure UI.
