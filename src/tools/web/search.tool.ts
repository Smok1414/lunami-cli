// File: src/tools/web/search.tool.ts

import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { getCwd, resolveProjectPath } from '../../state.js';
import type { ITool } from '../../core/tools/tool.interface.js';
import type { ToolResult } from '../../types/index.js';

export class SearchTool implements ITool {
  public readonly name = 'search';
  public readonly description = 'Search for a text pattern in project files (ripgrep if available, otherwise Node scan). Returns file:line:content matches.';
  public readonly parameters = {
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

  private readonly MAX_MATCHES = 80;
  private readonly MAX_LINE_LENGTH = 300;
  private readonly MAX_FILE_BYTES = 512_000;
  private readonly SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.lunami']);

  public async execute(args: Record<string, any>): Promise<ToolResult> {
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
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async tryRipgrep(pattern: string, cwd: string): Promise<any | null> {
    return new Promise((resolve) => {
      const child = spawn(
        'rg',
        ['--line-number', '--no-heading', '--color', 'never', '-F', pattern, '.'],
        { cwd, windowsHide: true }
      );

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

  private async nodeSearch(pattern: string, root: string): Promise<any> {
    const matches: string[] = [];
    let truncated = false;
    const lowerPattern = pattern.toLowerCase();

    const walk = async (dir: string): Promise<void> => {
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

            if (lines[i]!.toLowerCase().includes(lowerPattern)) {
              const lineText = lines[i]!.length > this.MAX_LINE_LENGTH
                ? `${lines[i]!.slice(0, this.MAX_LINE_LENGTH)}...`
                : lines[i]!;
              matches.push(`${rel}:${i + 1}:${lineText}`);
            }
          }
        } catch {
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

  private formatMatches(lines: string[], cwd: string): string[] {
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
