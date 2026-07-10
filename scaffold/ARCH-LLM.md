# Architecture (agent reference)

Chrome MV3 personal extension pack. One install, many micro-extensions behind one popup.

## Stack / package
- Manifest V3; package version in `manifest.json` (`0.0.5` as of last write).
- Permissions: `storage`, `scripting`, `tabs`. Host: `<all_urls>`.
- Background: `background.js` service worker (`importScripts` `registry.js`, `url-matcher.js`).
- Popup: `menu/menu.html` + `menu/menu.js` + `menu/menu.css` (`action.default_popup`).
- Content: one `extensions/<id>/content.js` per micro-ext, injected at runtime via `chrome.scripting.executeScript` (not static content_scripts), except:
  - static MAIN-world: `extensions/onlinenotes-expand/page-clipboard-guard.js` on `https://onlinenotes.app/*`, `run_at: document_start` (declared in `manifest.json` `content_scripts`).

## Source layout
```
manifest.json
background.js
registry.js
url-matcher.js
menu/{menu.html,menu.js,menu.css}
extensions/<id>/content.js  (+ page-clipboard-guard.js for onlinenotes)
tests/*.test.js
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
| onlinenotes-expand | `menuActions: [{openNewNote}]` |
| youtube-speed-hotkeys | `settings: hotkeyFaster, hotkeySlower` |
| geohot-blog-dark, hn-auto-collapse, clean-pirate-bay | none |

## Runtime
1. **Install defaults** (`chrome.runtime.onInstalled`): set missing storage keys only — each `ext.id → true`, plus `settings` defaults via `getSettingStorageKey`.
2. **Inject on load** (`tabs.onUpdated` `status===complete`): for each enabled ext, if any `matches` hits tab URL → `scripting.executeScript` that `contentScript`.
3. **Popup** (`menu/menu.js`): load enable flags + setting keys; render cards from `EXTENSIONS`; write toggles/settings to `chrome.storage.local`. `HIDDEN_EXTENSION_IDS` (collapsed `<details>`): `geohot-blog-dark`, `hn-auto-collapse`, `youtube-speed-hotkeys`, `clean-pirate-bay`.
4. **Popup actions** (`handleMenuAction`):
   - `openNewNote` → bg msg `onlinenotes-open-new` (optional `openerTabId`, `openerTitle`)
   - `copyYoutubeTranscript` → tab `getYoutubeTranscript` with send-then-inject retry
   - `openYoutubeWatchFromShorts` → rewrite active Shorts URL → watch URL
5. **Bg open-new-note**: create `https://onlinenotes.app/`, poll for permanent note `a[href^="https://onlinenotes.app/"]` (~40×100ms), `tabs.update` to that URL; optional title `Quick Note - ${openerTitle}`.

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
| onlinenotes-expand | Online Notes Hijack | `https://onlinenotes.app/*` | fullscreen editor CSS; lock largest visible editor; Tab→2 spaces; ResizeObserver; MAIN clipboard guard drops bare single-line share-URL writes |
| geohot-blog-dark | Geohot Blog Dark Mode | `https://geohot.github.io/blog/*` | dark CSS in `<head>` |
| hn-auto-collapse | HN Auto Collapse | `https://news.ycombinator.com/item*` | keep first 5 top-level + first reply each; click-collapse rest |
| youtube-speed-hotkeys | YouTube Speed Hotkeys | youtube.com variants | storage hotkeys; ±0.05 `playbackRate` clamp `[0.05,16]`; ignore inputs/contenteditable; restore after space-2x; toast |
| clean-pirate-bay | Clean Pirate Bay | `https://thepiratebay.org/*` | hide `li.list-entry` whose `.item-type` is main category Porn (`Porn` / `Porn > *`, hrefs `category:5xx` / `top100:5xx`); CSS class + `!important`; MutationObserver |

## Popup↔content message contract (content scripts)
- word-count: `getWordCount`
- youtube-transcript-copy: `getYoutubeTranscript`
- YT transcript popup path: `sendMessage` → on no receiver, inject content script → retry

## Deploy / install
- Dev: Chrome `chrome://extensions` → Developer mode → Load unpacked → this repo root; reload after edits.
- Prod helper: `push_to_prod.sh` copies repo → fixed Proton Drive path `.../ProtonDrive-.../code/vpack` via temp sibling replace.

## Tests
`tests/`: `url-matcher`, `menu-css`, `onlinenotes-expand`, `onlinenotes-page-clipboard-guard`, `youtube-speed-hotkeys`, `clean-pirate-bay`.
