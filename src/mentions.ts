import {readdir, readFile, stat} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';
import {resolveProjectPath, PathOutsideWorkspaceError, getCwd, getWorkspaceRoot} from './state.js';

const MAX_MENTION_FILES = 20;
const MAX_BYTES_PER_FILE = 48_000;
const MAX_TOTAL_BYTES = 200_000;

export type MentionRef = {
  raw: string;
  path: string;
};

export type ResolvedMention = {
  raw: string;
  path: string;
  kind: 'file' | 'directory';
  content: string;
};

export type MentionResolveResult = {
  preamble: string;
  errors: string[];
  strippedPrompt: string;
};

const MENTION_PATTERN = /(^|[\s(])@([^\s@]+)/g;

export function parseMentions(text: string): MentionRef[] {
  const seen = new Set<string>();
  const refs: MentionRef[] = [];

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const raw = match[2] ?? '';
    if (!raw || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    refs.push({raw, path: raw});
  }

  return refs;
}

export function stripMentions(text: string): string {
  return text.replace(MENTION_PATTERN, (_full, prefix: string) => prefix).replace(/\s{2,}/g, ' ').trim();
}

export async function resolveMentions(text: string): Promise<MentionResolveResult> {
  const refs = parseMentions(text);
  const errors: string[] = [];
  const resolved: ResolvedMention[] = [];
  let totalBytes = 0;

  for (const ref of refs) {
    try {
      const entries = await resolveMentionPath(ref.path);

      for (const entry of entries) {
        if (resolved.length >= MAX_MENTION_FILES) {
          errors.push(`@mention limit: max ${MAX_MENTION_FILES} files`);
          break;
        }

        if (totalBytes + entry.content.length > MAX_TOTAL_BYTES) {
          errors.push(`@mention limit: total size exceeded (${MAX_TOTAL_BYTES} bytes)`);
          break;
        }

        totalBytes += entry.content.length;
        resolved.push(entry);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`@${ref.raw}: ${message}`);
    }
  }

  const preamble = buildMentionPreamble(resolved);
  const errorBlock = errors.length > 0 ? `\n\n[Mention errors]\n${errors.map((e) => `- ${e}`).join('\n')}` : '';

  return {
    preamble: preamble + errorBlock,
    errors,
    strippedPrompt: stripMentions(text),
  };
}

async function resolveMentionPath(inputPath: string): Promise<ResolvedMention[]> {
  const normalized = inputPath.replace(/^\.\//, '');
  let absolutePath: string;

  try {
    absolutePath = resolveProjectPath(normalized);
  } catch (error) {
    if (error instanceof PathOutsideWorkspaceError) {
      throw error;
    }
    absolutePath = resolve(getCwd(), normalized);
  }

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch {
    throw new Error(`not found: ${inputPath}`);
  }

  if (fileStat.isDirectory()) {
    return listDirectoryMentions(inputPath, absolutePath);
  }

  return [await readMentionFile(inputPath, absolutePath)];
}

async function listDirectoryMentions(displayRoot: string, absoluteDir: string): Promise<ResolvedMention[]> {
  const results: ResolvedMention[] = [];
  const queue: string[] = [absoluteDir];

  while (queue.length > 0 && results.length < MAX_MENTION_FILES) {
    const dir = queue.shift()!;
    const entries = await readdir(dir, {withFileTypes: true});

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = join(dir, entry.name);
      const rel = relative(getWorkspaceRoot(), fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      try {
        results.push(await readMentionFile(`${displayRoot}/${entry.name}`, fullPath));
      } catch {
        // skip unreadable files
      }

      if (results.length >= MAX_MENTION_FILES) {
        break;
      }
    }
  }

  if (results.length === 0) {
    throw new Error(`directory empty or no readable files: ${displayRoot}`);
  }

  return results;
}

async function readMentionFile(displayPath: string, absolutePath: string): Promise<ResolvedMention> {
  const fileStat = await stat(absolutePath);

  if (!fileStat.isFile()) {
    throw new Error(`not a file: ${displayPath}`);
  }

  if (fileStat.size > MAX_BYTES_PER_FILE) {
    const content = await readFile(absolutePath, 'utf8');
    const truncated = content.slice(0, MAX_BYTES_PER_FILE);
    return {
      raw: displayPath,
      path: displayPath,
      kind: 'file',
      content: `${truncated}\n... (truncated, ${fileStat.size} bytes total)`
    };
  }

  const content = await readFile(absolutePath, 'utf8');

  return {
    raw: displayPath,
    path: displayPath,
    kind: 'file',
    content
  };
}

function buildMentionPreamble(resolved: ResolvedMention[]): string {
  if (resolved.length === 0) {
    return '';
  }

  const blocks = resolved.map((item) => {
    const header = item.kind === 'directory' ? `Directory file: ${item.path}` : `File: ${item.path}`;
    return `--- ${header} ---\n${item.content}`;
  });

  return `[Referenced files from @mentions]\n\n${blocks.join('\n\n')}`;
}
