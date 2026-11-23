# Account sync and media: implementation plan

Requested by Duy on 2026-11-23. v0.3 adds an **experimental DOM text capture extension**: single conversation, discovered-history selection, and a local review bridge. It has synthetic tests, not signed-in provider validation. Verified whole-account synchronization and media-byte archival remain unimplemented.

## Distinguish three actions

1. Import or synchronize account content into a local library.
2. Organize or trash the local copy, reversibly.
3. Mutate original conversations at the provider, with a preview and explicit confirmation.

Local archive/trash implements only the second. The capture beta partially addresses the first for rendered text. Never label local trash as deleting a ChatGPT/Claude conversation.

## Provider evidence checked 2026-11-23

- OpenAI documents personal-account data export: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data
- Anthropic's documented chat/file Compliance content endpoints serve Claude Enterprise data, not general personal Claude accounts: https://platform.claude.com/docs/en/manage-claude/compliance-integration-patterns
- Claude export: https://privacy.claude.com/en/articles/9450526-export-your-claude-data

Do not assume an API inference key grants access to a user's chat-product history. A consumer-account OAuth integration has not been established by this research. Provider capabilities and policies must be rechecked before implementation.

## Next milestone: media files from an export folder

- Select a local export folder or bounded ZIP with explicit file/byte limits.
- Inventory original attachment references and selected files. Match exact IDs/paths before filename heuristics; ambiguous matches need user review.
- Store original bytes, MIME, size, SHA-256, source provider/conversation/message IDs and capture time. Deduplicate by hash.
- Show independent states: referenced / stored and verified / missing / inaccessible / ambiguous. A URL alone does not count as a saved file.
- Never render imported HTML/SVG/scripts as active content. Preview approved image/audio/video MIME types and offer other files as downloads.
- Portable backups must include bytes and a manifest, with checksum verification on restore. Text-only JSON backups must warn if binaries are omitted.
- Validate using small synthetic image/audio/video files plus missing, duplicate, unsafe and ambiguous attachments. Test storage quota failure without committing partial imports.

## Next milestone: validate and extend account capture

Evaluate official APIs for the account tier first. The current extension uses DOM text and discovered same-provider links without provider API calls or credential extraction. Check applicable provider interaction policies and validate live page layouts before treating it as supported. Use explicit per-origin permissions, a visible capture preview, account/source separation and local processing. Do not ask users to paste passwords, API secrets or session cookies into Threadkeep.

For each adapter define supported account tiers, authentication boundaries, pagination, active branches, messages, media coverage, incremental updates, account isolation, failures and unsupported content. Unknown capabilities remain disabled, with an explanation; no simulated “connected” or “synced” status.

Start read-only. Compare imports against synthetic fixtures and consenting users' redacted samples. Capture of currently rendered content must be described as such, not as an entire-account sync. Expired or deleted upstream files may be unrecoverable.

## Later milestone: remote archive/delete

Add only when the adapter has verified mutation support. Use an action preview with exact account, provider, conversation IDs, media-backup coverage and per-item results. Deletion needs explicit confirmation and a checked backup. Retry only unresolved items and never silently treat a partial failure as success. No remote auto-delete.
