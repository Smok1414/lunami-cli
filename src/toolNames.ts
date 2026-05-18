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
  'gitCommit'
] as const;

export type BuiltinToolName = (typeof BUILTIN_TOOL_NAMES)[number];

export function isBuiltinToolName(name: string): name is BuiltinToolName {
  return (BUILTIN_TOOL_NAMES as readonly string[]).includes(name);
}

export function isAcceptedToolName(name: string): boolean {
  return isBuiltinToolName(name) || isMcpToolName(name);
}
