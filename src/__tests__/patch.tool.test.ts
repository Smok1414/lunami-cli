import {describe, expect, it, beforeEach} from '@jest/globals';
import {mkdtemp, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setWorkspaceRoot, changeCwd, setAgentMode} from '../state.js';
import {PatchTool} from '../tools/file/patch.tool.js';

describe('PatchTool', () => {
  let workspace: string;
  let testFilePath: string;
  const tool = new PatchTool();

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'lunami-patch-test-'));
    setWorkspaceRoot(workspace);
    await changeCwd(workspace);
    setAgentMode('yolo'); // skip approvals

    testFilePath = join(workspace, 'file.txt');
    await writeFile(
      testFilePath,
      ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'].join('\n'),
      'utf8'
    );
  });

  it('patches a single range correctly', async () => {
    const res = await tool.execute({
      path: 'file.txt',
      patches: [
        {
          startLine: 2,
          endLine: 4,
          replace: 'New Line 2\nNew Line 3'
        }
      ]
    });

    expect(res.success).toBe(true);

    const content = await readFile(testFilePath, 'utf8');
    expect(content.split('\n')).toEqual(['Line 1', 'New Line 2', 'New Line 3', 'Line 5']);
  });

  it('patches multiple ranges from bottom to top correctly', async () => {
    const res = await tool.execute({
      path: 'file.txt',
      patches: [
        {
          startLine: 2,
          endLine: 2,
          replace: 'Line 2 Mod'
        },
        {
          startLine: 4,
          endLine: 5,
          replace: 'Line 4 & 5 Mod'
        }
      ]
    });

    expect(res.success).toBe(true);

    const content = await readFile(testFilePath, 'utf8');
    expect(content.split('\n')).toEqual(['Line 1', 'Line 2 Mod', 'Line 3', 'Line 4 & 5 Mod']);
  });

  it('fails with invalid line numbers', async () => {
    const res = await tool.execute({
      path: 'file.txt',
      patches: [
        {
          startLine: 10,
          endLine: 12,
          replace: 'Fail'
        }
      ]
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid line range');
  });
});
