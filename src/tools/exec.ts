import { exec } from 'node:child_process';
import { changeCwd, getCwd } from '../state.js';

export type ExecCommandResult = {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

const maxOutputLength = 12_000;

export async function execCommand(command: string): Promise<ExecCommandResult> {
  const cdTarget = parseCdCommand(command);
  if (cdTarget !== null) {
    try {
      const newCwd = await changeCwd(cdTarget);
      return {
        ok: true,
        command,
        exitCode: 0,
        stdout: `cwd: ${newCwd}`,
        stderr: ''
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        command,
        exitCode: 1,
        stdout: '',
        stderr: message
      };
    }
  }

  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: getCwd(),
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        const isTimeout = err?.killed === true;
        const isMaxBuffer = err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';

        const exitCode =
          isTimeout ? 124
            : typeof err?.code === 'number' ? err.code
              : err ? 127
                : 0;

        const stderrOut =
          isTimeout ? `Command timed out after 30s\n${truncate(stderr)}`
            : isMaxBuffer ? `Output exceeded 1MB, truncated.\n${truncate(stderr)}`
              : truncate(stderr);

        resolve({
          ok: !error,
          command,
          exitCode,
          stdout: truncate(stdout),
          stderr: stderrOut
        });
      }
    );
  });
}

/** Shell `cd` не меняет cwd Node — перехватываем и вызываем changeCwd. */
function parseCdCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed || /[;&|]/.test(trimmed)) {
    return null;
  }

  const match = /^(?:cd|chdir)(?:\s+(?:\/d\s+)?(.+))?$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const raw = (match[1] ?? '.').trim();
  return raw.replace(/^["']|["']$/g, '');
}

function truncate(value: string): string {
  if (value.length <= maxOutputLength) return value;
  return `${value.slice(0, maxOutputLength)}\n...[truncated]`;
}