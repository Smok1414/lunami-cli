// File: src/llm/router.ts
import { createProvider } from './provider.js';
export class LlmRouter {
    route(intent) {
        const decision = this.decide(intent);
        if (!decision.model || process.env.LLM_MODEL) {
            return createProvider();
        }
        return this.createProviderWithModel(decision.model);
    }
    decide(intent) {
        const provider = this.getProviderName();
        const tier = this.getTier(intent);
        if (provider === 'ollama') {
            return { provider, tier };
        }
        return {
            provider,
            tier,
            model: this.getModelForTier(provider, tier)
        };
    }
    getTier(intent) {
        if (intent === 'agent_loop' || intent === 'tool_calling' || intent === 'debugging') {
            return 'flagship';
        }
        if (intent === 'code_generation' || intent === 'explanation') {
            return 'balanced';
        }
        return 'lightweight';
    }
    getModelForTier(provider, tier) {
        if (provider === 'anthropic') {
            if (tier === 'flagship') {
                return process.env.ANTHROPIC_AGENT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
            }
            if (tier === 'balanced') {
                return process.env.ANTHROPIC_CODE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
            }
            return process.env.ANTHROPIC_CHAT_MODEL || 'claude-haiku-4-5';
        }
        if (tier === 'flagship') {
            return process.env.OPENAI_AGENT_MODEL || process.env.OMNIROUTE_AGENT_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1';
        }
        if (tier === 'balanced') {
            return process.env.OPENAI_CODE_MODEL || process.env.OMNIROUTE_CODE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1';
        }
        return process.env.OPENAI_CHAT_MODEL || process.env.OMNIROUTE_CHAT_MODEL || 'gpt-4.1-mini';
    }
    createProviderWithModel(model) {
        const oldModel = process.env.LLM_MODEL;
        try {
            process.env.LLM_MODEL = model;
            return createProvider();
        }
        finally {
            if (oldModel === undefined) {
                delete process.env.LLM_MODEL;
            }
            else {
                process.env.LLM_MODEL = oldModel;
            }
        }
    }
    getProviderName() {
        const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
        if (rawProvider === 'anthropic') {
            return 'anthropic';
        }
        if (rawProvider === 'ollama') {
            return 'ollama';
        }
        return 'openai';
    }
}
