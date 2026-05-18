import {execFile} from 'node:child_process';
import {getCwd} from '../state.js';

export type GitResult = {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

const maxOutputLength = 12_000;

export async function gitStatus(): Promise<GitResult> {
  return runGit(['status', '--short']);
}

export async function gitDiff(): Promise<GitResult> {
  return runGit(['diff', '--', '.']);
}

export async function gitCommit(message: string): Promise<GitResult> {
  if (!message.trim()) {
    throw new Error('Commit message is required.');
  }

  const addResult = await runGit(['add', '-A']);
  if (!addResult.ok) {
    return addResult;
  }
  return runGit(['commit', '-m', message]);
}

function runGit(args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: getCwd(),
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const exitCode =
          typeof (error as {code?: unknown} | null)?.code === 'number'
            ? (error as {code: number}).code
            : error
              ? 127
              : 0;

        resolve({
          ok: !error,
          command: `git ${args.join(' ')}`,
          exitCode,
          stdout: truncate(stdout),
          stderr: truncate(stderr)
        });
      }
    );
  });
}

function truncate(value: string): string {
  if (value.length <= maxOutputLength) {
    return value;
  }

  return `${value.slice(0, maxOutputLength)}\n...[truncated]`;
}
