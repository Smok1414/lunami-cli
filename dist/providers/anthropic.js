import Anthropic from '@anthropic-ai/sdk';
import { isAcceptedToolName } from '../toolNames.js';
import { sanitizeChatCompletionMessages, sanitizeLlmTools } from './requestSanitizer.js';
export class AnthropicProvider {
    client;
    model;
    constructor(options) {
        this.model = options.model;
        this.client = new Anthropic({
            apiKey: options.apiKey
        });
    }
    async chat(messages, tools = []) {
        const requestTools = sanitizeLlmTools(tools);
        const request = toAnthropicRequest(sanitizeChatCompletionMessages(messages));
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            system: request.system,
            messages: request.messages,
            tools: requestTools.length > 0 ? toAnthropicTools(requestTools) : undefined
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
            },
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            }
        };
    }
    async streamChat(messages, requestTools = [], onDelta) {
        const sanitizedTools = sanitizeLlmTools(requestTools);
        const request = toAnthropicRequest(sanitizeChatCompletionMessages(messages));
        const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: 8192,
            system: request.system,
            messages: request.messages,
            tools: sanitizedTools.length > 0 ? toAnthropicTools(sanitizedTools) : undefined
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
            },
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            }
        };
    }
}
function toAnthropicRequest(messages) {
    const system = [];
    const anthropicMessages = [];
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
            }
            catch { }
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
            const contentBlocks = [];
            const text = messageContentToText(message.content);
            if (text) {
                contentBlocks.push({ type: 'text', text });
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
function pushAnthropicMessage(messages, message) {
    const last = messages[messages.length - 1];
    if (!last || last.role !== message.role) {
        messages.push(message);
        return;
    }
    last.content = [...toContentBlocks(last.content), ...toContentBlocks(message.content)];
}
function toAnthropicTools(tools) {
    return tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
    }));
}
function getAnthropicText(content) {
    return content
        .map((block) => {
        const typedBlock = block;
        return typedBlock.type === 'text' ? typedBlock.text ?? '' : '';
    })
        .join('');
}
function getAnthropicToolCalls(content) {
    return content.flatMap((block) => {
        const typedBlock = block;
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
function toOpenAIToolCall(toolCall) {
    return {
        id: toolCall.id,
        type: 'function',
        function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments)
        }
    };
}
function messageContentToText(content) {
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
                return String(part.text ?? '');
            }
            return JSON.stringify(part);
        })
            .filter(Boolean)
            .join('\n');
    }
    return String(content);
}
function toContentBlocks(content) {
    if (Array.isArray(content)) {
        return content;
    }
    const text = messageContentToText(content);
    return text ? [{ type: 'text', text }] : [];
}
function parseToolInput(rawArguments) {
    try {
        const parsed = JSON.parse(rawArguments);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
