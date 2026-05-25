// File: src/state/cwd.ts
// Working-directory and workspace-root state.

import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { stat } from 'node:fs/promises';

let currentCwd = process.cwd();
let workspaceRoot = process.cwd();

export function getCwd(): string {
  return currentCwd;
}

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function setWorkspaceRoot(path: string): void {
  workspaceRoot = path;
}

export async function changeCwd(target: string): Promise<string> {
  const resolved = resolveTarget(target);
  let stats;

  try {
    stats = await stat(resolved);
  } catch {
    throw new Error(`Path not found: ${target}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${target}`);
  }

  currentCwd = resolved;
  workspaceRoot = resolved;
  process.chdir(resolved);
  return currentCwd;
}

export function resolveProjectPath(path: string): string {
  const root = resolve(getWorkspaceRoot());
  const absolutePath = isAbsolute(path) ? resolve(path) : resolve(getCwd(), path);

  if (!isPathInsideWorkspace(root, absolutePath)) {
    throw new PathOutsideWorkspaceError(path, root, getCwd());
  }

  return absolutePath;
}

export class PathOutsideWorkspaceError extends Error {
  constructor(
    public readonly inputPath: string,
    public readonly workspaceRoot: string,
    public readonly currentCwd: string
  ) {
    super(
      `Path outside workspace is not allowed: ${inputPath}\n` +
        `  workspace: ${workspaceRoot}\n` +
        `  cwd: ${currentCwd}\n` +
        `  Use /cd <folder> or start with: npm run dev -- --cwd <folder>`
    );
    this.name = 'PathOutsideWorkspaceError';
  }
}

function isPathInsideWorkspace(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function getDisplayCwd(): string {
  const home = homedir().replace(/\\/g, '/');
  const cwd = currentCwd.replace(/\\/g, '/');

  if (cwd === home) {
    return '~';
  }

  if (cwd.startsWith(home + '/')) {
    return '~/' + cwd.slice(home.length + 1);
  }

  return cwd;
}

function resolveTarget(target: string): string {
  if (target === '~') {
    return homedir();
  }

  if (target.startsWith('~/') || target.startsWith('~\\')) {
    return resolve(homedir(), target.slice(2));
  }

  if (process.platform === 'win32' && /^[a-zA-Z]:$/.test(target)) {
    return resolve(currentCwd, target + '\\');
  }

  return resolve(currentCwd, target);
}
