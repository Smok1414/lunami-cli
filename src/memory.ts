import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, relative, resolve} from 'node:path';
import type {ChatCompletionMessageParam} from 'openai/resources/chat/completions';
import { t } from './i18n.js';
import { resolveThemeName } from './ui/theme.js';
import { getWorkspaceRoot } from './state.js';

export type {ThemeName} from './ui/theme.js';
import type {ThemeName} from './ui/theme.js';

export type StoredUiMessage = {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
  timestamp: string;
};

export type MemoryState = {
  version: 1;
  sessionName: string;
  updatedAt: string;
  modelLabel: string;
  themeName: ThemeName;
  tokenCount: number;
  promptHistory: string[];
  history: ChatCompletionMessageParam[];
  uiMessages: StoredUiMessage[];
};

export function getLunamiDirectory(): string { return resolve(getWorkspaceRoot(), '.lunami'); }
export function getSessionsDirectory(): string { return resolve(getLunamiDirectory(), 'sessions'); }
export function getCurrentSessionPath(): string { return resolve(getLunamiDirectory(), 'current-session.txt'); }
export function getLegacyMemoryPath(): string { return resolve(getLunamiDirectory(), 'memory.json'); }
export const defaultSessionName = 'default';

export function createEmptyMemory(modelLabel = 'sonnet-4.5', sessionName = defaultSessionName): MemoryState {
  validateSessionName(sessionName);

  return {
    version: 1,
    sessionName,
    updatedAt: new Date().toISOString(),
    modelLabel,
    themeName: 'midnight',
    tokenCount: 0,
    promptHistory: [],
    history: [],
    uiMessages: []
  };
}

export async function loadMemory(modelLabel = 'sonnet-4.5', sessionName?: string): Promise<MemoryState> {
  const activeSessionName = sessionName ?? await loadCurrentSessionName();

  try {
    const raw = await readFile(getSessionPath(activeSessionName), 'utf8');
    return parseMemory(raw, modelLabel, activeSessionName);
  } catch {
    if (activeSessionName === defaultSessionName) {
      const migratedMemory = await tryLoadLegacyMemory(modelLabel);

      if (migratedMemory) {
        await saveMemory(migratedMemory);
        return migratedMemory;
      }
    }

    return createEmptyMemory(modelLabel, activeSessionName);
  }
}

export async function saveMemory(state: MemoryState): Promise<void> {
  validateSessionName(state.sessionName);

  const nextState: MemoryState = {
    ...state,
    updatedAt: new Date().toISOString()
  };

  await mkdir(getSessionsDirectory(), {recursive: true});
  await writeFile(getSessionPath(state.sessionName), `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  await setCurrentSessionName(state.sessionName);
}

export async function clearMemory(sessionName?: string): Promise<void> {
  const activeSessionName = sessionName ?? await loadCurrentSessionName();

  validateSessionName(activeSessionName);
  await rm(getSessionPath(activeSessionName), {force: true});
}

export async function exportMemory(state: MemoryState): Promise<{path: string}> {
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportPath = resolve(getLunamiDirectory(), `export-${state.sessionName}-${safeTimestamp}.json`);

  await mkdir(dirname(exportPath), {recursive: true});
  await writeFile(exportPath, `${JSON.stringify({...state, updatedAt: new Date().toISOString()}, null, 2)}\n`, 'utf8');

  return {
    path: relative(process.cwd(), exportPath)
  };
}

export async function loadCurrentSessionName(): Promise<string> {
  if (process.env.LUNAMI_SESSION) {
    return process.env.LUNAMI_SESSION;
  }

  try {
    const name = (await readFile(getCurrentSessionPath(), 'utf8')).trim();
    validateSessionName(name);
    return name;
  } catch {
    return defaultSessionName;
  }
}

export async function setCurrentSessionName(name: string): Promise<void> {
  validateSessionName(name);
  await mkdir(getLunamiDirectory(), {recursive: true});
  await writeFile(getCurrentSessionPath(), `${name}\n`, 'utf8');
}

export async function listSessions(): Promise<string[]> {
  try {
    const entries = await readdir(getSessionsDirectory(), {withFileTypes: true});
    const sessions = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -'.json'.length))
      .filter(isValidSessionName)
      .sort((left, right) => left.localeCompare(right));

    return sessions.length > 0 ? sessions : [defaultSessionName];
  } catch {
    return [defaultSessionName];
  }
}

export async function createSession(name: string, modelLabel = 'sonnet-4.5'): Promise<MemoryState> {
  validateSessionName(name);

  const sessionPath = getSessionPath(name);

  try {
    await readFile(sessionPath, 'utf8');
    throw new Error(t('err_session_exists', name));
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const memory = createEmptyMemory(modelLabel, name);
  await saveMemory(memory);
  return memory;
}

export async function deleteSession(name: string): Promise<void> {
  validateSessionName(name);
  await rm(getSessionPath(name), {force: true});
}

export async function sessionExists(name: string): Promise<boolean> {
  validateSessionName(name);

  try {
    await readFile(getSessionPath(name), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function getSessionPath(name: string): string {
  validateSessionName(name);
  return resolve(getSessionsDirectory(), `${name}.json`);
}

function parseMemory(raw: string, modelLabel: string, sessionName: string): MemoryState {
  const parsed = JSON.parse(raw) as Partial<MemoryState>;

  return {
    ...createEmptyMemory(modelLabel, sessionName),
    ...parsed,
    version: 1,
    sessionName,
    modelLabel: parsed.modelLabel ?? modelLabel,
    themeName: resolveThemeName(parsed.themeName),
    tokenCount: typeof parsed.tokenCount === 'number' ? parsed.tokenCount : 0,
    promptHistory: Array.isArray(parsed.promptHistory) ? parsed.promptHistory.filter(isString) : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
    uiMessages: Array.isArray(parsed.uiMessages) ? parsed.uiMessages.filter(isStoredUiMessage) : []
  };
}

async function tryLoadLegacyMemory(modelLabel: string): Promise<MemoryState | null> {
  try {
    const raw = await readFile(getLegacyMemoryPath(), 'utf8');
    return parseMemory(raw, modelLabel, defaultSessionName);
  } catch {
    return null;
  }
}

function validateSessionName(name: string): void {
  if (!isValidSessionName(name)) {
    throw new Error(t('err_session_validation'));
  }
}

function isValidSessionName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT');
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStoredUiMessage(value: unknown): value is StoredUiMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<StoredUiMessage>;

  return (
    typeof message.id === 'string' &&
    ['user', 'assistant', 'tool', 'error'].includes(message.kind ?? '') &&
    typeof message.text === 'string' &&
    typeof message.timestamp === 'string'
  );
}
