// File: src/llm/provider.ts
import { OpenAIProvider } from './models/openai.js';
import { AnthropicProvider } from './models/anthropic.js';
import { LocalProvider } from './models/local.js';
export function getProviderRuntimeConfig() {
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
export function createProvider() {
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
function getProviderName() {
    const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    if (rawProvider === 'omniroute' || rawProvider === 'openrouter' || rawProvider === 'openai-compatible') {
        return 'openai';
    }
    if (rawProvider === 'openai' || rawProvider === 'anthropic' || rawProvider === 'ollama') {
        return rawProvider;
    }
    throw new Error('LLM_PROVIDER must be one of: openai, anthropic, ollama.');
}
function getModelForProvider(provider) {
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
function getOpenAIApiKey() {
    return process.env.OPENAI_API_KEY || process.env.OMNIROUTE_API_KEY;
}
function getOpenAIBaseUrl() {
    return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL;
}
function getOllamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}
