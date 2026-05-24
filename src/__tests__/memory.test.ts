import {describe, expect, it} from '@jest/globals';
import {LongMemory} from '../core/memory/long.memory.js';

const longMemory = new LongMemory();

describe('memory session validation', () => {
  it('accepts valid session names', () => {
    const memory = longMemory.createEmptyMemory('gpt-4', 'my-session_1');
    expect(memory.sessionName).toBe('my-session_1');
  });

  it('rejects invalid session names', () => {
    expect(() => longMemory.createEmptyMemory('gpt-4', '../bad')).toThrow();
    expect(() => longMemory.createEmptyMemory('gpt-4', '')).toThrow();
  });
});
