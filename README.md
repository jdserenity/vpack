# VPack

VPack is a single Chrome Manifest V3 extension that bundles several personal micro extensions behind one popup menu.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repo folder.
4. Pin `VPack` if you want quick access to the popup.

## Included micro extensions

- `Quick Copy` (`word-count`): shows page word count in the popup and copies extracted main-page text.
- `YouTube Transcript Copy` (`youtube-transcript-copy`): copies transcript text from the active YouTube watch page.
- `Geohot Blog Dark Mode` (`geohot-blog-dark`): injects dark styling on `geohot.github.io/blog`.
- `HN Auto Collapse` (`hn-auto-collapse`): collapses Hacker News thread comments except first 5 top-level comments and each first reply.
- `YouTube Speed Hotkeys` (`youtube-speed-hotkeys`): configurable hotkeys for +/-0.05 speed changes on YouTube.
- `Clean Pirate Bay` (`clean-pirate-bay`): hides The Pirate Bay results whose main category is Porn.

## Development

- Edit extension metadata in `registry.js`.
- Add or update behavior in `extensions/<id>/content.js`.
- Reload the unpacked extension in `chrome://extensions` after changes.
- Popup/background behavior lives in `menu/` and `background.js`.
- For deeper project details, see `ARCHITECTURE.md`.
