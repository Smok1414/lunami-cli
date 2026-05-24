import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionToolMessageParam
} from 'openai/resources/chat/completions';
import type {LLMMessage, LLMTool} from '../llm.js';

const llmFunctionNamePattern = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidLlmFunctionName(name: string): boolean {
  return llmFunctionNamePattern.test(name);
}

export function sanitizeLlmTools(tools: LLMTool[]): LLMTool[] {
  const seen = new Set<string>();
  const sanitized: LLMTool[] = [];

  for (const tool of tools) {
    const name = tool.function.name;

    if (!isValidLlmFunctionName(name) || seen.has(name)) {
      continue;
    }

    seen.add(name);
    sanitized.push(tool);
  }

  return sanitized;
}

export function sanitizeChatCompletionMessages(messages: LLMMessage[]): LLMMessage[] {
  const sanitized: LLMMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    if (message.role === 'tool') {
      continue;
    }

    if (message.role !== 'assistant') {
      sanitized.push(message);
      continue;
    }

    const assistantMessage = message as ChatCompletionAssistantMessageParam;
    const toolCalls = (assistantMessage.tool_calls ?? [])
      .map(sanitizeToolCall)
      .filter((toolCall): toolCall is ChatCompletionMessageToolCall => toolCall !== null);

    if (toolCalls.length > 0) {
      const toolMessages: ChatCompletionToolMessageParam[] = [];
      const answeredToolCallIds = new Set<string>();
      let cursor = index + 1;

      while (cursor < messages.length && messages[cursor]?.role === 'tool') {
        const toolMessage = messages[cursor] as ChatCompletionToolMessageParam;

        if (toolCalls.some((toolCall) => toolCall.id === toolMessage.tool_call_id)) {
          toolMessages.push(toolMessage);
          answeredToolCallIds.add(toolMessage.tool_call_id);
        }

        cursor += 1;
      }

      if (toolCalls.every((toolCall) => answeredToolCallIds.has(toolCall.id))) {
        sanitized.push({
          ...assistantMessage,
          content: assistantMessage.content ?? null,
          tool_calls: toolCalls
        } as LLMMessage);
        sanitized.push(...(toolMessages as LLMMessage[]));
        index = cursor - 1;
        continue;
      }
    }

    if (hasContent(assistantMessage.content)) {
      sanitized.push({
        ...assistantMessage,
        tool_calls: undefined
      } as LLMMessage);
    }
  }

  return sanitized;
}

function sanitizeToolCall(toolCall: ChatCompletionMessageToolCall): ChatCompletionMessageToolCall | null {
  const id = typeof toolCall.id === 'string' ? toolCall.id.trim() : '';
  const name = toolCall.function?.name;

  if (!id || !name || !isValidLlmFunctionName(name)) {
    return null;
  }

  return {
    id,
    type: 'function',
    function: {
      name,
      arguments: typeof toolCall.function.arguments === 'string'
        ? toolCall.function.arguments
        : JSON.stringify(toolCall.function.arguments ?? {})
    }
  };
}

function hasContent(content: ChatCompletionAssistantMessageParam['content']): boolean {
  if (typeof content === 'string') {
    return content.trim().length > 0;
  }

  if (Array.isArray(content)) {
    return content.length > 0;
  }

  return false;
}
