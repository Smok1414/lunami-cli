import {describe, expect, it} from '@jest/globals';
import type {LLMMessage, LLMTool} from '../llm.js';
import {
  sanitizeChatCompletionMessages,
  sanitizeLlmTools
} from '../providers/requestSanitizer.js';

describe('request sanitizer', () => {
  it('filters tools with invalid LLM function names', () => {
    const tools = [
      createTool('readFile'),
      createTool('file.read'),
      createTool('system.exec'),
      createTool('mcp__fs__read_file')
    ];

    expect(sanitizeLlmTools(tools).map((tool) => tool.function.name)).toEqual([
      'readFile',
      'mcp__fs__read_file'
    ]);
  });

  it('drops orphan tool messages and invalid dotted tool calls', () => {
    const messages: LLMMessage[] = [
      {role: 'user', content: 'fix bug'},
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'bad-1',
          type: 'function',
          function: {name: 'file.read', arguments: '{"path":"x"}'}
        }]
      },
      {role: 'tool', tool_call_id: 'bad-1', content: '{"ok":true}'}
    ];

    expect(sanitizeChatCompletionMessages(messages)).toEqual([
      {role: 'user', content: 'fix bug'}
    ]);
  });

  it('keeps valid assistant tool calls with matching tool results', () => {
    const messages: LLMMessage[] = [
      {role: 'user', content: 'read package'},
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: {name: 'readFile', arguments: '{"path":"package.json"}'}
        }]
      },
      {role: 'tool', tool_call_id: 'call-1', content: '{"ok":true}'}
    ];

    expect(sanitizeChatCompletionMessages(messages)).toHaveLength(3);
  });
});

function createTool(name: string): LLMTool {
  return {
    type: 'function',
    function: {
      name,
      description: 'test tool',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  };
}
