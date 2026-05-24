import {describe, expect, it} from '@jest/globals';
import {commands, filterCommands} from '../commands.js';

describe('filterCommands', () => {
  it('returns empty for non-slash input', () => {
    expect(filterCommands('hello')).toEqual([]);
  });

  it('filters by command prefix', () => {
    const result = filterCommands('/pl');
    expect(result.some((cmd) => cmd.name === '/plan')).toBe(true);
  });

  it('includes /rules command', () => {
    expect(commands.some((cmd) => cmd.name === '/rules')).toBe(true);
  });

  it('includes /mcp command', () => {
    expect(commands.some((cmd) => cmd.name === '/mcp')).toBe(true);
  });

  it('includes /lunatic autonomous command', () => {
    expect(commands.some((cmd) => cmd.name === '/lunatic')).toBe(true);
    expect(filterCommands('/lun').some((cmd) => cmd.name === '/lunatic')).toBe(true);
  });
});
