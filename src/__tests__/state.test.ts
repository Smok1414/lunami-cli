import {describe, expect, it, beforeEach, afterEach} from '@jest/globals';
import {mkdtemp, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  PathOutsideWorkspaceError,
  resolveProjectPath,
  setWorkspaceRoot,
  changeCwd
} from '../state.js';

describe('resolveProjectPath', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'lunami-test-'));
    setWorkspaceRoot(workspace);
    await changeCwd(workspace);
    await writeFile(join(workspace, 'inside.txt'), 'ok', 'utf8');
  });

  it('resolves relative paths inside workspace', () => {
    expect(resolveProjectPath('inside.txt')).toContain('inside.txt');
  });

  it('throws for paths outside workspace', () => {
    expect(() => resolveProjectPath('..')).toThrow(PathOutsideWorkspaceError);
  });
});
