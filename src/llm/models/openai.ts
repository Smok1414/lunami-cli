// File: src/llm/models/openai.ts
// Re-export shim — canonical OpenAIProvider lives in src/providers/openai.ts
// (the legacy path includes the request sanitizer required for production use).

export { OpenAIProvider } from '../../providers/openai.js';
