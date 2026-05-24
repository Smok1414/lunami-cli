// File: src/llm/models/local.ts

import type { LLMMessage, LLMProvider, LLMResponse, LLMTool, LlmToolCall } from '../provider.js';
import { isAcceptedToolName } from '../../toolNames.js';

type LocalProviderOptions = {
  model: string;
  baseUrl: string;
};

type OllamaToolCall = {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
};

export class LocalProvider implements LLMProvider {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: LocalProviderOptions) {
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async chat(messages: LLMMessage[], tools: LLMTool[] = []): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.toOllamaMessages(messages),
        tools: tools.length > 0 ? this.toOllamaTools(tools) : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      message?: {
        content?: string;
        tool_calls?: OllamaToolCall[];
      };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const content = data.message?.content ?? '';
    const toolCalls = this.normalizeToolCalls(data.message?.tool_calls ?? []);

    return {
      content,
      toolCalls,
      message: {
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(this.toOpenAIToolCall) : undefined
      } as LLMMessage,
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens:
          typeof data.prompt_eval_count === 'number' && typeof data.eval_count === 'number'
            ? data.prompt_eval_count + data.eval_count
            : undefined
      }
    };
  }

  private toOllamaMessages(
    messages: LLMMessage[]
  ): Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }> {
    return messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          content: this.messageContentToText(message.content),
          tool_call_id: message.tool_call_id
        };
      }

      if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
        return {
          role: 'assistant',
          content: this.messageContentToText(message.content),
          tool_calls: message.tool_calls.map((tc) => ({
            function: {
              name: tc.function.name,
              arguments: this.parseArguments(tc.function.arguments)
            }
          }))
        };
      }

      return {
        role: message.role === 'developer' ? 'system' : message.role,
        content: this.messageContentToText(message.content)
      };
    });
  }

  private toOllamaTools(tools: LLMTool[]): unknown[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }

  private normalizeToolCalls(toolCalls: OllamaToolCall[]): LlmToolCall[] {
    return toolCalls.flatMap((toolCall, index) => {
      const name = toolCall.function?.name;

      if (!name || !isAcceptedToolName(name)) {
        return [];
      }

      return [
        {
          id: `ollama_call_${index}`,
          name,
          arguments: this.parseArguments(toolCall.function?.arguments)
        }
      ];
    });
  }

  private toOpenAIToolCall(toolCall: LlmToolCall) {
    return {
      id: toolCall.id,
      type: 'function' as const,
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments)
      }
    };
  }

  private messageContentToText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (!content) {
      return '';
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text?: unknown }).text ?? '');
          }

          return JSON.stringify(part);
        })
        .join('\n');
    }

    return String(content);
  }

  private parseArguments(
    value: Record<string, unknown> | string | undefined
  ): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }

    return value;
  }
}
