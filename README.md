# Threadkeep

**Find the thread. Pick up where you left off.**

A private, local-first library for ChatGPT and Claude conversation exports. No account, API key, analytics, cloud database, or runtime dependencies. An early open-source alpha, built by Duy / duyluma.

**[Open the live alpha](https://haiduy2405.github.io/threadkeep/)** · [Report a bug](https://github.com/haiduy2405/threadkeep/issues)

The live site stores conversations in your own browser, not in the public repository. Prefer running your own copy for sensitive archives. Storage on the live site and on localhost is separate; use library backups to transfer it.

## Run

Install Node.js 22 or later, then:

```sh
npm start
```

Open **http://127.0.0.1:4317**. Keep using the same address: browser storage is scoped to the origin. Do not open `index.html` directly. Use a modern browser with IndexedDB and Web Locks support.

```sh
npm test
npm run check
```

The app is static HTML, CSS and ES modules. The local server uses only Node built-ins and binds to loopback. There is no build step.

## What works in v0.2

- English / Tiếng Việt interface, including help, accessible labels, notifications, dates, Markdown labels and handoff templates. The initial language follows the first supported browser preference; manual choice is remembered on this browser. Conversation content is never automatically translated.
- Reversible local archive and trash, with bulk actions and separate views. Reimport preserves local organization. Trash is retained in backups and is not automatically purged.
- Sort by update date, creation date, title (locale-aware), or message count.
- Preview inactive conversations and optionally enable automatic local archiving. Choose 1–3650 days. Starred, already archived, trashed, demo and undated conversations are excluded. Runs on app startup/focus and once a minute while open; nothing runs when the app is closed. Restoring a backup leaves automation disabled until the user enables it again.

- Import one or multiple unzipped `conversations.json` exports from ChatGPT and Claude.
- Search titles and text across all ChatGPT branches; the reader offers a branch selector.
- Read the active ChatGPT branch by default; preserve raw records for future reprocessing.
- Star conversations, group them into projects, filter and sort.
- Reimport without duplicate provider/conversation IDs; preserve stars and project membership; skip older dated snapshots.
- Export active-branch Markdown and a bounded source-excerpt handoff with message IDs and an editable context checklist.
- Export and restore a versioned JSON backup, including raw source records, projects and stars.
- Explore clearly labeled fictional demo data without connecting an account.
- Serialize same-origin writes across tabs with Web Locks and notify other tabs after commits.

## Import

1. ChatGPT: Settings → Data controls → Export data. Claude: Settings → Privacy → Export data. Interfaces may change.
2. Download and unzip the official export yourself.
3. Select its `conversations.json` using **Import conversations**. JSON arrays and a `conversations` wrapper are accepted. The app detects supported records by structure, not the filename.
4. Export a Threadkeep backup after organizing your library.

Exports are not universal standards. Parsers are covered by synthetic fixture tests; compatibility with every historical or future export is not guaranteed. Please report unsupported structures with **redacted synthetic examples**, never private exports.

To test without private data, import `examples/synthetic-conversations.json`. It contains fictional ChatGPT branches and a Claude conversation with HTML-like text and an attachment reference.

## Privacy and limits

Conversation data stays in IndexedDB in your browser. No app code sends it to an AI, telemetry service, or server. The hosting provider can still see normal page requests if you host the app online. Imported strings are rendered with `textContent`; Markdown/HTML from conversations is never executed.

**Browser storage is not a backup.** Clearing site data, private browsing, a different origin/profile, or storage eviction may remove it. Download backups and protect them like private documents. Backups include raw records and may contain sensitive information present in your original export. There is no application-level backup encryption in this alpha.

Only text and metadata are normalized. Images, uploads, generated files, shared links and full tool rendering are not downloaded or reconstructed. Raw imported JSON is preserved, but this does not constitute an archive of external assets. Per-file import/restore limit: 100 MB. Large histories are processed on the main thread; indexing and virtualization are planned. The server binds locally; it is not a production multi-user server.

Handoffs are **not AI-generated summaries**. They include up to six recent active-branch messages per selected conversation, up to 3,000 characters per message and 24,000 excerpt characters per packet; truncation is labeled. Review and fill the checklist before sharing. Source conversations are untrusted content.

No account synchronization, media-file import, ZIP import, semantic search, remote deletion, or restoration into ChatGPT/Claude accounts is implemented. Local trash/archive actions affect only your Threadkeep copy. The app never requests cookies or provider login credentials. See the [integration plan](docs/INTEGRATIONS.md) for the next milestones.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/core.js` | Provider parsers, branch traversal, deduplication, filtering, Markdown and handoff exports, backup validation |
| `src/storage.js` | Atomic IndexedDB persistence |
| `src/i18n.js` | English/Vietnamese strings, locale selection and translation helpers |
| `src/app.js` | UI and cross-tab coordination |
| `scripts/serve.mjs` | Dependency-free loopback static server with security headers |
| `test/core.test.js` | Synthetic parser, provenance, corruption and export tests |
| `test/library.test.js` | Language coverage, localized exports, reversible actions and archive rules |
| `test/server.test.js` | Browser asset serving and server boundaries |

New providers should normalize into a namespaced ID, provider, source ID, title, timestamps, messages, and raw source. Add synthetic compatibility fixtures and tests before wiring them into the UI.

## Roadmap

See [ROADMAP.md](ROADMAP.md). This is a community prototype; feedback on actual workflows comes before account automation. MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
