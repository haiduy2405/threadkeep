# Roadmap

## 0.1 — Reviewable foundation
- [x] Local browser library with ChatGPT and Claude JSON import
- [x] Projects, stars, full-text substring search, branch reader
- [x] Deduplication and versioned backup/restore
- [x] Source-linked Markdown and handoff packets
- [x] Synthetic unit tests and CI

## Next — Real-export compatibility and usability
- [ ] Test with consenting users' redacted real-world export structures
- [ ] ZIP import with decompression limits and clear asset coverage
- [ ] Import preview and per-record diagnostics
- [ ] Incremental indexing, worker-based parsing and virtualized results
- [ ] Project management on small screens; rename, merge and local removal with review
- [ ] English/Vietnamese localization and accessibility audit
- [ ] Downloadable desktop package, encrypted backup option
- [ ] Export date conflict handling when timestamps are absent

## Later — Cross-AI continuity
- [ ] Provider adapter contract and additional providers
- [ ] Optional user-configured AI summarization, with cost preview and source citations
- [ ] User-reviewed decisions and contradictions across conversations
- [ ] Optional browser extension, after studying provider capabilities and policies

Remote deletion is deliberately outside the initial release. Any future design must present a concrete action preview, check backup coverage, require explicit confirmation and report partial failures. No silent background deletion.
