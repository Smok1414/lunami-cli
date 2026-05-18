const MCP_PREFIX = 'mcp__';
const SERVER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
export function isValidMcpServerName(name) {
    return SERVER_NAME_PATTERN.test(name);
}
export function namespaceMcpTool(serverName, toolName) {
    return `${MCP_PREFIX}${serverName}__${toolName}`;
}
export function isMcpToolName(name) {
    return name.startsWith(MCP_PREFIX);
}
export function parseMcpToolName(namespaced) {
    if (!isMcpToolName(namespaced)) {
        return null;
    }
    const body = namespaced.slice(MCP_PREFIX.length);
    const separator = body.indexOf('__');
    if (separator <= 0 || separator === body.length - 2) {
        return null;
    }
    const serverName = body.slice(0, separator);
    const toolName = body.slice(separator + 2);
    if (!isValidMcpServerName(serverName) || !toolName) {
        return null;
    }
    return { serverName, toolName };
}
