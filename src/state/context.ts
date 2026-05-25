// File: src/state/context.ts
// Project context (LUNAMI.md, .lunami/project.md, .lunami/rules.md, AGENTS.md).

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getCwd } from './cwd.js';

export function getProjectContextPath(): string {
  return resolve(getCwd(), '.lunami', 'project.md');
}

export async function readProjectContext(): Promise<string> {
  try {
    return await readFile(getProjectContextPath(), 'utf8');
  } catch {
    return '';
  }
}

export async function writeProjectContext(content: string): Promise<string> {
  const path = getProjectContextPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content.trim()}\n`, 'utf8');
  return path;
}

export async function clearProjectContext(): Promise<void> {
  await rm(getProjectContextPath(), { force: true });
}

export async function appendProjectContext(text: string): Promise<string> {
  const existing = (await readProjectContext()).trim();
  const combined = existing ? `${existing}\n\n${text.trim()}` : text.trim();
  return writeProjectContext(combined);
}

export async function readAutoContext(): Promise<string> {
  try {
    return await readFile(resolve(getCwd(), 'LUNAMI.md'), 'utf8');
  } catch {
    return '';
  }
}

export async function readProjectRules(): Promise<string> {
  const paths = [
    resolve(getCwd(), '.lunami', 'rules.md'),
    resolve(getCwd(), 'AGENTS.md')
  ];
  const parts: string[] = [];

  for (const path of paths) {
    try {
      const content = (await readFile(path, 'utf8')).trim();
      if (content) {
        const label = path.endsWith('AGENTS.md') ? 'AGENTS.md' : '.lunami/rules.md';
        parts.push(`[${label}]\n${content}`);
      }
    } catch {
      // missing file
    }
  }

  return parts.join('\n\n');
}

export async function getFullContext(): Promise<string> {
  const [auto, manual, rules] = await Promise.all([
    readAutoContext(),
    readProjectContext(),
    readProjectRules()
  ]);
  const autoTrimmed = auto.trim();
  const manualTrimmed = manual.trim();
  const rulesTrimmed = rules.trim();

  if (!autoTrimmed && !manualTrimmed && !rulesTrimmed) {
    return '';
  }

  const parts: string[] = [];

  if (rulesTrimmed) {
    parts.push(`[Project rules]\n${rulesTrimmed}`);
  }

  if (autoTrimmed) {
    parts.push(`[LUNAMI.md]\n${autoTrimmed}`);
  }

  if (manualTrimmed) {
    parts.push(`[Manual]\n${manualTrimmed}`);
  }

  return parts.join('\n\n');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function hasActiveContext(): Promise<boolean> {
  const full = await getFullContext();
  return full.trim().length > 0;
}
