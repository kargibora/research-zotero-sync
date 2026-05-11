# Research Notes → Zotero Sync

Chrome MV3 extension that bulk-syncs your AlphaXiv folders, Scholar-Inbox collections, and AlphaXiv personal notes/highlights into Zotero, organized as proper folders. Includes a per-page sync as a fallback for papers seen elsewhere.

## What it does

- **Bulk sync — AlphaXiv:** all your folders (default + custom) become subcollections under `AlphaXiv/` in Zotero, with the papers added as journal-article items. Your personal comments and highlights become a Zotero child note per paper.
- **Bulk sync — Scholar-Inbox:** all your owner-collections (Bookmarks, custom lists, …) become subcollections under `Scholar-Inbox/`. (Per-collection paper listing is being added; current build creates the empty folders.)
- **Per-page sync:** unchanged — open any AlphaXiv / Scholar-Inbox paper page and click "Sync current page".
- **Dedup:** by DOI > arXiv ID > normalized title. The same paper across sources reuses one Zotero item, placed in both subcollections.
- **Idempotent:** re-running sync only patches changed papers; the sync-note marker prevents duplicate notes.

## Install for testing

1. Clone this repo.
2. `npm install`
3. Open `chrome://extensions` → Developer mode → Load unpacked → select this folder.
4. Open extension Options, paste a Zotero API key with read/write access.
5. Open the popup → "Sync AlphaXiv" or "Sync Scholar-Inbox".

## Tests

```
npm test
```

Unit tests cover adapters, dedup state, sync logic, and orchestrator. Tests run in Node via Vitest; no browser required.

## Auth

Auth uses your existing browser cookies for AlphaXiv (Clerk) and Scholar-Inbox. Both APIs are called from the extension service worker with `credentials: 'include'`. You must be logged into each site in Chrome for sync to work.

## Limitations

- Linked PDF URL only — does not upload binary PDFs to Zotero storage.
- One-way: source → Zotero. No two-way sync.
- Scholar-Inbox personal notes / highlights not included.
- Manual sync only; no scheduled background sync (planned for v0.3).

## Architecture

See `docs/superpowers/specs/2026-05-11-collection-sync-design.md` for the full design and `docs/superpowers/plans/2026-05-11-collection-sync.md` for the implementation plan.
