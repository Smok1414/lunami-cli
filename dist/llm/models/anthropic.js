// File: src/llm/models/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import { isAcceptedToolName } from '../../toolNames.js';
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
        const request = this.toAnthropicRequest(messages);
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            system: request.system,
            messages: request.messages,
            tools: tools.length > 0 ? this.toAnthropicTools(tools) : undefined
        });
        const content = this.getAnthropicText(response.content);
        const toolCalls = this.getAnthropicToolCalls(response.content);
        return {
            content,
            toolCalls,
            message: {
                role: 'assistant',
                content: content || null,
                tool_calls: toolCalls.length > 0 ? toolCalls.map(this.toOpenAIToolCall) : undefined
            },
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            }
        };
    }
    async streamChat(messages, requestTools = [], onDelta) {
        const request = this.toAnthropicRequest(messages);
        const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: 8192,
            system: request.system,
            messages: request.messages,
            tools: requestTools.length > 0 ? this.toAnthropicTools(requestTools) : undefined
        });
        stream.on('text', (text) => {
            void onDelta(text);
        });
        const response = await stream.finalMessage();
        const content = this.getAnthropicText(response.content);
        const toolCalls = this.getAnthropicToolCalls(response.content);
        return {
            content,
            toolCalls,
            message: {
                role: 'assistant',
                content: content || null,
                tool_calls: toolCalls.length > 0 ? toolCalls.map(this.toOpenAIToolCall) : undefined
            },
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            }
        };
    }
    toAnthropicRequest(messages) {
        const system = [];
        const anthropicMessages = [];
        for (const message of messages) {
            if (message.role === 'system' || message.role === 'developer') {
                system.push(this.messageContentToText(message.content));
                continue;
            }
            if (message.role === 'tool') {
                let isError = false;
                try {
                    const text = this.messageContentToText(message.content);
                    const parsed = JSON.parse(text);
                    if (parsed && typeof parsed === 'object' && parsed.ok === false) {
                        isError = true;
                    }
                }
                catch { }
                this.pushAnthropicMessage(anthropicMessages, {
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: message.tool_call_id,
                            content: this.messageContentToText(message.content),
                            is_error: isError
                        }
                    ]
                });
                continue;
            }
            if (message.role === 'assistant') {
                const contentBlocks = [];
                const text = this.messageContentToText(message.content);
                if (text) {
                    contentBlocks.push({ type: 'text', text });
                }
                for (const toolCall of message.tool_calls ?? []) {
                    contentBlocks.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: this.parseToolInput(toolCall.function.arguments)
                    });
                }
                this.pushAnthropicMessage(anthropicMessages, {
                    role: 'assistant',
                    content: contentBlocks.length > 0 ? contentBlocks : text
                });
                continue;
            }
            this.pushAnthropicMessage(anthropicMessages, {
                role: 'user',
                content: this.messageContentToText(message.content)
            });
        }
        return {
            system: system.filter(Boolean).join('\n\n') || undefined,
            messages: anthropicMessages
        };
    }
    pushAnthropicMessage(messages, message) {
        const last = messages[messages.length - 1];
        if (!last || last.role !== message.role) {
            messages.push(message);
            return;
        }
        last.content = [...this.toContentBlocks(last.content), ...this.toContentBlocks(message.content)];
    }
    toAnthropicTools(tools) {
        return tools.map((tool) => ({
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters
        }));
    }
    getAnthropicText(content) {
        return content
            .map((block) => {
            const typedBlock = block;
            return typedBlock.type === 'text' ? typedBlock.text ?? '' : '';
        })
            .join('');
    }
    getAnthropicToolCalls(content) {
        return content.flatMap((block) => {
            const typedBlock = block;
            if (typedBlock.type !== 'tool_use' ||
                !typedBlock.id ||
                !typedBlock.name ||
                !isAcceptedToolName(typedBlock.name)) {
                return [];
            }
            return [
                {
                    id: typedBlock.id,
                    name: typedBlock.name,
                    arguments: typedBlock.input ?? {}
                }
            ];
        });
    }
    toOpenAIToolCall(toolCall) {
        return {
            id: toolCall.id,
            type: 'function',
            function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments)
            }
        };
    }
    messageContentToText(content) {
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
    toContentBlocks(content) {
        if (Array.isArray(content)) {
            return content;
        }
        const text = this.messageContentToText(content);
        return text ? [{ type: 'text', text }] : [];
    }
    parseToolInput(rawArguments) {
        try {
            const parsed = JSON.parse(rawArguments);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed
                : {};
        }
        catch {
            return {};
        }
    }
}
