import {describe, expect, it} from '@jest/globals';
import {parseMentions, stripMentions} from '../mentions.js';

describe('parseMentions', () => {
  it('extracts file and folder mentions', () => {
    const refs = parseMentions('check @src/agent.ts and @src/ please');
    expect(refs.map((r) => r.path)).toEqual(expect.arrayContaining(['src/agent.ts', 'src/']));
  });

  it('supports ./ prefix', () => {
    const refs = parseMentions('see @./README.md');
    expect(refs[0]?.path).toBe('./README.md');
  });
});

describe('stripMentions', () => {
  it('removes @tokens from prompt', () => {
    expect(stripMentions('fix @src/foo.ts now')).toBe('fix now');
  });
});
