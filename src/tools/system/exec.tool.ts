// File: src/tools/system/exec.tool.ts

import { exec } from 'node:child_process';
import { changeCwd, getCwd, getAgentMode, agentSkipsApprovals, setPendingApproval } from '../../state.js';
import type { ITool } from '../../core/tools/tool.interface.js';
import type { ToolResult } from '../../types/index.js';

export class ExecTool implements ITool {
  public readonly name: string;

  constructor(name = 'execCommand') {
    this.name = name;
  }
  public readonly description = 'Run a shell command from the current project workspace and return stdout/stderr. WARNING: Do NOT run blocking commands like `npm run dev` or `npm start` that start a server. They will hang and time out, causing the agent to fail. If a dev server is needed, just instruct the user to run it themselves.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {
      command: {
        type: 'string',
        description: 'Command to run.'
      }
    },
    required: ['command']
  };

  private readonly maxOutputLength = 12_000;

  public async execute(args: Record<string, any>, context?: { toolCallId?: string }): Promise<ToolResult> {
    try {
      const command = args.command;
      if (typeof command !== 'string') {
        return {
          success: false,
          output: '',
          error: 'Argument "command" must be a string.'
        };
      }

      const mode = getAgentMode();

      // Check dangerous commands and approvals
      if (this.isDangerousCommand(command) && !agentSkipsApprovals(mode)) {
        const approval = setPendingApproval({ type: 'execCommand', command });
        return {
          success: true,
          output: JSON.stringify({ ok: false, needsApproval: true, approvalId: approval.id, command })
        };
      }

      // Check cd command intercept
      const cdTarget = this.parseCdCommand(command);
      if (cdTarget !== null) {
        try {
          const newCwd = await changeCwd(cdTarget);
          return {
            success: true,
            output: JSON.stringify({
              ok: true,
              command,
              exitCode: 0,
              stdout: `cwd: ${newCwd}`,
              stderr: ''
            })
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            success: true,
            output: JSON.stringify({
              ok: false,
              command,
              exitCode: 1,
              stdout: '',
              stderr: message
            })
          };
        }
      }

      const result = await new Promise<{ ok: boolean; command: string; exitCode: number; stdout: string; stderr: string }>((resolve) => {
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
              isTimeout ? `Command timed out after 30s\n${this.truncate(stderr)}`
                : isMaxBuffer ? `Output exceeded 1MB, truncated.\n${this.truncate(stderr)}`
                  : this.truncate(stderr);

            resolve({
              ok: !error,
              command,
              exitCode,
              stdout: this.truncate(stdout),
              stderr: stderrOut
            });
          }
        );
      });

      return {
        success: true,
        output: JSON.stringify(result)
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private isDangerousCommand(command: string): boolean {
    const normalized = command.trim().toLowerCase();

    return [
      /\brm\s+(-[a-z]*r[a-z]*|-rf|-fr)\b/,
      /\bdel\s+(\/[fsq]\s*)+/,
      /\brmdir\s+(\/s|-[a-z]*r)/,
      /\brd\s+(\/s|-[a-z]*r)/,
      /\bformat\s+[a-z]:/,
      /\bgit\s+reset\b/,
      /\bnpm(?:\.cmd)?\s+(install|i)(\s|$)/
    ].some((pattern) => pattern.test(normalized)) || (/\brd\b/.test(normalized) && /\b\/s\b/.test(normalized));
  }

  private parseCdCommand(command: string): string | null {
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

  private truncate(value: string): string {
    if (value.length <= this.maxOutputLength) return value;
    return `${value.slice(0, this.maxOutputLength)}\n...[truncated]`;
  }
}
