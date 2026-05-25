// File: src/llm/provider.ts
// Re-export shim — canonical implementation lives in ../llm.ts
// Kept so the layered tree (cli/, app/, core/, config/) can import from llm/provider
// while avoiding duplicated provider/type definitions.

export type {
  LLMMessage,
  LLMTool,
  LlmToolCall,
  LLMResponse,
  LLMProvider,
  LLMProviderName,
  ProviderInfo,
  ProviderRuntimeConfig
} from '../llm.js';

export {
  createProvider,
  getProviderInfo,
  getProviderRuntimeConfig,
  getProviderName
} from '../llm.js';
