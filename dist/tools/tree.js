import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCwd } from '../state.js';
const ignoredNames = new Set(['.git', 'node_modules', '.lunami', 'dist', '.next', '__pycache__']);
export async function listTree(depth = 2, maxEntries = 120) {
    const root = getCwd();
    const lines = ['.'];
    let seen = 0;
    let limitReached = false;
    async function walk(directory, level, prefix) {
        if (level > depth || limitReached) {
            return;
        }
        let entries = [];
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
        }
        catch {
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
