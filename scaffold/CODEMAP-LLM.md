# Architecture (agent reference)

Chrome MV3 personal extension pack. One install, many micro-extensions behind one popup.

## Stack / package
- Manifest V3; package version in `manifest.json` (`0.0.5` as of last write).
- Permissions: `storage`, `scripting`, `tabs`. Host: `<all_urls>`.
- Background: `background.js` service worker (`importScripts` `registry.js`, `url-matcher.js`).
- Popup: `menu/menu.html` + `menu/menu.js` + `menu/menu.css` (`action.default_popup`).
- Content: one `extensions/<id>/content.js` per micro-ext, injected at runtime via `chrome.scripting.executeScript` (not static content_scripts). No static `content_scripts` in manifest currently.

## Source layout
```
manifest.json
background.js
registry.js
url-matcher.js
menu/{menu.html,menu.js,menu.css}
extensions/<id>/content.js
extensions/archive/<id>/   # inactive micro-exts (not in registry); see extensions/archive/README.md
tests/*.test.js
tests/archive/             # tests for archived micro-exts
push_to_prod.sh
scripts/sz.py
scaffold/   # agent/docs (this file, ARCH-HUMAN, PROJECT-KNOWLEDGE, skills)
```

## Registry (`registry.js`) — SoT for popup + injection
`EXTENSIONS[]` fields:
- required: `id`, `name`, `description`, `version`, `matches[]`, `contentScript`
- optional: `settings[]`, `menuActions[]`, `liveAction`, `copyIconAction`

Current optional wiring:
| id | optional keys |
|----|----------------|
| word-count | `liveAction: getWordCount` |
| youtube-transcript-copy | `copyIconAction: copyYoutubeTranscript` |
| youtube-speed-hotkeys | `settings: hotkeyFaster, hotkeySlower` |
| geohot-blog-dark, hn-auto-collapse, clean-pirate-bay | none |

## Runtime
1. **Install defaults** (`chrome.runtime.onInstalled`): set missing storage keys only — each `ext.id → true`, plus `settings` defaults via `getSettingStorageKey`.
2. **Inject on load** (`tabs.onUpdated` `status===complete`): for each ext where storage `!== false` (missing = on), if any `matches` hits tab URL → `scripting.executeScript` that `contentScript`.
3. **Popup** (`menu/menu.js`): load enable flags + setting keys; render cards from `EXTENSIONS`; write toggles/settings to `chrome.storage.local`. `HIDDEN_EXTENSION_IDS` (collapsed `<details>`): `geohot-blog-dark`, `hn-auto-collapse`, `youtube-speed-hotkeys`, `clean-pirate-bay`.
4. **Popup actions** (`handleMenuAction`):
   - `copyYoutubeTranscript` → tab `getYoutubeTranscript` with send-then-inject retry
   - `openYoutubeWatchFromShorts` → rewrite active Shorts URL → watch URL

## URL matching (`url-matcher.js`)
- `*` → all URLs
- path `//` collapsed before match
- pattern ending `*` → prefix match after normalize
- else exact equality of normalized URL
- Node export for tests when `module.exports` present

## Storage keys
- enable: `<extension-id>` → boolean (default true if missing; UI treats `!== false` as on)
- setting: `<extension-id>.settings.<setting-key>` → string

## Micro-extensions
| id | name | matches | behavior |
|----|------|---------|----------|
| word-count | Quick Copy | `*` | msg `getWordCount` → `{count, text}` (main/body clone, strip chrome) |
| youtube-transcript-copy | YouTube Transcript Copy | youtube.com variants | msg `getYoutubeTranscript` on `/watch`; open panel, load virtualized segments, return text, close UI if opened |
| geohot-blog-dark | Geohot Blog Dark Mode | `https://geohot.github.io/blog/*` | dark CSS in `<head>` |
| hn-auto-collapse | HN Auto Collapse | `https://news.ycombinator.com/item*` | keep first 5 top-level + first reply each; click-collapse rest |
| youtube-speed-hotkeys | YouTube Speed Hotkeys | youtube.com variants | storage hotkeys; ±0.05 `playbackRate` clamp `[0.05,16]`; ignore inputs/contenteditable; restore after space-2x; toast |
| clean-pirate-bay | Clean Pirate Bay | `https://thepiratebay.org/*` | v0.1.1; hide `li.list-entry` whose `.item-type` is main category Porn (`Porn` / `Porn > *`, hrefs `category:5xx` / `top100:5xx`); CSS class + `!important`; MutationObserver |

## Archived micro-extensions
| id | path | notes |
|----|------|-------|
| onlinenotes-expand | `extensions/archive/onlinenotes-expand/` | Online Notes Hijack; restore via `RESTORE.md` (registry, manifest MAIN clipboard guard, bg open-new-note, menu action) |

## Popup↔content message contract (content scripts)
- word-count: `getWordCount`
- youtube-transcript-copy: `getYoutubeTranscript`
- YT transcript popup path: `sendMessage` → on no receiver, inject content script → retry

## Deploy / install
- Dev: Chrome `chrome://extensions` → Developer mode → Load unpacked → this repo root; reload after edits.
- Prod helper: `push_to_prod.sh` copies repo → fixed Proton Drive path `.../ProtonDrive-.../code/vpack` via temp sibling replace.

## Tests
`tests/`: `url-matcher`, `menu-css`, `youtube-speed-hotkeys`, `clean-pirate-bay`.
`tests/archive/`: `onlinenotes-expand`, `onlinenotes-page-clipboard-guard` (archived micro-ext).
