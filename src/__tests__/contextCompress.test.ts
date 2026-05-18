import {describe, expect, it} from '@jest/globals';
import type {ChatCompletionMessageParam} from 'openai/resources/chat/completions';
import {compressConversationMessages} from '../contextCompress.js';

describe('compressConversationMessages', () => {
  it('adds summary for long histories', () => {
    const system: ChatCompletionMessageParam[] = [{role: 'system', content: 'sys'}];
    const conversation: ChatCompletionMessageParam[] = [];

    for (let i = 0; i < 20; i++) {
      conversation.push({role: 'user', content: `question ${i}`});
      conversation.push({role: 'assistant', content: `answer ${i}`});
    }

    const result = compressConversationMessages(system, conversation);
    expect(result.messages.some((m) => m.role === 'system' && String(m.content).includes('compressed'))).toBe(true);
    expect(result.messages.length).toBeLessThan(system.length + conversation.length);
  });
});
