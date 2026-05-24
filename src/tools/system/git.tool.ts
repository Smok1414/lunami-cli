// File: src/tools/system/git.tool.ts

import { execFile } from 'node:child_process';
import { agentSkipsApprovals, getAgentMode, getCwd, setPendingApproval } from '../../state.js';
import type { ITool } from '../../core/tools/tool.interface.js';
import type { ToolResult } from '../../types/index.js';

export interface GitCommandPayload {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class GitStatusTool implements ITool {
  public readonly name = 'gitStatus';
  public readonly description = 'Show git status for the current working directory.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {}
  };

  public async execute(): Promise<ToolResult> {
    try {
      const payload = await runGit(['status', '--short']);
      return {
        success: true,
        output: JSON.stringify(payload)
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class GitDiffTool implements ITool {
  public readonly name = 'gitDiff';
  public readonly description = 'Show git diff for the current working directory.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {}
  };

  public async execute(): Promise<ToolResult> {
    try {
      const payload = await runGit(['diff', '--', '.']);
      return {
        success: true,
        output: JSON.stringify(payload)
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class GitCommitTool implements ITool {
  public readonly name = 'gitCommit';
  public readonly description = 'Create a git commit with the provided message. Requires user approval before execution.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: {
        type: 'string',
        description: 'Commit message.'
      }
    },
    required: ['message']
  };

  public async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const { message } = args;

      if (typeof message !== 'string') {
        return {
          success: false,
          output: '',
          error: 'Argument "message" must be a string.'
        };
      }

      if (!message.trim()) {
        return {
          success: false,
          output: '',
          error: 'Commit message is required.'
        };
      }

      const mode = getAgentMode();
      if (!agentSkipsApprovals(mode)) {
        const approval = setPendingApproval({ type: 'gitCommit', message });
        return {
          success: true,
          output: JSON.stringify({
            ok: false,
            needsApproval: true,
            approvalId: approval.id,
            message
          })
        };
      }

      const payload = await this.commit(message);
      return {
        success: true,
        output: JSON.stringify(payload)
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  public async commit(message: string): Promise<GitCommandPayload> {
    if (!message.trim()) {
      throw new Error('Commit message is required.');
    }

    const addResult = await runGit(['add', '-A']);
    if (!addResult.ok) {
      return addResult;
    }

    return runGit(['commit', '-m', message]);
  }
}

const maxOutputLength = 12_000;

function runGit(args: string[]): Promise<GitCommandPayload> {
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
          typeof (error as { code?: unknown } | null)?.code === 'number'
            ? (error as { code: number }).code
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
