// File: src/llm/models/local.ts
// Re-export shim — canonical local-model provider (Ollama) lives in src/providers/ollama.ts.
// `LocalProvider` alias is preserved for layered consumers.

export { OllamaProvider } from '../../providers/ollama.js';
export { OllamaProvider as LocalProvider } from '../../providers/ollama.js';
