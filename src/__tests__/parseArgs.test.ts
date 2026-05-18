import {describe, expect, it} from '@jest/globals';
import {isAutoApproveWrites, parseArgs, ParseArgsError} from '../parseArgs.js';

describe('parseArgs', () => {
  it('parses prompt and yes flag', () => {
    const args = parseArgs(['node', 'lunami', '--prompt', 'hi', '--yes', '--cwd', '/tmp']);
    expect(args.prompt).toBe('hi');
    expect(args.yes).toBe(true);
    expect(args.cwd).toBe('/tmp');
  });

  it('parses short -y', () => {
    const args = parseArgs(['node', 'lunami', '-y', '-p', 'task']);
    expect(args.yes).toBe(true);
    expect(args.prompt).toBe('task');
  });

  it('throws when flag requires value', () => {
    expect(() => parseArgs(['node', 'lunami', '--prompt'])).toThrow(ParseArgsError);
  });

  it('throws on invalid max-rounds', () => {
    expect(() => parseArgs(['node', 'lunami', '--max-rounds', '0'])).toThrow(ParseArgsError);
  });
});

describe('isAutoApproveWrites', () => {
  const previousYes = process.env.LUNAMI_YES;

  afterEach(() => {
    if (previousYes === undefined) {
      delete process.env.LUNAMI_YES;
    } else {
      process.env.LUNAMI_YES = previousYes;
    }
  });

  it('returns true for yes flag', () => {
    expect(isAutoApproveWrites(true)).toBe(true);
  });

  it('returns true when LUNAMI_YES=1', () => {
    process.env.LUNAMI_YES = '1';
    expect(isAutoApproveWrites(false)).toBe(true);
  });
});
