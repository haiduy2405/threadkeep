# Contributing

Start with a small issue describing the user problem and expected behavior. For a new provider, include synthetic or thoroughly redacted input and tests. Never commit real conversation exports, account cookies, credentials, or generated private backups.

Run `npm test` and `npm run check` before submitting a pull request. Test affected browser flows, especially imports, backup round trips, active branches and multi-tab edits. Keep the default application free of external network calls and runtime dependencies unless the tradeoff is discussed first.

Use text rendering for untrusted conversation content. Keep source IDs and truncation warnings in exports. Clearly distinguish inferred summaries from user-approved decisions.
