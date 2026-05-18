import type {LLMMessage, LLMProvider, LLMResponse, LLMTool, LlmToolCall} from '../llm.js';
import { isAcceptedToolName } from '../toolNames.js';

type OllamaProviderOptions = {
  model: string;
  baseUrl: string;
};

type OllamaToolCall = {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
};

export class OllamaProvider implements LLMProvider {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OllamaProviderOptions) {
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
        messages: toOllamaMessages(messages),
        tools: tools.length > 0 ? toOllamaTools(tools) : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      message?: {
        content?: string;
        tool_calls?: OllamaToolCall[];
      };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const content = data.message?.content ?? '';
    const toolCalls = normalizeToolCalls(data.message?.tool_calls ?? []);

    return {
      content,
      toolCalls,
      message: {
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(toOpenAIToolCall) : undefined
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
}

function toOllamaMessages(messages: LLMMessage[]): Array<{role: string; content: string; tool_call_id?: string; tool_calls?: unknown[]}> {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: messageContentToText(message.content),
        tool_call_id: message.tool_call_id
      };
    }

    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      return {
        role: 'assistant',
        content: messageContentToText(message.content),
        tool_calls: message.tool_calls.map((tc) => ({
          function: {
            name: tc.function.name,
            arguments: parseArguments(tc.function.arguments)
          }
        }))
      };
    }

    return {
      role: message.role === 'developer' ? 'system' : message.role,
      content: messageContentToText(message.content)
    };
  });
}

function toOllamaTools(tools: LLMTool[]): unknown[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }
  }));
}

function normalizeToolCalls(toolCalls: OllamaToolCall[]): LlmToolCall[] {
  return toolCalls.flatMap((toolCall, index) => {
    const name = toolCall.function?.name;

    if (!name || !isAcceptedToolName(name)) {
      return [];
    }

    return [{
      id: `ollama_call_${index}`,
      name,
      arguments: parseArguments(toolCall.function?.arguments)
    }];
  });
}

function toOpenAIToolCall(toolCall: LlmToolCall) {
  return {
    id: toolCall.id,
    type: 'function' as const,
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments)
    }
  };
}

function messageContentToText(content: unknown): string {
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
          return String((part as {text?: unknown}).text ?? '');
        }

        return JSON.stringify(part);
      })
      .join('\n');
  }

  return String(content);
}

function parseArguments(value: Record<string, unknown> | string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  return value;
}

