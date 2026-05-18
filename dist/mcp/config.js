import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getCwd } from '../state.js';
import { isValidMcpServerName } from './names.js';
export function getMcpConfigPaths() {
    return {
        workspace: resolve(getCwd(), '.lunami', 'mcp.json'),
        global: resolve(homedir(), '.lunami', 'mcp.json')
    };
}
export async function readMcpConfigFile(path) {
    try {
        const raw = await readFile(path, 'utf8');
        return parseMcpConfigJson(raw, path);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
export function parseMcpConfigJson(raw, sourceLabel = 'mcp.json') {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`Invalid JSON in ${sourceLabel}.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Invalid MCP config in ${sourceLabel}: expected an object.`);
    }
    const servers = parsed.mcpServers;
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
        throw new Error(`Invalid MCP config in ${sourceLabel}: "mcpServers" object is required.`);
    }
    const mcpServers = {};
    for (const [name, value] of Object.entries(servers)) {
        if (!isValidMcpServerName(name)) {
            throw new Error(`Invalid MCP server name "${name}" in ${sourceLabel}.`);
        }
        mcpServers[name] = normalizeServerConfig(value, name, sourceLabel);
    }
    return { mcpServers };
}
export function mergeMcpConfigs(globalConfig, workspaceConfig) {
    return {
        mcpServers: {
            ...(globalConfig?.mcpServers ?? {}),
            ...(workspaceConfig?.mcpServers ?? {})
        }
    };
}
export async function loadMergedMcpConfig() {
    const paths = getMcpConfigPaths();
    const [globalConfig, workspaceConfig] = await Promise.all([
        readMcpConfigFile(paths.global),
        readMcpConfigFile(paths.workspace)
    ]);
    return {
        config: mergeMcpConfigs(globalConfig, workspaceConfig),
        paths,
        loadedFrom: {
            global: globalConfig !== null,
            workspace: workspaceConfig !== null
        }
    };
}
function normalizeServerConfig(value, name, sourceLabel) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: expected an object.`);
    }
    const record = value;
    const command = record.command;
    if (typeof command !== 'string' || !command.trim()) {
        throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: "command" must be a non-empty string.`);
    }
    const args = record.args;
    if (args !== undefined) {
        if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) {
            throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: "args" must be an array of strings.`);
        }
    }
    const env = record.env;
    if (env !== undefined) {
        if (!env || typeof env !== 'object' || Array.isArray(env)) {
            throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: "env" must be an object of strings.`);
        }
        for (const [key, envValue] of Object.entries(env)) {
            if (typeof envValue !== 'string') {
                throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: env.${key} must be a string.`);
            }
        }
    }
    const cwd = record.cwd;
    if (cwd !== undefined && typeof cwd !== 'string') {
        throw new Error(`Invalid MCP server "${name}" in ${sourceLabel}: "cwd" must be a string.`);
    }
    return {
        command: command.trim(),
        ...(args ? { args } : {}),
        ...(env ? { env: env } : {}),
        ...(cwd ? { cwd } : {})
    };
}
