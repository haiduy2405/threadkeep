// Generated from src/providers.js. Do not edit.
globalThis.threadkeepProviders = [
  {
    "id": "chatgpt",
    "label": "ChatGPT",
    "origin": "https://chatgpt.com",
    "path": "^/(?:g/[^/]+/)?c/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": "[data-message-author-role]",
    "roleAttribute": "data-message-author-role",
    "user": "[data-message-author-role=\"user\"]",
    "assistant": "[data-message-author-role=\"assistant\"]",
    "stop": "button[data-testid=\"stop-button\"], button[aria-label=\"Stop generating\"], [data-is-streaming=\"true\"]"
  },
  {
    "id": "claude",
    "label": "Claude",
    "origin": "https://claude.ai",
    "path": "^/chat/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": "[data-testid=\"user-message\"], [data-testid=\"assistant-message\"], .font-user-message, .font-claude-response",
    "user": "[data-testid=\"user-message\"], .font-user-message",
    "assistant": "[data-testid=\"assistant-message\"], .font-claude-response",
    "stop": "[data-is-streaming=\"true\"], button[aria-label=\"Stop response\"]"
  },
  {
    "id": "gemini",
    "label": "Gemini",
    "origin": "https://gemini.google.com",
    "path": "^/(?:u/[0-9]+/)?app/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": "user-query, model-response",
    "user": "user-query",
    "assistant": "model-response",
    "stop": "[data-test-id=\"stop-response-button\"], button[aria-label=\"Stop response\"], [data-is-streaming=\"true\"]"
  },
  {
    "id": "deepseek",
    "label": "DeepSeek",
    "origin": "https://chat.deepseek.com",
    "path": "^/a/chat/s/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": ".ds-message, [data-message-author-role], [data-role=\"user\"], [data-role=\"assistant\"], [data-testid=\"user-message\"], [data-testid=\"assistant-message\"]",
    "roleAttribute": "data-message-author-role",
    "user": "[data-role=\"user\"], [data-testid=\"user-message\"]",
    "assistant": "[data-role=\"assistant\"], [data-testid=\"assistant-message\"]",
    "stop": "[data-is-streaming=\"true\"], [data-testid=\"stop-button\"], button[aria-label=\"Stop generating\"]"
  },
  {
    "id": "grok",
    "label": "Grok",
    "origin": "https://grok.com",
    "path": "^/c/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": ".message-bubble, [data-message-author-role], [data-role=\"user\"], [data-role=\"assistant\"], [data-testid=\"user-message\"], [data-testid=\"assistant-message\"]",
    "roleAttribute": "data-message-author-role",
    "user": "[data-role=\"user\"], [data-testid=\"user-message\"]",
    "assistant": "[data-role=\"assistant\"], [data-testid=\"assistant-message\"]",
    "stop": "[data-is-streaming=\"true\"], [data-testid=\"stop-button\"], button[aria-label=\"Stop generating\"]"
  },
  {
    "id": "openwebui",
    "label": "Open WebUI",
    "origin": null,
    "loopback": true,
    "path": "^/c/([a-zA-Z0-9_-]{6,128})/?$",
    "roots": ".chat-user, .chat-assistant",
    "user": ".chat-user",
    "assistant": ".chat-assistant",
    "stop": "[data-is-streaming=\"true\"], button[aria-label=\"Stop generating\"]"
  }
];
