import { isMcpToolName } from './mcp/names.js';
export const BUILTIN_TOOL_NAMES = [
    'readFile',
    'writeFile',
    'execCommand',
    'generateProject',
    'tree',
    'search',
    'gitStatus',
    'gitDiff',
    'gitCommit',
    'file.read',
    'file.write',
    'system.exec',
    'patchFile',
    'file.patch'
];
export function isBuiltinToolName(name) {
    return BUILTIN_TOOL_NAMES.includes(name);
}
export function isAcceptedToolName(name) {
    return isBuiltinToolName(name) || isMcpToolName(name);
}
