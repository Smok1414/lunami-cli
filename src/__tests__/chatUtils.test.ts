import {describe, expect, it} from '@jest/globals';
import {estimateMessageLines, wrapMultilineText, wrapText} from '../ui/chatUtils.js';

describe('wrapText', () => {
  it('wraps long lines', () => {
    const lines = wrapText('one two three four five', 8);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('keeps short lines', () => {
    expect(wrapText('short', 20)).toEqual(['short']);
  });
});

describe('wrapMultilineText', () => {
  it('uses smaller width on the first line when reserved', () => {
    const lines = wrapMultilineText('Next.js Tailwind layout animations', 20, (index) =>
      index === 0 ? 8 : 2
    );

    expect(lines[0]!.length).toBeLessThanOrEqual(12);
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe('estimateMessageLines', () => {
  it('counts wrapped lines', () => {
    const count = estimateMessageLines('alpha beta gamma delta', 10);
    expect(count).toBeGreaterThan(1);
  });
});
