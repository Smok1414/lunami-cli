import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {getCwd} from '../state.js';

export type TreeResult = {
  ok: true;
  root: string;
  tree: string;
};

const ignoredNames = new Set(['.git', 'node_modules', '.lunami', 'dist', '.next', '__pycache__']);

export async function listTree(depth = 2, maxEntries = 120): Promise<TreeResult> {
  const root = getCwd();
  const lines: string[] = ['.'];
  let seen = 0;
  let limitReached = false;

  async function walk(directory: string, level: number, prefix: string): Promise<void> {
    if (level > depth || limitReached) {
      return;
    }

    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = (await readdir(directory, {withFileTypes: true}))
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
  }

  await walk(root, 1, '');

  return {
    ok: true,
    root,
    tree: lines.join('\n')
  };
}
