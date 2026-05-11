# Research → Zotero Sync

Bulk-sync your reading lists from **AlphaXiv** and **Scholar-Inbox** into **Zotero**, organized as proper folders. A Chrome extension for researchers who keep curating papers on AlphaXiv / Scholar-Inbox but want everything to land in Zotero automatically — no manual downloading, no copy-pasting metadata.

[![Manifest V3](https://img.shields.io/badge/manifest-v3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](./manifest.json)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen.svg)](./tests)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Chrome](https://img.shields.io/badge/chrome-supported-success.svg)](https://www.google.com/chrome/)

> Add a screenshot at `docs/screenshots/popup.png` and reference it here once you have one. The popup is a clean card-based UI showing each source's last-sync state and a one-click "Sync all sources" action.

---

## Features

- **Bulk sync — AlphaXiv:** every folder (default + custom) becomes a Zotero subcollection under `AlphaXiv/`. Papers are added as journal-article items with title, authors, abstract, arXiv ID tag, and a linked PDF URL.
- **Bulk sync — Scholar-Inbox:** every owner-collection becomes a subcollection under `Scholar-Inbox/`. Papers carry the same metadata and link back to their SI detail page.
- **Personal notes (AlphaXiv):** comments and highlights you've made on AlphaXiv papers are saved as Zotero child notes attached to the corresponding item.
- **Per-page sync:** open any AlphaXiv or Scholar-Inbox paper and one-click save it to Zotero — useful for papers not yet in any of your collections.
- **Cross-source dedup:** the same paper appearing in both AlphaXiv and SI shares one Zotero item, placed in both subcollections (matched by DOI > arXiv ID > normalized title).
- **Idempotent:** re-running sync only patches changed papers; the sync-note marker prevents duplicate notes.
- **Cookie-based auth, no API keys to fetch:** uses your existing browser session for AlphaXiv and Scholar-Inbox via a content-script proxy. Only Zotero needs an API key.

---

## Install (developer / from source)

This extension is not yet on the Chrome Web Store. To install from source:

1. Clone this repository
   ```bash
   git clone https://github.com/<your-username>/research-zotero-sync.git
   cd research-zotero-sync
   ```
2. Install dev dependencies (only needed if you want to run tests)
   ```bash
   npm install
   ```
3. In Chrome, open `chrome://extensions`, enable **Developer mode** (top-right), click **Load unpacked**, and select this folder
4. Pin the extension to your toolbar for one-click access

---

## Setup (one-time)

1. **Generate a Zotero API key** at https://www.zotero.org/settings/security#applications — make sure **"Allow write access"** is checked
2. Click the extension icon → the gear in the top-right → paste the key into Options → **Save**
3. Open https://www.alphaxiv.org and sign in (if you use AlphaXiv)
4. Open https://www.scholar-inbox.com and sign in (if you use Scholar-Inbox)
5. Click the extension icon → **Sync all sources**

That's it. Your Zotero library will gain `AlphaXiv/` and `Scholar-Inbox/` parent collections containing your folders / lists.

> The AlphaXiv and Scholar-Inbox tabs need to stay open during sync — the extension borrows their cookies via a content-script proxy (their session cookies are `SameSite=Lax`, so the extension's service worker can't carry them directly).

---

## How it works

```
┌─────────────────┐    proxy fetch    ┌──────────────────┐
│   Popup UI      │ ───────────────▶  │ Background SW    │
│  (cards, pills) │ ◀───────────────  │ (message router) │
└─────────────────┘                   └──────────────────┘
                                             │
                                  ┌──────────┼──────────┐
                                  ▼          ▼          ▼
                          ┌───────────┐  ┌──────┐  ┌───────────┐
                          │ AlphaXiv  │  │  SI  │  │  Zotero   │
                          │ adapter   │  │ adpt │  │  client   │
                          └─────┬─────┘  └──┬───┘  └─────┬─────┘
                                │  fetch    │              │ Web API v3
                                ▼  via CS   ▼              ▼
                         ┌───────────────────────┐   ┌──────────────┐
                         │ Source sites (Chrome  │   │ api.zotero   │
                         │ tab cookies)          │   │ .org         │
                         └───────────────────────┘   └──────────────┘
```

- All source-API calls go through a `proxyFetch` handler in `src/content.js` so SameSite cookies attach properly.
- Each source has an **adapter** that returns a normalized `AdapterResult { collections, notes }`. The Zotero **sync** module consumes that and writes idempotently.
- A `chrome.storage.local` index maps `source:sourceId → zoteroKey` to prevent duplicates across runs.

See [`docs/superpowers/specs/2026-05-11-collection-sync-design.md`](./docs/superpowers/specs/2026-05-11-collection-sync-design.md) for the full architecture.

---

## Roadmap

- **v0.3 — PDF download to Zotero storage.** Currently we attach a linked PDF URL; v0.3 will upload the actual binary so Zotero's built-in viewer / annotator works offline. Uses Zotero's multi-step file upload flow.
- **v0.3+ — Scheduled background sync** via `chrome.alarms` (currently manual-only).
- **v0.4 — Two-way sync** (Zotero → source) so reading status added in Zotero flows back to AlphaXiv folders.
- **More sources** — Semantic Scholar, OpenReview, NeurIPS proceedings, etc.

PRs welcome on any of these.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `❌ Could not establish connection. Receiving end does not exist.` | The source tab was opened before the extension was installed/reloaded. Refresh the tab once. (The extension also auto-injects on retry, so re-clicking sync usually works.) |
| `❌ Open https://www.alphaxiv.org in a tab…` | No source tab is open. Open one and sign in. |
| `❌ Zotero API 403: write permission` | Your Zotero API key is read-only. Generate a new one with **Allow write access** ticked. |
| `❌ Not logged in to AlphaXiv / Scholar-Inbox` | Your source session expired. Sign in again in the source tab. |
| Sync says ✅ but I see nothing in Zotero | You may be looking at the desktop app, which doesn't auto-pull. Either trigger Zotero desktop's sync, or check at https://www.zotero.org/mylibrary |

For unhandled errors, open the extension's service-worker console (`chrome://extensions` → "Inspect views: service worker") — the actual stack trace is there.

---

## Development

```bash
npm install     # install vitest
npm test        # run all unit tests (Node, no browser needed)
npm run test:watch
```

Project structure:

```
src/
├── adapters/       # alphaxiv.js, scholar-inbox.js — per-source API clients
├── zotero/         # client.js (HTTP), sync.js (write logic), note-render.js
├── sync/           # state.js (dedup index), orchestrator.js
├── background.js   # MV3 service worker — message router + DI wiring
├── content.js      # per-page extraction + proxyFetch for SameSite cookies
├── popup.{html,css,js}   # toolbar UI
└── options.{html,js}     # settings page
tests/              # vitest unit tests + fixtures (no browser)
docs/superpowers/   # design spec + implementation plan
```

All source-side modules are **dependency-injected** (they take `fetch` and `storage` as parameters), so unit tests run in plain Node without any Chrome shim library.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The fastest way to extend this to a new source is to capture a HAR and add a new adapter — see the contributing guide for the recipe.

---

## License

[MIT](./LICENSE) — do whatever you want, just don't sue me.

## Acknowledgements

- [Zotero Web API v3](https://www.zotero.org/support/dev/web_api/v3/start)
- [AlphaXiv](https://www.alphaxiv.org) and [Scholar-Inbox](https://www.scholar-inbox.com), whose internal APIs make this possible. Please don't break them on me 🙂
