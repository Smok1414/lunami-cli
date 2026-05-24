// File: src/llm/router.ts

import { createProvider, type LLMProvider } from './provider.js';

export type TaskIntent =
  | 'agent_loop'
  | 'tool_calling'
  | 'code_generation'
  | 'debugging'
  | 'chat_format'
  | 'explanation'
  | 'summary';

export type ModelTier = 'lightweight' | 'balanced' | 'flagship';

type ProviderName = 'openai' | 'anthropic' | 'ollama';

type RouteDecision = {
  provider: ProviderName;
  tier: ModelTier;
  model?: string;
};

export class LlmRouter {
  public route(intent: TaskIntent): LLMProvider {
    const decision = this.decide(intent);

    if (!decision.model || process.env.LLM_MODEL) {
      return createProvider();
    }

    return this.createProviderWithModel(decision.model);
  }

  public decide(intent: TaskIntent): RouteDecision {
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

  private getTier(intent: TaskIntent): ModelTier {
    if (intent === 'agent_loop' || intent === 'tool_calling' || intent === 'debugging') {
      return 'flagship';
    }

    if (intent === 'code_generation' || intent === 'explanation') {
      return 'balanced';
    }

    return 'lightweight';
  }

  private getModelForTier(provider: Exclude<ProviderName, 'ollama'>, tier: ModelTier): string {
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

  private createProviderWithModel(model: string): LLMProvider {
    const oldModel = process.env.LLM_MODEL;

    try {
      process.env.LLM_MODEL = model;
      return createProvider();
    } finally {
      if (oldModel === undefined) {
        delete process.env.LLM_MODEL;
      } else {
        process.env.LLM_MODEL = oldModel;
      }
    }
  }

  private getProviderName(): ProviderName {
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
