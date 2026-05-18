import {spawn} from 'node:child_process';
import {readdir, readFile, stat} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {getCwd, resolveProjectPath} from '../state.js';

export type SearchResult = {
  ok: true;
  pattern: string;
  matches: string[];
  truncated: boolean;
  engine: 'rg' | 'node';
};

const MAX_MATCHES = 80;
const MAX_LINE_LENGTH = 300;
const MAX_FILE_BYTES = 512_000;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.lunami']);

export async function searchCode(pattern: string, path = '.'): Promise<SearchResult> {
  const trimmed = pattern.trim();

  if (!trimmed) {
    throw new Error('Search pattern is required.');
  }

  const absolutePath = resolveProjectPath(path);
  const rgResult = await tryRipgrep(trimmed, absolutePath);

  if (rgResult) {
    return rgResult;
  }

  return nodeSearch(trimmed, absolutePath);
}

async function tryRipgrep(pattern: string, cwd: string): Promise<SearchResult | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'rg',
      ['--line-number', '--no-heading', '--color', 'never', '-F', pattern, '.'],
      {cwd, windowsHide: true}
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
      const truncated = lines.length > MAX_MATCHES;
      const matches = formatMatches(lines.slice(0, MAX_MATCHES), cwd);

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

async function nodeSearch(pattern: string, root: string): Promise<SearchResult> {
  const matches: string[] = [];
  let truncated = false;
  const lowerPattern = pattern.toLowerCase();

  async function walk(dir: string): Promise<void> {
    if (truncated || matches.length >= MAX_MATCHES) {
      truncated = true;
      return;
    }

    const entries = await readdir(dir, {withFileTypes: true});

    for (const entry of entries) {
      if (truncated || matches.length >= MAX_MATCHES) {
        truncated = true;
        return;
      }

      if (entry.name.startsWith('.') && entry.name !== '.env') {
        continue;
      }

      if (SKIP_DIRS.has(entry.name)) {
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
        if (fileStat.size > MAX_FILE_BYTES) {
          continue;
        }

        const content = await readFile(fullPath, 'utf8');
        const rel = relative(getCwd(), fullPath).replace(/\\/g, '/');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            return;
          }

          if (lines[i]!.toLowerCase().includes(lowerPattern)) {
            const lineText = lines[i]!.length > MAX_LINE_LENGTH
              ? `${lines[i]!.slice(0, MAX_LINE_LENGTH)}...`
              : lines[i]!;
            matches.push(`${rel}:${i + 1}:${lineText}`);
          }
        }
      } catch {
        // skip
      }
    }
  }

  await walk(root);

  return {
    ok: true,
    pattern,
    matches,
    truncated,
    engine: 'node'
  };
}

function formatMatches(lines: string[], cwd: string): string[] {
  return lines.map((line) => {
    const normalized = line.replace(/\\/g, '/');
    const rel = relative(cwd, normalized.split(':')[0] ?? normalized).replace(/\\/g, '/');
    const rest = normalized.includes(':') ? normalized.slice(normalized.indexOf(':')) : '';
    const display = rel && !rel.startsWith('..') ? `${rel}${rest}` : normalized;

    if (display.length > MAX_LINE_LENGTH + 40) {
      return `${display.slice(0, MAX_LINE_LENGTH + 40)}...`;
    }

    return display;
  });
}
