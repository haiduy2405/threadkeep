# Provider readiness — v0.4

Updated 2026-11-23. A configured adapter is **not** a verified account integration. No adapter has been tested against a signed-in live provider in this development session. Fixture tests establish behavior only for the structures they contain.

| Provider | Site / scope | Reader | Readiness |
| --- | --- | --- | --- |
| ChatGPT | `https://chatgpt.com`, saved `/c/…` chats including Gem routes | Explicit `data-message-author-role` | Synthetic DOM fixtures; live verification pending |
| Claude | `https://claude.ai/chat/…` | Explicit user/assistant test IDs and semantic classes | Synthetic DOM fixtures; live verification pending |
| Gemini | `https://gemini.google.com/app/…`, optional `/u/N/` account prefix | `user-query` / `model-response` elements | Synthetic DOM fixtures; live verification pending |
| DeepSeek | `https://chat.deepseek.com/a/chat/s/…` | Semantic author attributes/test IDs; `.ds-message` wrappers need an explicit role inside | Guarded prototype; layouts without author markers are rejected |
| Grok | `https://grok.com/c/…` | Semantic author attributes/test IDs; `.message-bubble` wrappers need an explicit role inside | Guarded prototype; not an X.com integration |
| Open WebUI | User-opened `localhost` or `127.0.0.1`, HTTP/HTTPS, saved `/c/…` chats | `.chat-user` / `.chat-assistant` containers | Synthetic fixtures plus upstream source review; deployed-instance test pending; explicit opt-in required |

DeepSeek and Grok may currently reject actual layouts. Do not classify message authors by alignment or alternating order just to report success. A rejected layout needs a redacted sample and a new fixture before broadening support.

Capture contains rendered text, not unloaded branches, hidden history or media bytes. History discovery sees links exposed by the loaded page. Neither a successful extraction nor a completed batch proves the whole account is backed up.

## Local AI boundaries

Open WebUI is a chat UI that can use local or cloud models; the adapter does not need to know which model backend it uses. A raw Ollama or LM Studio inference endpoint is not this history integration. The user opens their own local UI, invokes the extension and explicitly confirms local capture. For batch reads, browser host permission is requested for that origin. No automatic port probing, private-address-range access, filesystem reads, API token extraction or credential collection is implemented. IPv6 loopback and LAN-hosted instances are not included yet.

## Muse

Duy confirmed https://muse.ai/ on 2026-11-23. The official site currently identifies it as **Muse, Your Personal AI Agent from Meta**. Its product design describes a long-running main chat plus side chats. The authenticated conversation interface, source IDs/URLs and DOM author roles have not yet been inspected; the current browser session is at the sign-in screen.

The Muse adapter remains unimplemented pending a user-selected, non-sensitive signed-in sample. Do not add an enabled provider button, invent conversation routes, or call a guessed private API just to report it as supported. Capture should treat the main chat and side chats as separate sources after verifying how they are identified. Muse activity logs, connected email/calendar data, cloud-computer files and rich artifacts are separate from chat text and are outside a transcript-only adapter unless explicitly implemented and selected by the user.

Evidence: https://muse.ai/ and https://muse.ai/blog/how-we-designed-muse (official product-design article dated 2026-09-08; reviewed 2026-11-23).

## Sources reviewed

- Gemini web app: https://support.google.com/gemini/answer/13275745
- DeepSeek web product: https://www.deepseek.com/en/
- Grok web product: https://x.ai/grok
- Open WebUI history: https://docs.openwebui.com/features/chat-conversations/chat-features/history-search/
- Open WebUI vs Ollama: https://docs.openwebui.com/alternatives/ollama/
- Open WebUI role containers: https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/UserMessage.svelte and https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/ResponseMessage.svelte

These sources establish product origins or describe upstream UI code, not live compatibility of this extension.
