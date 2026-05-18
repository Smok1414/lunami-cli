import {describe, expect, it} from '@jest/globals';
import {createEmptyMemory} from '../memory.js';

describe('memory session validation', () => {
  it('accepts valid session names', () => {
    const memory = createEmptyMemory('gpt-4', 'my-session_1');
    expect(memory.sessionName).toBe('my-session_1');
  });

  it('rejects invalid session names', () => {
    expect(() => createEmptyMemory('gpt-4', '../bad')).toThrow();
    expect(() => createEmptyMemory('gpt-4', '')).toThrow();
  });
});
