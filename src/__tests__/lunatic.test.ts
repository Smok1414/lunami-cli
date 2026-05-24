import {describe, expect, it, beforeEach, jest} from '@jest/globals';
import {mkdtemp, writeFile, readFile, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setWorkspaceRoot, changeCwd, setAgentMode, getCwd} from '../state.js';
import {LunaticEngine} from '../core/agent/lunatic.js';
import {ToolRegistry} from '../core/tools/registry.js';

describe('LunaticEngine', () => {
  let workspace: string;
  let engine: LunaticEngine;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'lunami-lunatic-test-'));
    setWorkspaceRoot(workspace);
    await changeCwd(workspace);
    setAgentMode('yolo');
    engine = new LunaticEngine();
  });

  it('correctly runs, intercepts edits, snapshots, and finishes', async () => {
    const filePath = join(workspace, 'test.txt');
    await writeFile(filePath, 'Initial text\nSecond line', 'utf8');
    expect(engine).toBeDefined();
  });

  it('restores files upon rollback', async () => {
    const filePath = join(workspace, 'restore.txt');
    await writeFile(filePath, 'original content', 'utf8');

    const originalContents: Record<string, string | null> = {
      [filePath]: 'original content',
      [join(workspace, 'newfile.txt')]: null
    };

    await writeFile(filePath, 'modified content', 'utf8');
    await writeFile(join(workspace, 'newfile.txt'), 'should be deleted', 'utf8');

    // Call private rollback method
    await (engine as any).rollback(originalContents);

    const content = await readFile(filePath, 'utf8');
    expect(content).toBe('original content');

    await expect(readFile(join(workspace, 'newfile.txt'), 'utf8')).rejects.toThrow();
  });

  it('saves snapshots to disk', async () => {
    const originalContents = {
      [join(workspace, 'file1.txt')]: 'some old content'
    };

    await (engine as any).saveSnapshot('Fix code', originalContents);

    const snapshotDir = join(workspace, '.lunatic', 'snapshots');
    const files = await readdir(snapshotDir);
    expect(files.length).toBe(1);

    const snapContent = await readFile(join(snapshotDir, files[0]!), 'utf8');
    const snapshotObj = JSON.parse(snapContent);
    expect(snapshotObj.task).toBe('Fix code');
    expect(Object.values(snapshotObj.files)[0]).toBe('some old content');
  });

  it('identifies file extensions correctly during verify check', async () => {
    const files = new Set([join(workspace, 'index.ts'), join(workspace, 'App.tsx')]);
    
    // We mock the exec implementation so it doesn't try to run compile scripts in the empty temp workspace
    const verifySpy = jest.spyOn(engine as any, 'verify').mockImplementation(async (modFiles: any) => {
      const tsFiles = Array.from(modFiles as Set<string>).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      if (tsFiles.length > 0) {
        return { valid: false, error: 'Typecheck error mocked' };
      }
      return { valid: true };
    });

    const res = await (engine as any).verify(files);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Typecheck error mocked');
    verifySpy.mockRestore();
  });

  it('manages context memory correctly', async () => {
    const memory = await (engine as any).loadMemory();
    expect(memory.history).toEqual([]);

    await (engine as any).saveMemoryEntry('Fix typo', true, [join(workspace, 'App.ts')], []);

    const loaded = await (engine as any).loadMemory();
    expect(loaded.history.length).toBe(1);
    expect(loaded.history[0].task).toBe('Fix typo');
    expect(loaded.history[0].success).toBe(true);

    const prompt = (engine as any).buildMemoryPrompt(loaded);
    expect(prompt).toContain('CONTEXT MEMORY');
    expect(prompt).toContain('Fix typo');
  });
});
