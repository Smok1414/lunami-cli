import { execFile } from 'node:child_process';
import { getCwd } from '../state.js';
const maxOutputLength = 12_000;
export async function gitStatus() {
    return runGit(['status', '--short']);
}
export async function gitDiff() {
    return runGit(['diff', '--', '.']);
}
export async function gitCommit(message) {
    if (!message.trim()) {
        throw new Error('Commit message is required.');
    }
    const addResult = await runGit(['add', '-A']);
    if (!addResult.ok) {
        return addResult;
    }
    return runGit(['commit', '-m', message]);
}
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
