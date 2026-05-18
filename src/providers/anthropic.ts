import Anthropic from '@anthropic-ai/sdk';
import type {LLMMessage, LLMProvider, LLMResponse, LLMTool, LlmToolCall} from '../llm.js';
import { isAcceptedToolName } from '../toolNames.js';

type AnthropicProviderOptions = {
  apiKey: string;
  model: string;
};

type AnthropicRequest = {
  system?: string;
  messages: Array<{role: 'user' | 'assistant'; content: unknown}>;
};

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.model = options.model;
    this.client = new Anthropic({
      apiKey: options.apiKey
    });
  }

  async chat(messages: LLMMessage[], tools: LLMTool[] = []): Promise<LLMResponse> {
    const request = toAnthropicRequest(messages);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: request.system,
      messages: request.messages as Anthropic.MessageParam[],
      tools: tools.length > 0 ? toAnthropicTools(tools) as Anthropic.Tool[] : undefined
    });

    const content = getAnthropicText(response.content);
    const toolCalls = getAnthropicToolCalls(response.content);

    return {
      content,
      toolCalls,
      message: {
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(toOpenAIToolCall) : undefined
      } as LLMMessage,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  async streamChat(
    messages: LLMMessage[],
    requestTools: LLMTool[] = [],
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<LLMResponse> {
    const request = toAnthropicRequest(messages);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: request.system,
      messages: request.messages as Anthropic.MessageParam[],
      tools: requestTools.length > 0 ? toAnthropicTools(requestTools) as Anthropic.Tool[] : undefined
    });

    stream.on('text', (text) => {
      void onDelta(text);
    });

    const response = await stream.finalMessage();

    const content = getAnthropicText(response.content);
    const toolCalls = getAnthropicToolCalls(response.content);

    return {
      content,
      toolCalls,
      message: {
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(toOpenAIToolCall) : undefined
      } as LLMMessage,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }
}

function toAnthropicRequest(messages: LLMMessage[]): AnthropicRequest {
  const system: string[] = [];
  const anthropicMessages: AnthropicRequest['messages'] = [];

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') {
      system.push(messageContentToText(message.content));
      continue;
    }

    if (message.role === 'tool') {
      let isError = false;
      try {
        const text = messageContentToText(message.content);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && parsed.ok === false) {
          isError = true;
        }
      } catch {}

      pushAnthropicMessage(anthropicMessages, {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            content: messageContentToText(message.content),
            is_error: isError
          }
        ]
      });
      continue;
    }

    if (message.role === 'assistant') {
      const contentBlocks: unknown[] = [];
      const text = messageContentToText(message.content);

      if (text) {
        contentBlocks.push({type: 'text', text});
      }

      for (const toolCall of message.tool_calls ?? []) {
        contentBlocks.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: parseToolInput(toolCall.function.arguments)
        });
      }

      pushAnthropicMessage(anthropicMessages, {
        role: 'assistant',
        content: contentBlocks.length > 0 ? contentBlocks : text
      });
      continue;
    }

    pushAnthropicMessage(anthropicMessages, {
      role: 'user',
      content: messageContentToText(message.content)
    });
  }

  return {
    system: system.filter(Boolean).join('\n\n') || undefined,
    messages: anthropicMessages
  };
}

function pushAnthropicMessage(
  messages: AnthropicRequest['messages'],
  message: AnthropicRequest['messages'][number]
): void {
  const last = messages[messages.length - 1];

  if (!last || last.role !== message.role) {
    messages.push(message);
    return;
  }

  last.content = [...toContentBlocks(last.content), ...toContentBlocks(message.content)];
}

function toAnthropicTools(tools: LLMTool[]): unknown[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters
  }));
}

function getAnthropicText(content: unknown[]): string {
  return content
    .map((block) => {
      const typedBlock = block as {type?: string; text?: string};
      return typedBlock.type === 'text' ? typedBlock.text ?? '' : '';
    })
    .join('');
}

function getAnthropicToolCalls(content: unknown[]): LlmToolCall[] {
  return content.flatMap((block) => {
    const typedBlock = block as {type?: string; id?: string; name?: string; input?: Record<string, unknown>};

    if (typedBlock.type !== 'tool_use' || !typedBlock.id || !typedBlock.name || !isAcceptedToolName(typedBlock.name)) {
      return [];
    }

    return [{
      id: typedBlock.id,
      name: typedBlock.name,
      arguments: typedBlock.input ?? {}
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
      .filter(Boolean)
      .join('\n');
  }

  return String(content);
}

function toContentBlocks(content: unknown): unknown[] {
  if (Array.isArray(content)) {
    return content;
  }

  const text = messageContentToText(content);
  return text ? [{type: 'text', text}] : [];
}

function parseToolInput(rawArguments: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawArguments);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

