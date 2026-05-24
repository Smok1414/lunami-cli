const llmFunctionNamePattern = /^[a-zA-Z0-9_-]{1,64}$/;
export function isValidLlmFunctionName(name) {
    return llmFunctionNamePattern.test(name);
}
export function sanitizeLlmTools(tools) {
    const seen = new Set();
    const sanitized = [];
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
export function sanitizeChatCompletionMessages(messages) {
    const sanitized = [];
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
        const assistantMessage = message;
        const toolCalls = (assistantMessage.tool_calls ?? [])
            .map(sanitizeToolCall)
            .filter((toolCall) => toolCall !== null);
        if (toolCalls.length > 0) {
            const toolMessages = [];
            const answeredToolCallIds = new Set();
            let cursor = index + 1;
            while (cursor < messages.length && messages[cursor]?.role === 'tool') {
                const toolMessage = messages[cursor];
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
                });
                sanitized.push(...toolMessages);
                index = cursor - 1;
                continue;
            }
        }
        if (hasContent(assistantMessage.content)) {
            sanitized.push({
                ...assistantMessage,
                tool_calls: undefined
            });
        }
    }
    return sanitized;
}
function sanitizeToolCall(toolCall) {
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
function hasContent(content) {
    if (typeof content === 'string') {
        return content.trim().length > 0;
    }
    if (Array.isArray(content)) {
        return content.length > 0;
    }
    return false;
}
