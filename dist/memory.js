import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { t } from './i18n.js';
import { resolveThemeName } from './ui/theme.js';
import { getWorkspaceRoot } from './state.js';
export function getLunamiDirectory() { return resolve(getWorkspaceRoot(), '.lunami'); }
export function getSessionsDirectory() { return resolve(getLunamiDirectory(), 'sessions'); }
export function getCurrentSessionPath() { return resolve(getLunamiDirectory(), 'current-session.txt'); }
export function getLegacyMemoryPath() { return resolve(getLunamiDirectory(), 'memory.json'); }
export const defaultSessionName = 'default';
export function createEmptyMemory(modelLabel = 'sonnet-4.5', sessionName = defaultSessionName) {
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
export async function loadMemory(modelLabel = 'sonnet-4.5', sessionName) {
    const activeSessionName = sessionName ?? await loadCurrentSessionName();
    try {
        const raw = await readFile(getSessionPath(activeSessionName), 'utf8');
        return parseMemory(raw, modelLabel, activeSessionName);
    }
    catch {
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
export async function saveMemory(state) {
    validateSessionName(state.sessionName);
    const nextState = {
        ...state,
        updatedAt: new Date().toISOString()
    };
    await mkdir(getSessionsDirectory(), { recursive: true });
    await writeFile(getSessionPath(state.sessionName), `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    await setCurrentSessionName(state.sessionName);
}
export async function clearMemory(sessionName) {
    const activeSessionName = sessionName ?? await loadCurrentSessionName();
    validateSessionName(activeSessionName);
    await rm(getSessionPath(activeSessionName), { force: true });
}
export async function exportMemory(state) {
    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = resolve(getLunamiDirectory(), `export-${state.sessionName}-${safeTimestamp}.json`);
    await mkdir(dirname(exportPath), { recursive: true });
    await writeFile(exportPath, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
    return {
        path: relative(process.cwd(), exportPath)
    };
}
export async function loadCurrentSessionName() {
    if (process.env.LUNAMI_SESSION) {
        return process.env.LUNAMI_SESSION;
    }
    try {
        const name = (await readFile(getCurrentSessionPath(), 'utf8')).trim();
        validateSessionName(name);
        return name;
    }
    catch {
        return defaultSessionName;
    }
}
export async function setCurrentSessionName(name) {
    validateSessionName(name);
    await mkdir(getLunamiDirectory(), { recursive: true });
    await writeFile(getCurrentSessionPath(), `${name}\n`, 'utf8');
}
export async function listSessions() {
    try {
        const entries = await readdir(getSessionsDirectory(), { withFileTypes: true });
        const sessions = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => entry.name.slice(0, -'.json'.length))
            .filter(isValidSessionName)
            .sort((left, right) => left.localeCompare(right));
        return sessions.length > 0 ? sessions : [defaultSessionName];
    }
    catch {
        return [defaultSessionName];
    }
}
export async function createSession(name, modelLabel = 'sonnet-4.5') {
    validateSessionName(name);
    const sessionPath = getSessionPath(name);
    try {
        await readFile(sessionPath, 'utf8');
        throw new Error(t('err_session_exists', name));
    }
    catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }
    }
    const memory = createEmptyMemory(modelLabel, name);
    await saveMemory(memory);
    return memory;
}
export async function deleteSession(name) {
    validateSessionName(name);
    await rm(getSessionPath(name), { force: true });
}
export async function sessionExists(name) {
    validateSessionName(name);
    try {
        await readFile(getSessionPath(name), 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
function getSessionPath(name) {
    validateSessionName(name);
    return resolve(getSessionsDirectory(), `${name}.json`);
}
function parseMemory(raw, modelLabel, sessionName) {
    const parsed = JSON.parse(raw);
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
async function tryLoadLegacyMemory(modelLabel) {
    try {
        const raw = await readFile(getLegacyMemoryPath(), 'utf8');
        return parseMemory(raw, modelLabel, defaultSessionName);
    }
    catch {
        return null;
    }
}
function validateSessionName(name) {
    if (!isValidSessionName(name)) {
        throw new Error(t('err_session_validation'));
    }
}
function isValidSessionName(name) {
    return /^[a-zA-Z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
}
function isNotFoundError(error) {
    return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
}
function isString(value) {
    return typeof value === 'string';
}
function isStoredUiMessage(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const message = value;
    return (typeof message.id === 'string' &&
        ['user', 'assistant', 'tool', 'error'].includes(message.kind ?? '') &&
        typeof message.text === 'string' &&
        typeof message.timestamp === 'string');
}
