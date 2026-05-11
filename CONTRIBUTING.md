# Contributing

Thanks for considering a contribution. This is a small extension; the contribution process is correspondingly small.

## Quick start

```bash
git clone <your fork>
cd research-zotero-sync
npm install
npm test           # 23 tests should pass
```

Load the unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select this folder) to try changes live. After editing source code, click the round-arrow reload icon on the extension card. After editing `content.js`, also refresh any open AlphaXiv / Scholar-Inbox tabs.

## Project layout (the bits worth knowing)

| Path | Responsibility |
|---|---|
| `src/adapters/<source>.js` | Per-source API client. Returns a normalized `AdapterResult { source, user, collections, notes }`. |
| `src/zotero/client.js` | Pure HTTP wrapper for the Zotero Web API v3. `fetch` is dependency-injected. |
| `src/zotero/sync.js` | Given an `AdapterResult`, writes collections + items + child notes to Zotero idempotently. |
| `src/sync/state.js` | `chrome.storage.local`-backed dedup index (`source:sourceId → zoteroKey`). |
| `src/sync/orchestrator.js` | Wires adapter → apply with the per-source parent name. |
| `src/background.js` | MV3 service worker. Routes popup messages, injects real `fetch` and `chrome.storage` into modules. |
| `src/content.js` | Per-page DOM extraction + `proxyFetch` handler so source API calls carry SameSite cookies. |
| `tests/` | Vitest unit tests + JSON fixtures. No browser required. |

All source-side modules are dependency-injected (they take `fetch` and `storage` as parameters), which is why the test suite runs in plain Node. Don't reach for `chrome.*` directly inside `adapters/` or `zotero/` — keep the seam.

## Adding a new source

1. **Capture the API.** Open the source site signed-in. DevTools → Network → click around to the page that lists collections and the page that lists papers in a collection. Save HAR(s) or copy-as-cURL the relevant requests.
2. **Add fixtures.** Trim the responses down to the minimum representative sample and drop them in `tests/fixtures/<source>-*.json`. Don't commit the full HAR — it contains your session cookies. (`*.har` is gitignored.)
3. **Write the adapter test first** at `tests/adapters/<source>.test.js`. Mirror the pattern in `alphaxiv.test.js` or `scholar-inbox.test.js`. The test should assert the normalized output against your fixtures.
4. **Implement the adapter** at `src/adapters/<source>.js`. Take `fetch` as a parameter. Return the standard `AdapterResult` shape.
5. **Wire it up** in `src/background.js`'s `makeAdapter()` and `src/popup.{html,js}` (add a card + button).
6. **Update the manifest** if you need new `host_permissions` (and `content_scripts.matches` if the API needs cookie proxying).
7. **Update README features list and roadmap.**

## Code style

No formal style — just keep changes consistent with the surrounding code. Some defaults that are already in place:

- ES modules everywhere (`"type": "module"` in `package.json`).
- Two-space indentation, single quotes, trailing semicolons.
- Avoid framework dependencies. The whole extension is plain ES2022 + the Zotero Web API; let's keep it that way.
- Tests next to the production module they cover (mirror the directory structure under `tests/`).

## Pull requests

- Run `npm test` and make sure it's green.
- Reference any related issue.
- For adapter changes, include the fixture(s) you tested against.
- For UI changes, include a screenshot of the popup before/after.
- Keep commits scoped (one logical change per commit). Conventional-commit prefixes (`feat`, `fix`, `chore`, `docs`, `test`) are appreciated but not required.

## Reporting bugs

Open an issue with:

1. What you clicked / which source / which collection.
2. The popup's error message verbatim.
3. The service-worker console output (`chrome://extensions` → "Inspect views: service worker" → Console).
4. **Don't paste full request headers** — they contain auth cookies / API keys. The status code + response body is enough.
