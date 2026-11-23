# Roadmap

## 0.1 — Reviewable foundation
- [x] Local browser library with ChatGPT and Claude JSON import
- [x] Projects, stars, full-text substring search, branch reader
- [x] Deduplication and versioned backup/restore
- [x] Source-linked Markdown and handoff packets
- [x] Synthetic unit tests and CI

## 0.2 — Bilingual organization
- [x] English/Vietnamese UI and export templates; remember language locally
- [x] Local archive and recoverable trash; preserve state across reimports/backups
- [x] Additional creation-date and message-count sorting
- [x] User-enabled auto archive with a concrete preview, protected stars and bounded date policy
- [x] Mobile access to project creation and library actions

## Next — Real-export compatibility and usability
- [ ] Test with consenting users' redacted real-world export structures
- [ ] ZIP import with decompression limits and clear asset coverage
- [ ] Import preview and per-record diagnostics
- [ ] Incremental indexing, worker-based parsing and virtualized results
- [ ] Rename/merge projects and review permanent local removal
- [ ] Accessibility audit and real-world localization feedback
- [ ] Downloadable desktop package, encrypted backup option
- [ ] Export date conflict handling when timestamps are absent

## Later — Cross-AI continuity
- [ ] Provider adapter contract and additional providers
- [ ] Optional user-configured AI summarization, with cost preview and source citations
- [ ] User-reviewed decisions and contradictions across conversations
- [ ] Optional browser extension, after studying provider capabilities and policies
- [ ] Media coverage inventory: distinguish referenced files from locally stored bytes
- [ ] Folder/ZIP media import, exact reference matching and portable binary backups
- [ ] Incremental account sync with provider-specific capability checks; see docs/INTEGRATIONS.md

Remote deletion is deliberately outside the initial release. Any future design must present a concrete action preview, check backup coverage, require explicit confirmation and report partial failures. No silent background deletion.
