// File: src/tools/web/search.tool.ts
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { getCwd, resolveProjectPath } from '../../state.js';
export class SearchTool {
    name = 'search';
    description = 'Search for a text pattern in project files (ripgrep if available, otherwise Node scan). Returns file:line:content matches.';
    parameters = {
        type: 'object',
        additionalProperties: false,
        properties: {
            pattern: {
                type: 'string',
                description: 'Text or substring to search for.'
            },
            path: {
                type: 'string',
                description: 'Relative directory or file to search in. Default: current workspace (.).'
            }
        },
        required: ['pattern']
    };
    MAX_MATCHES = 80;
    MAX_LINE_LENGTH = 300;
    MAX_FILE_BYTES = 512_000;
    SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.lunami']);
    async execute(args) {
        try {
            const pattern = args.pattern;
            const pathArg = typeof args.path === 'string' ? args.path : '.';
            if (typeof pattern !== 'string' || !pattern.trim()) {
                return {
                    success: false,
                    output: '',
                    error: 'Search pattern is required.'
                };
            }
            const absolutePath = resolveProjectPath(pathArg);
            const rgResult = await this.tryRipgrep(pattern.trim(), absolutePath);
            if (rgResult) {
                return {
                    success: true,
                    output: JSON.stringify(rgResult)
                };
            }
            const nodeResult = await this.nodeSearch(pattern.trim(), absolutePath);
            return {
                success: true,
                output: JSON.stringify(nodeResult)
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
    async tryRipgrep(pattern, cwd) {
        return new Promise((resolve) => {
            const child = spawn('rg', ['--line-number', '--no-heading', '--color', 'never', '-F', pattern, '.'], { cwd, windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', () => resolve(null));
            child.on('close', (code) => {
                if (code !== 0 && code !== 1 && stderr.includes('not found')) {
                    resolve(null);
                    return;
                }
                const lines = stdout.split('\n').filter(Boolean);
                const truncated = lines.length > this.MAX_MATCHES;
                const matches = this.formatMatches(lines.slice(0, this.MAX_MATCHES), cwd);
                resolve({
                    ok: true,
                    pattern,
                    matches,
                    truncated,
                    engine: 'rg'
                });
            });
        });
    }
    async nodeSearch(pattern, root) {
        const matches = [];
        let truncated = false;
        const lowerPattern = pattern.toLowerCase();
        const walk = async (dir) => {
            if (truncated || matches.length >= this.MAX_MATCHES) {
                truncated = true;
                return;
            }
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (truncated || matches.length >= this.MAX_MATCHES) {
                    truncated = true;
                    return;
                }
                if (entry.name.startsWith('.') && entry.name !== '.env') {
                    continue;
                }
                if (this.SKIP_DIRS.has(entry.name)) {
                    continue;
                }
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }
                if (!entry.isFile()) {
                    continue;
                }
                try {
                    const fileStat = await stat(fullPath);
                    if (fileStat.size > this.MAX_FILE_BYTES) {
                        continue;
                    }
                    const content = await readFile(fullPath, 'utf8');
                    const rel = relative(getCwd(), fullPath).replace(/\\/g, '/');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (matches.length >= this.MAX_MATCHES) {
                            truncated = true;
                            return;
                        }
                        if (lines[i].toLowerCase().includes(lowerPattern)) {
                            const lineText = lines[i].length > this.MAX_LINE_LENGTH
                                ? `${lines[i].slice(0, this.MAX_LINE_LENGTH)}...`
                                : lines[i];
                            matches.push(`${rel}:${i + 1}:${lineText}`);
                        }
                    }
                }
                catch {
                    // skip
                }
            }
        };
        await walk(root);
        return {
            ok: true,
            pattern,
            matches,
            truncated,
            engine: 'node'
        };
    }
    formatMatches(lines, cwd) {
        return lines.map((line) => {
            const normalized = line.replace(/\\/g, '/');
            const rel = relative(cwd, normalized.split(':')[0] ?? normalized).replace(/\\/g, '/');
            const rest = normalized.includes(':') ? normalized.slice(normalized.indexOf(':')) : '';
            const display = rel && !rel.startsWith('..') ? `${rel}${rest}` : normalized;
            if (display.length > this.MAX_LINE_LENGTH + 40) {
                return `${display.slice(0, this.MAX_LINE_LENGTH + 40)}...`;
            }
            return display;
        });
    }
}
