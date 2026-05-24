// File: src/tools/system/git.tool.ts
import { execFile } from 'node:child_process';
import { agentSkipsApprovals, getAgentMode, getCwd, setPendingApproval } from '../../state.js';
export class GitStatusTool {
    name = 'gitStatus';
    description = 'Show git status for the current working directory.';
    parameters = {
        type: 'object',
        additionalProperties: false,
        properties: {}
    };
    async execute() {
        try {
            const payload = await runGit(['status', '--short']);
            return {
                success: true,
                output: JSON.stringify(payload)
            };
        }
        catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
export class GitDiffTool {
    name = 'gitDiff';
    description = 'Show git diff for the current working directory.';
    parameters = {
        type: 'object',
        additionalProperties: false,
        properties: {}
    };
    async execute() {
        try {
            const payload = await runGit(['diff', '--', '.']);
            return {
                success: true,
                output: JSON.stringify(payload)
            };
        }
        catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
export class GitCommitTool {
    name = 'gitCommit';
    description = 'Create a git commit with the provided message. Requires user approval before execution.';
    parameters = {
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
    async execute(args) {
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
        }
        catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async commit(message) {
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
function runGit(args) {
    return new Promise((resolve) => {
        execFile('git', args, {
            cwd: getCwd(),
            timeout: 30_000,
            maxBuffer: 1024 * 1024,
            windowsHide: true
        }, (error, stdout, stderr) => {
            const exitCode = typeof error?.code === 'number'
                ? error.code
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
        });
    });
}
function truncate(value) {
    if (value.length <= maxOutputLength) {
        return value;
    }
    return `${value.slice(0, maxOutputLength)}\n...[truncated]`;
}
