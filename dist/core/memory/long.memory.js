// File: src/core/memory/long.memory.ts
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { getWorkspaceRoot } from '../../state.js';
import { t } from '../../i18n.js';
import { resolveThemeName } from '../../ui/theme.js';
export const defaultSessionName = 'default';
export class LongMemory {
    static defaultSessionName = 'default';
    getLunamiDirectory() {
        return resolve(getWorkspaceRoot(), '.lunami');
    }
    getSessionsDirectory() {
        return resolve(this.getLunamiDirectory(), 'sessions');
    }
    getCurrentSessionPath() {
        return resolve(this.getLunamiDirectory(), 'current-session.txt');
    }
    getLegacyMemoryPath() {
        return resolve(this.getLunamiDirectory(), 'memory.json');
    }
    createEmptyMemory(modelLabel = 'sonnet-4.5', sessionName = LongMemory.defaultSessionName) {
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
    async loadMemory(modelLabel = 'sonnet-4.5', sessionName) {
        const activeSessionName = sessionName ?? (await this.loadCurrentSessionName());
        try {
            const raw = await readFile(this.getSessionPath(activeSessionName), 'utf8');
            return this.parseMemory(raw, modelLabel, activeSessionName);
        }
        catch {
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
    async saveMemory(state) {
        this.validateSessionName(state.sessionName);
        const nextState = {
            ...state,
            updatedAt: new Date().toISOString()
        };
        await mkdir(this.getSessionsDirectory(), { recursive: true });
        await writeFile(this.getSessionPath(state.sessionName), `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
        await this.setCurrentSessionName(state.sessionName);
    }
    async clearMemory(sessionName) {
        const activeSessionName = sessionName ?? (await this.loadCurrentSessionName());
        this.validateSessionName(activeSessionName);
        await rm(this.getSessionPath(activeSessionName), { force: true });
    }
    async exportMemory(state) {
        const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportPath = resolve(this.getLunamiDirectory(), `export-${state.sessionName}-${safeTimestamp}.json`);
        await mkdir(dirname(exportPath), { recursive: true });
        await writeFile(exportPath, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
        return {
            path: relative(process.cwd(), exportPath)
        };
    }
    async loadCurrentSessionName() {
        if (process.env.LUNAMI_SESSION) {
            return process.env.LUNAMI_SESSION;
        }
        try {
            const name = (await readFile(this.getCurrentSessionPath(), 'utf8')).trim();
            this.validateSessionName(name);
            return name;
        }
        catch {
            return LongMemory.defaultSessionName;
        }
    }
    async setCurrentSessionName(name) {
        this.validateSessionName(name);
        await mkdir(this.getLunamiDirectory(), { recursive: true });
        await writeFile(this.getCurrentSessionPath(), `${name}\n`, 'utf8');
    }
    async listSessions() {
        try {
            const entries = await readdir(this.getSessionsDirectory(), { withFileTypes: true });
            const sessions = entries
                .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
                .map((entry) => entry.name.slice(0, -'.json'.length))
                .filter((name) => this.isValidSessionName(name))
                .sort((left, right) => left.localeCompare(right));
            return sessions.length > 0 ? sessions : [LongMemory.defaultSessionName];
        }
        catch {
            return [LongMemory.defaultSessionName];
        }
    }
    async createSession(name, modelLabel = 'sonnet-4.5') {
        this.validateSessionName(name);
        const sessionPath = this.getSessionPath(name);
        try {
            await readFile(sessionPath, 'utf8');
            throw new Error(t('err_session_exists', name));
        }
        catch (error) {
            if (!this.isNotFoundError(error)) {
                throw error;
            }
        }
        const memory = this.createEmptyMemory(modelLabel, name);
        await this.saveMemory(memory);
        return memory;
    }
    async deleteSession(name) {
        this.validateSessionName(name);
        await rm(this.getSessionPath(name), { force: true });
    }
    async sessionExists(name) {
        this.validateSessionName(name);
        try {
            await readFile(this.getSessionPath(name), 'utf8');
            return true;
        }
        catch {
            return false;
        }
    }
    getSessionPath(name) {
        this.validateSessionName(name);
        return resolve(this.getSessionsDirectory(), `${name}.json`);
    }
    parseMemory(raw, modelLabel, sessionName) {
        const parsed = JSON.parse(raw);
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
    async tryLoadLegacyMemory(modelLabel) {
        try {
            const raw = await readFile(this.getLegacyMemoryPath(), 'utf8');
            return this.parseMemory(raw, modelLabel, LongMemory.defaultSessionName);
        }
        catch {
            return null;
        }
    }
    validateSessionName(name) {
        if (!this.isValidSessionName(name)) {
            throw new Error(t('err_session_validation'));
        }
    }
    isValidSessionName(name) {
        return /^[a-zA-Z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
    }
    isNotFoundError(error) {
        return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
    }
    isString(value) {
        return typeof value === 'string';
    }
    isStoredUiMessage(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const message = value;
        return (typeof message.id === 'string' &&
            ['user', 'assistant', 'tool', 'error'].includes(message.kind ?? '') &&
            typeof message.text === 'string' &&
            typeof message.timestamp === 'string');
    }
}
