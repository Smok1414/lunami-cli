// File: src/llm/provider.ts

import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { OpenAIProvider } from './models/openai.js';
import { AnthropicProvider } from './models/anthropic.js';
import { LocalProvider } from './models/local.js';

export type LLMMessage = ChatCompletionMessageParam;
export type LLMTool = ChatCompletionTool;

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMResponse = {
  content: string;
  toolCalls: LlmToolCall[];
  message: LLMMessage;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type ProviderRuntimeConfig = {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
};

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const provider = getProviderName();
  const model = getModelForProvider(provider);

  if (provider === 'openai') {
    return {
      provider,
      model,
      baseUrl: getOpenAIBaseUrl(),
      apiKey: getOpenAIApiKey()
    };
  }

  if (provider === 'ollama') {
    return {
      provider,
      model,
      baseUrl: getOllamaBaseUrl()
    };
  }

  return {
    provider,
    model,
    apiKey: process.env.ANTHROPIC_API_KEY
  };
}

export interface LLMProvider {
  chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse>;
  streamChat?(
    messages: LLMMessage[],
    tools: LLMTool[],
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<LLMResponse>;
}

export function createProvider(): LLMProvider {
  const provider = getProviderName();
  const model = getModelForProvider(provider);

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is missing. Set it in .env.');
    }
    return new AnthropicProvider({ apiKey, model });
  }

  if (provider === 'ollama') {
    return new LocalProvider({
      model,
      baseUrl: getOllamaBaseUrl()
    });
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Set it in .env.');
  }

  return new OpenAIProvider({
    apiKey,
    model,
    baseUrl: getOpenAIBaseUrl()
  });
}

function getProviderName(): string {
  const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  if (rawProvider === 'omniroute' || rawProvider === 'openrouter' || rawProvider === 'openai-compatible') {
    return 'openai';
  }
  if (rawProvider === 'openai' || rawProvider === 'anthropic' || rawProvider === 'ollama') {
    return rawProvider;
  }
  throw new Error('LLM_PROVIDER must be one of: openai, anthropic, ollama.');
}

function getModelForProvider(provider: string): string {
  if (process.env.LLM_MODEL) {
    return process.env.LLM_MODEL;
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  }
  if (provider === 'ollama') {
    return process.env.OLLAMA_MODEL || 'llama3';
  }
  return process.env.OMNIROUTE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1';
}

function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.OMNIROUTE_API_KEY;
}

function getOpenAIBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL;
}

function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}
