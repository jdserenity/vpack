# Archived micro-extensions

Code here is **not** registered in `registry.js` and is not injected.

## Restore Online Notes Hijack (`onlinenotes-expand`)

1. Move `extensions/archive/onlinenotes-expand/` → `extensions/onlinenotes-expand/`.
2. Add the registry entry (see `onlinenotes-expand/RESTORE.md`).
3. Restore the `manifest.json` `content_scripts` MAIN-world clipboard guard, background `onlinenotes-open-new` handler, and menu `openNewNote` action from `RESTORE.md`.
4. Move tests from `tests/archive/` back to `tests/` and fix require paths if needed.
5. Reload the unpacked extension.
