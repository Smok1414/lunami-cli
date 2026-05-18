import { describe, expect, it } from '@jest/globals';
import {
  mergeMcpConfigs,
  parseMcpConfigJson
} from '../mcp/config.js';
import {
  isMcpToolName,
  isValidMcpServerName,
  namespaceMcpTool,
  parseMcpToolName
} from '../mcp/names.js';
import { isAcceptedToolName, isBuiltinToolName } from '../toolNames.js';

describe('MCP tool names', () => {
  it('namespaces and parses tools', () => {
    const namespaced = namespaceMcpTool('filesystem', 'read_file');
    expect(namespaced).toBe('mcp__filesystem__read_file');
    expect(isMcpToolName(namespaced)).toBe(true);
    expect(parseMcpToolName(namespaced)).toEqual({
      serverName: 'filesystem',
      toolName: 'read_file'
    });
  });

  it('rejects invalid server names', () => {
    expect(isValidMcpServerName('9bad')).toBe(false);
    expect(parseMcpToolName('mcp____tool')).toBeNull();
  });
});

describe('MCP config', () => {
  it('parses a valid config file', () => {
    const config = parseMcpConfigJson(JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
        }
      }
    }));

    expect(config.mcpServers.filesystem.command).toBe('npx');
    expect(config.mcpServers.filesystem.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '.'
    ]);
  });

  it('merges workspace over global', () => {
    const merged = mergeMcpConfigs(
      {
        mcpServers: {
          alpha: { command: 'global-cmd' },
          shared: { command: 'global-shared' }
        }
      },
      {
        mcpServers: {
          beta: { command: 'workspace-cmd' },
          shared: { command: 'workspace-shared' }
        }
      }
    );

    expect(merged.mcpServers.alpha.command).toBe('global-cmd');
    expect(merged.mcpServers.beta.command).toBe('workspace-cmd');
    expect(merged.mcpServers.shared.command).toBe('workspace-shared');
  });

  it('rejects invalid server config', () => {
    expect(() => parseMcpConfigJson('{"mcpServers":{"bad":{"args":["x"]}}}')).toThrow();
  });
});

describe('accepted agent tools', () => {
  it('accepts built-in and MCP tools only', () => {
    expect(isBuiltinToolName('readFile')).toBe(true);
    expect(isAcceptedToolName('mcp__fs__list')).toBe(true);
    expect(isAcceptedToolName('unknown_tool')).toBe(false);
  });
});
