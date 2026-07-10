# Project knowledge

Hard-won lessons and context that should survive across agent sessions — setup traps, tooling quirks, things that would have been good to know going in.

Keep scaffold/ARCH-LLM.md for confirmed product and system facts only. One home per fact; don't duplicate architecture content here.

## The Pirate Bay DOM (clean-pirate-bay)

- Results are built client-side by `static/main.js` from apibay.org JSON (not server-rendered HTML tables).
- Each result is `li.list-entry` with category in `.item-type`. Subcats render as `Porn > HD Movies` links (`/search.php?q=category:5xx`); bare main cat `500` is plain text `"Porn"` with no link.
- TPB’s own name filter (`filter_list2`) sets `style.display = ''` on matches, so hiding must use a class + `display:none !important` (not only inline `display:none`) or rows come back.
