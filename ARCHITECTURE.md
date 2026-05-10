# VPack Architecture

## System Overview

VPack is a single Manifest V3 browser extension with:

- one background service worker (`background.js`)
- one popup UI (`menu/menu.html` + `menu/menu.js` + `menu/menu.css`)
- a registry of micro extensions (`registry.js`)
- one content script per micro extension (`extensions/*/content.js`)

`manifest.json` currently declares:

- permissions: `storage`, `scripting`, `tabs`
- host permissions: `<all_urls>`
- popup: `menu/menu.html`
- background service worker: `background.js`

## Source Layout

```text
manifest.json
background.js
registry.js
menu/
  menu.html
  menu.js
  menu.css
extensions/
  geohot-blog-dark/content.js
  hn-auto-collapse/content.js
  onlinenotes-expand/content.js
  word-count/content.js
  youtube-speed-hotkeys/content.js
  youtube-transcript-copy/content.js
push_to_prod.sh
```

## Registry Contract (`registry.js`)

`EXTENSIONS` is the source of truth for both popup rendering and runtime injection. Each item contains:

- required: `id`, `name`, `description`, `version`, `matches`, `contentScript`
- optional: `settings`, `menuActions`, `liveAction`, `copyIconAction`

Current optional usage:

- `settings`: used by `youtube-speed-hotkeys`
- `menuActions`: used by `onlinenotes-expand` (`openNewNote`)
- `liveAction`: used by `word-count` (`getWordCount`)
- `copyIconAction`: used by `youtube-transcript-copy` (`copyYoutubeTranscript`)

## Runtime Flows

### 1) Install defaults

On `chrome.runtime.onInstalled`, `background.js`:

- enables all registry extensions by default (`<id>: true`)
- seeds default setting values from registry settings
- only writes keys that are currently missing in `chrome.storage.local`

### 2) Per-tab content script injection

On `chrome.tabs.onUpdated` with `status === "complete"`:

- background loads enabled flags from storage
- evaluates each extension's `matches` against the tab URL
- injects matching content scripts through `chrome.scripting.executeScript`

### 3) Popup UI and state

When popup opens, `menu/menu.js`:

- loads extension enabled flags and all settings keys from storage
- renders one card per extension from `EXTENSIONS`
- writes enable/disable toggles directly to `chrome.storage.local`
- writes settings inputs on `change` and `blur`

Hidden-by-default popup section is controlled by `HIDDEN_EXTENSION_IDS`:

- `geohot-blog-dark`
- `hn-auto-collapse`
- `youtube-speed-hotkeys`

### 4) Popup actions

`menu/menu.js` routes button actions:

- `openNewNote`: sends `onlinenotes-open-new` message to background
- `copyYoutubeTranscript`: requests transcript from active tab
- `openYoutubeWatchFromShorts`: rewrites active Shorts URL to watch URL

For transcript requests, popup uses a send-then-inject retry path:

1. `chrome.tabs.sendMessage`
2. on common "receiving end does not exist" failures, inject `youtube-transcript-copy/content.js`
3. retry `sendMessage`

## URL Pattern Matching

`background.js` uses a small custom matcher:

- `"*"` matches all URLs
- repeated slashes in URL path segments are normalized (for example `//blog/...` -> `/blog/...`) before matching
- patterns ending in `*` perform prefix matching
- all other patterns require exact URL equality

## Storage Keys

- extension enabled flag: `<extension-id>` -> boolean
- extension setting value: `<extension-id>.settings.<setting-key>` -> string

## Micro Extensions (Current)

### `word-count` ("Quick Copy")

- matches: `*`
- responds to `getWordCount` message
- clones page main/body content, removes nav/chrome elements, returns:
  - `count`: word count
  - `text`: cleaned page text used by popup copy button

### `youtube-transcript-copy`

- matches YouTube domains in registry
- on `getYoutubeTranscript`:
  - validates watch-page URL (`/watch`)
  - opens transcript panel via visible UI controls
  - waits for transcript segments, scrolls to load virtualized content
  - returns normalized transcript text
  - closes panel/collapses description if script opened them

### `onlinenotes-expand`

- matches `https://onlinenotes.app/*`
- injects fullscreen editor CSS overrides
- remaps Tab key in editor to insert two spaces
- uses `ResizeObserver` to keep editor locked to viewport size
- popup action creates `https://onlinenotes.app/` tab, polls for generated permanent note URL, then redirects tab

### `geohot-blog-dark`

- matches `https://geohot.github.io/blog/*`
- injects dark-mode style overrides into page `<head>`

### `hn-auto-collapse`

- matches `https://news.ycombinator.com/item*`
- keeps first 5 top-level comments expanded
- keeps first direct reply for each of those top-level comments
- collapses the rest by clicking HN's collapse toggles

### `youtube-speed-hotkeys`

- matches YouTube domains in registry
- loads two configurable shortcuts from storage:
  - faster: `youtube-speed-hotkeys.settings.hotkeyFaster`
  - slower: `youtube-speed-hotkeys.settings.hotkeySlower`
- ignores key events while typing in inputs/contenteditable fields
- adjusts video playback speed by +/-0.05 and clamps to `[0.05, 16]`
- shows temporary on-page speed toast after each adjustment

## Deployment Helper

`push_to_prod.sh` copies the repo directory into a fixed Proton Drive location by staging to a temporary sibling directory, then replacing the target directory.
