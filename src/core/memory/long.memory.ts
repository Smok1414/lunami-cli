// File: src/core/memory/long.memory.ts

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getWorkspaceRoot } from '../../state.js';
import { t } from '../../i18n.js';
import { resolveThemeName, type ThemeName } from '../../ui/theme.js';

export const defaultSessionName = 'default';

export interface StoredUiMessage {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
  timestamp: string;
}

export interface MemoryState {
  version: 1;
  sessionName: string;
  updatedAt: string;
  modelLabel: string;
  themeName: ThemeName;
  tokenCount: number;
  promptHistory: string[];
  history: ChatCompletionMessageParam[];
  uiMessages: StoredUiMessage[];
}

export class LongMemory {
  public static defaultSessionName = 'default';

  public getLunamiDirectory(): string {
    return resolve(getWorkspaceRoot(), '.lunami');
  }

  public getSessionsDirectory(): string {
    return resolve(this.getLunamiDirectory(), 'sessions');
  }

  public getCurrentSessionPath(): string {
    return resolve(this.getLunamiDirectory(), 'current-session.txt');
  }

  public getLegacyMemoryPath(): string {
    return resolve(this.getLunamiDirectory(), 'memory.json');
  }

  public createEmptyMemory(modelLabel = 'sonnet-4.5', sessionName = LongMemory.defaultSessionName): MemoryState {
    this.validateSessionName(sessionName);

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

  public async loadMemory(modelLabel = 'sonnet-4.5', sessionName?: string): Promise<MemoryState> {
    const activeSessionName = sessionName ?? (await this.loadCurrentSessionName());

    try {
      const raw = await readFile(this.getSessionPath(activeSessionName), 'utf8');
      return this.parseMemory(raw, modelLabel, activeSessionName);
    } catch {
      if (activeSessionName === LongMemory.defaultSessionName) {
        const migratedMemory = await this.tryLoadLegacyMemory(modelLabel);

        if (migratedMemory) {
          await this.saveMemory(migratedMemory);
          return migratedMemory;
        }
      }

      return this.createEmptyMemory(modelLabel, activeSessionName);
    }
  }

  public async saveMemory(state: MemoryState): Promise<void> {
    this.validateSessionName(state.sessionName);

    const nextState: MemoryState = {
      ...state,
      updatedAt: new Date().toISOString()
    };

    await mkdir(this.getSessionsDirectory(), { recursive: true });
    await writeFile(
      this.getSessionPath(state.sessionName),
      `${JSON.stringify(nextState, null, 2)}\n`,
      'utf8'
    );
    await this.setCurrentSessionName(state.sessionName);
  }

  public async clearMemory(sessionName?: string): Promise<void> {
    const activeSessionName = sessionName ?? (await this.loadCurrentSessionName());

    this.validateSessionName(activeSessionName);
    await rm(this.getSessionPath(activeSessionName), { force: true });
  }

  public async exportMemory(state: MemoryState): Promise<{ path: string }> {
    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = resolve(
      this.getLunamiDirectory(),
      `export-${state.sessionName}-${safeTimestamp}.json`
    );

    await mkdir(dirname(exportPath), { recursive: true });
    await writeFile(
      exportPath,
      `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8'
    );

    return {
      path: relative(process.cwd(), exportPath)
    };
  }

  public async loadCurrentSessionName(): Promise<string> {
    if (process.env.LUNAMI_SESSION) {
      return process.env.LUNAMI_SESSION;
    }

    try {
      const name = (await readFile(this.getCurrentSessionPath(), 'utf8')).trim();
      this.validateSessionName(name);
      return name;
    } catch {
      return LongMemory.defaultSessionName;
    }
  }

  public async setCurrentSessionName(name: string): Promise<void> {
    this.validateSessionName(name);
    await mkdir(this.getLunamiDirectory(), { recursive: true });
    await writeFile(this.getCurrentSessionPath(), `${name}\n`, 'utf8');
  }

  public async listSessions(): Promise<string[]> {
    try {
      const entries = await readdir(this.getSessionsDirectory(), { withFileTypes: true });
      const sessions = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name.slice(0, -'.json'.length))
        .filter((name) => this.isValidSessionName(name))
        .sort((left, right) => left.localeCompare(right));

      return sessions.length > 0 ? sessions : [LongMemory.defaultSessionName];
    } catch {
      return [LongMemory.defaultSessionName];
    }
  }

  public async createSession(name: string, modelLabel = 'sonnet-4.5'): Promise<MemoryState> {
    this.validateSessionName(name);

    const sessionPath = this.getSessionPath(name);

    try {
      await readFile(sessionPath, 'utf8');
      throw new Error(t('err_session_exists', name));
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }

    const memory = this.createEmptyMemory(modelLabel, name);
    await this.saveMemory(memory);
    return memory;
  }

  public async deleteSession(name: string): Promise<void> {
    this.validateSessionName(name);
    await rm(this.getSessionPath(name), { force: true });
  }

  public async sessionExists(name: string): Promise<boolean> {
    this.validateSessionName(name);

    try {
      await readFile(this.getSessionPath(name), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  private getSessionPath(name: string): string {
    this.validateSessionName(name);
    return resolve(this.getSessionsDirectory(), `${name}.json`);
  }

  private parseMemory(raw: string, modelLabel: string, sessionName: string): MemoryState {
    const parsed = JSON.parse(raw) as Partial<MemoryState>;

    return {
      ...this.createEmptyMemory(modelLabel, sessionName),
      ...parsed,
      version: 1,
      sessionName,
      modelLabel: parsed.modelLabel ?? modelLabel,
      themeName: resolveThemeName(parsed.themeName),
      tokenCount: typeof parsed.tokenCount === 'number' ? parsed.tokenCount : 0,
      promptHistory: Array.isArray(parsed.promptHistory) ? parsed.promptHistory.filter(this.isString) : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      uiMessages: Array.isArray(parsed.uiMessages) ? parsed.uiMessages.filter(this.isStoredUiMessage) : []
    };
  }

  private async tryLoadLegacyMemory(modelLabel: string): Promise<MemoryState | null> {
    try {
      const raw = await readFile(this.getLegacyMemoryPath(), 'utf8');
      return this.parseMemory(raw, modelLabel, LongMemory.defaultSessionName);
    } catch {
      return null;
    }
  }

  private validateSessionName(name: string): void {
    if (!this.isValidSessionName(name)) {
      throw new Error(t('err_session_validation'));
    }
  }

  private isValidSessionName(name: string): boolean {
    return /^[a-zA-Z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
  }

  private isNotFoundError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT');
  }

  private isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  private isStoredUiMessage(value: unknown): value is StoredUiMessage {
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
}
