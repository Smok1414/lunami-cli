// File: src/tools/file/tree.tool.ts

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCwd } from '../../state.js';
import type { ITool } from '../../core/tools/tool.interface.js';
import type { ToolResult } from '../../types/index.js';

export interface TreeToolPayload {
  ok: true;
  root: string;
  tree: string;
}

const ignoredNames = new Set(['.git', 'node_modules', '.lunami', 'dist', '.next', '__pycache__']);

export class TreeTool implements ITool {
  public readonly name = 'tree';
  public readonly description = 'Show a compact file tree for the current working directory.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {
      depth: {
        type: 'number',
        description: 'Maximum directory depth. Default is 2.'
      },
      maxEntries: {
        type: 'number',
        description: 'Maximum number of rendered entries. Default is 120.'
      }
    }
  };

  public async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const depth = typeof args.depth === 'number' ? Math.max(1, Math.floor(args.depth)) : 2;
      const maxEntries = typeof args.maxEntries === 'number' ? Math.max(1, Math.floor(args.maxEntries)) : 120;
      const payload = await this.list(depth, maxEntries);

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

  public async list(depth = 2, maxEntries = 120): Promise<TreeToolPayload> {
    const root = getCwd();
    const lines: string[] = ['.'];
    let seen = 0;
    let limitReached = false;

    const walk = async (directory: string, level: number, prefix: string): Promise<void> => {
      if (level > depth || limitReached) {
        return;
      }

      let entries: import('node:fs').Dirent[] = [];
      try {
        entries = (await readdir(directory, { withFileTypes: true }))
          .filter((entry) => !ignoredNames.has(entry.name))
          .sort((left, right) => {
            if (left.isDirectory() && !right.isDirectory()) {
              return -1;
            }

            if (!left.isDirectory() && right.isDirectory()) {
              return 1;
            }

            return left.name.localeCompare(right.name);
          });
      } catch {
        lines.push(`${prefix}├─ [Access Denied]`);
        return;
      }

      for (const [index, entry] of entries.entries()) {
        if (seen >= maxEntries) {
          if (!limitReached) {
            limitReached = true;
            lines.push(`${prefix}...`);
          }
          return;
        }

        seen += 1;

        const isLast = index === entries.length - 1;
        const marker = isLast ? '└─' : '├─';
        const childPrefix = `${prefix}${isLast ? '  ' : '│ '}`;
        const label = `${entry.name}${entry.isDirectory() ? '/' : ''}`;

        lines.push(`${prefix}${marker} ${label}`);

        if (entry.isDirectory()) {
          await walk(join(directory, entry.name), level + 1, childPrefix);
        }
      }
    };

    await walk(root, 1, '');

    return {
      ok: true,
      root,
      tree: lines.join('\n')
    };
  }
}
