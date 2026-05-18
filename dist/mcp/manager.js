import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { t } from '../i18n.js';
import { getCwd, getDisplayCwd } from '../state.js';
import { loadMergedMcpConfig } from './config.js';
import { namespaceMcpTool, parseMcpToolName } from './names.js';
const CONNECT_TIMEOUT_MS = 30_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;
let managerInstance = null;
export function getMcpManager() {
    if (!managerInstance) {
        managerInstance = new McpManager();
    }
    return managerInstance;
}
export function resetMcpManagerForTests() {
    managerInstance = null;
}
export class McpManager {
    config = { mcpServers: {} };
    configPaths = { workspace: '', global: '' };
    loadedFrom = { workspace: false, global: false };
    servers = new Map();
    initialized = false;
    initPromise = null;
    async ensureReady() {
        if (this.initialized) {
            return;
        }
        if (!this.initPromise) {
            this.initPromise = this.initialize();
        }
        await this.initPromise;
    }
    async reload() {
        await this.shutdown();
        this.initialized = false;
        this.initPromise = null;
        await this.ensureReady();
        return this.formatStatus();
    }
    async getLlmTools() {
        await this.ensureReady();
        const llmTools = [];
        for (const server of this.servers.values()) {
            if (server.status !== 'connected') {
                continue;
            }
            for (const tool of server.tools) {
                llmTools.push({
                    type: 'function',
                    function: {
                        name: namespaceMcpTool(server.name, tool.name),
                        description: tool.description ?? `MCP tool ${tool.name} from server ${server.name}`,
                        parameters: normalizeInputSchema(tool.inputSchema)
                    }
                });
            }
        }
        return llmTools;
    }
    async callTool(namespacedName, args) {
        await this.ensureReady();
        const parsed = parseMcpToolName(namespacedName);
        if (!parsed) {
            throw new Error(`Invalid MCP tool name: ${namespacedName}`);
        }
        const server = this.servers.get(parsed.serverName);
        if (!server || server.status !== 'connected' || !server.client) {
            const message = server?.error ?? t('mcp_server_not_connected', parsed.serverName);
            const payload = JSON.stringify({ ok: false, error: message });
            return {
                content: payload,
                summary: `error: ${message}`
            };
        }
        try {
            const result = await withTimeout(server.client.callTool({ name: parsed.toolName, arguments: args }), TOOL_CALL_TIMEOUT_MS, t('mcp_tool_timeout', namespacedName));
            const text = formatToolContent(result.content);
            const payload = JSON.stringify({
                ok: !result.isError,
                server: parsed.serverName,
                tool: parsed.toolName,
                content: text
            });
            return {
                content: payload,
                summary: result.isError ? `error: ${text}` : `${namespacedName} ok`
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            server.status = 'error';
            server.error = message;
            const payload = JSON.stringify({ ok: false, error: message });
            return {
                content: payload,
                summary: `error: ${message}`
            };
        }
    }
    async getStatusReport() {
        await this.ensureReady();
        return this.formatStatus();
    }
    formatStatus() {
        const lines = [t('mcp_status_title')];
        lines.push(t('mcp_config_paths', this.configPaths.workspace, this.configPaths.global));
        lines.push(t('mcp_config_loaded', this.loadedFrom.workspace ? 'yes' : 'no', this.loadedFrom.global ? 'yes' : 'no'));
        const serverNames = Object.keys(this.config.mcpServers);
        if (serverNames.length === 0) {
            lines.push(t('mcp_cwd', getDisplayCwd()));
            lines.push(t('mcp_no_servers'));
            if (!this.loadedFrom.workspace && !this.loadedFrom.global) {
                lines.push(t('mcp_config_missing_hint', this.configPaths.workspace));
            }
            return lines.join('\n');
        }
        for (const name of serverNames.sort()) {
            const runtime = this.servers.get(name);
            const status = runtime?.status ?? 'disconnected';
            const statusLabel = t(`mcp_status_${status}`);
            const errorSuffix = runtime?.error ? ` — ${runtime.error}` : '';
            lines.push(`\n${name} · ${statusLabel}${errorSuffix}`);
            if (runtime && runtime.tools.length > 0) {
                for (const tool of runtime.tools) {
                    lines.push(`  ${namespaceMcpTool(name, tool.name)}`);
                }
            }
            else if (status === 'connected') {
                lines.push(`  ${t('mcp_no_tools')}`);
            }
        }
        lines.push(`\n${t('mcp_reload_hint')}`);
        return lines.join('\n');
    }
    async initialize() {
        const loaded = await loadMergedMcpConfig();
        this.config = loaded.config;
        this.configPaths = loaded.paths;
        this.loadedFrom = loaded.loadedFrom;
        this.servers.clear();
        for (const [name, config] of Object.entries(this.config.mcpServers)) {
            this.servers.set(name, {
                name,
                config,
                status: 'disconnected',
                tools: []
            });
        }
        await Promise.all([...this.servers.keys()].map((name) => this.connectServer(name).catch(() => undefined)));
        this.initialized = true;
    }
    async connectServer(name) {
        const server = this.servers.get(name);
        if (!server) {
            return;
        }
        server.status = 'connecting';
        server.error = undefined;
        server.tools = [];
        const transport = new StdioClientTransport({
            command: server.config.command,
            args: server.config.args ?? [],
            env: server.config.env,
            cwd: server.config.cwd ?? getCwd(),
            stderr: 'pipe'
        });
        const client = new Client({ name: 'lunami-cli', version: '0.1.0' }, { capabilities: {} });
        try {
            await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, t('mcp_connect_timeout', name));
            const listed = await withTimeout(client.listTools(), CONNECT_TIMEOUT_MS, t('mcp_list_timeout', name));
            server.client = client;
            server.transport = transport;
            server.tools = listed.tools ?? [];
            server.status = 'connected';
        }
        catch (error) {
            server.status = 'error';
            server.error = error instanceof Error ? error.message : String(error);
            try {
                await client.close();
            }
            catch { }
            try {
                await transport.close();
            }
            catch { }
        }
    }
    async shutdown() {
        for (const server of this.servers.values()) {
            try {
                await server.client?.close();
            }
            catch { }
            try {
                await server.transport?.close();
            }
            catch { }
            server.client = undefined;
            server.transport = undefined;
            server.tools = [];
            server.status = 'disconnected';
            server.error = undefined;
        }
        this.servers.clear();
    }
}
function normalizeInputSchema(schema) {
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
        return schema;
    }
    return {
        type: 'object',
        properties: {}
    };
}
function formatToolContent(content) {
    if (!Array.isArray(content)) {
        return typeof content === 'string' ? content : JSON.stringify(content ?? null);
    }
    return content
        .map((block) => {
        if (block && typeof block === 'object' && 'type' in block) {
            const typed = block;
            if (typed.type === 'text' && typeof typed.text === 'string') {
                return typed.text;
            }
        }
        return JSON.stringify(block);
    })
        .filter(Boolean)
        .join('\n');
}
async function withTimeout(promise, timeoutMs, message) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(message)), timeoutMs);
            })
        ]);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
