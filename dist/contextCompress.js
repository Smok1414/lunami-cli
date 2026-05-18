const KEEP_RECENT = 12;
const TOOL_SUMMARY_MAX = 400;
export function compressConversationMessages(systemMessages, conversation) {
    if (conversation.length <= KEEP_RECENT) {
        return { messages: [...systemMessages, ...conversation], summaryNote: '' };
    }
    const older = conversation.slice(0, -KEEP_RECENT);
    const recent = conversation.slice(-KEEP_RECENT);
    const summary = summarizeOlderMessages(older);
    const summaryMessage = {
        role: 'system',
        content: `[Earlier conversation compressed]\n${summary}`
    };
    return {
        messages: [...systemMessages, summaryMessage, ...recent],
        summaryNote: 'heuristic'
    };
}
function summarizeOlderMessages(messages) {
    const parts = [];
    let userCount = 0;
    for (const message of messages) {
        if (message.role === 'user' && typeof message.content === 'string') {
            userCount++;
            if (userCount <= 5) {
                parts.push(`User: ${truncate(message.content, 200)}`);
            }
        }
        if (message.role === 'assistant' && typeof message.content === 'string' && message.content.trim()) {
            parts.push(`Assistant: ${truncate(message.content, 150)}`);
        }
        if (message.role === 'tool' && typeof message.content === 'string') {
            parts.push(summarizeToolContent(message.content));
        }
    }
    if (parts.length === 0) {
        return `(${messages.length} earlier messages omitted)`;
    }
    return parts.join('\n');
}
function summarizeToolContent(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.path === 'string') {
            const action = parsed.isNew ? 'created' : 'modified';
            return `Tool writeFile: ${parsed.path} (${action})`;
        }
        if (typeof parsed.command === 'string') {
            return `Tool exec: ${parsed.command} → exit ${parsed.exitCode ?? '?'}`;
        }
        if (typeof parsed.error === 'string') {
            return `Tool error: ${truncate(parsed.error, 120)}`;
        }
        if (typeof parsed.ok === 'boolean') {
            return `Tool result: ok=${parsed.ok}`;
        }
    }
    catch {
        // plain text
    }
    return `Tool: ${truncate(raw, TOOL_SUMMARY_MAX)}`;
}
function truncate(text, max) {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, max)}…`;
}
