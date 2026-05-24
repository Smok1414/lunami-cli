// File: src/llm/models/anthropic.ts
// Re-export shim — canonical AnthropicProvider lives in src/providers/anthropic.ts
// (the legacy path includes the request sanitizer required for production use).

export { AnthropicProvider } from '../../providers/anthropic.js';
