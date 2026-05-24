// File: src/llm/models/openai.ts
import OpenAI from 'openai';
import { isAcceptedToolName } from '../../toolNames.js';
export class OpenAIProvider {
    client;
    model;
    constructor(options) {
        this.model = options.model;
        this.client = new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseUrl
        });
    }
    async chat(messages, tools = []) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined
        });
        const message = response.choices[0]?.message;
        if (!message) {
            throw new Error('OpenAI provider returned an empty response.');
        }
        const rawToolCalls = message.tool_calls ?? [];
        const toolCalls = this.normalizeToolCalls(rawToolCalls);
        const safeRawToolCalls = toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments)
            }
        }));
        return {
            content: message.content ?? '',
            toolCalls,
            message: {
                role: 'assistant',
                content: message.content ?? null,
                tool_calls: safeRawToolCalls.length > 0 ? safeRawToolCalls : undefined
            },
            usage: {
                promptTokens: response.usage?.prompt_tokens,
                completionTokens: response.usage?.completion_tokens,
                totalTokens: response.usage?.total_tokens
            }
        };
    }
    async streamChat(messages, tools = [], onDelta) {
        const supportsStreamUsage = !this.client.baseURL || this.client.baseURL.includes('api.openai.com');
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
            stream: true,
            stream_options: supportsStreamUsage ? { include_usage: true } : undefined
        });
        let content = '';
        let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        const rawToolCalls = [];
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                content += delta.content;
                await onDelta(delta.content);
            }
            for (const tc of delta?.tool_calls ?? []) {
                if (!rawToolCalls[tc.index]) {
                    rawToolCalls[tc.index] = {
                        id: tc.id ?? '',
                        type: 'function',
                        function: { name: '', arguments: '' }
                    };
                }
                if (tc.id) {
                    rawToolCalls[tc.index].id = tc.id;
                }
                if (tc.function?.name) {
                    rawToolCalls[tc.index].function.name += tc.function.name;
                }
                if (tc.function?.arguments) {
                    rawToolCalls[tc.index].function.arguments += tc.function.arguments;
                }
            }
            if (chunk.usage) {
                usage = {
                    promptTokens: chunk.usage.prompt_tokens,
                    completionTokens: chunk.usage.completion_tokens,
                    totalTokens: chunk.usage.total_tokens
                };
            }
        }
        const toolCalls = this.normalizeToolCalls(rawToolCalls);
        const safeRawToolCalls = toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments)
            }
        }));
        return {
            content,
            toolCalls,
            message: {
                role: 'assistant',
                content: content || null,
                tool_calls: safeRawToolCalls.length > 0 ? safeRawToolCalls : undefined
            },
            usage
        };
    }
    normalizeToolCalls(toolCalls) {
        return toolCalls.flatMap((toolCall) => {
            const name = toolCall.function.name;
            if (!isAcceptedToolName(name)) {
                return [];
            }
            return [
                {
                    id: toolCall.id,
                    name,
                    arguments: this.parseToolArguments(toolCall.function.arguments)
                }
            ];
        });
    }
    parseToolArguments(rawArguments) {
        try {
            let parsed = JSON.parse(rawArguments);
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                }
                catch {
                    // keep as-is
                }
            }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {};
            }
            return parsed;
        }
        catch {
            return {};
        }
    }
}
