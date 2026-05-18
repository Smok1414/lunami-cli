import { config } from 'dotenv';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { readPrimaryEnvContent, writePrimaryEnvContent } from './envConfig.js';
import { upsertEnvLine } from './utils.js';
export { hasConfiguredApi } from './envConfig.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
config();
config({ path: resolve(homedir(), '.lunami', '.env'), override: false });
export const tools = [
    {
        type: 'function',
        function: {
            name: 'readFile',
            description: 'Read a UTF-8 text file from the current project workspace.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative or absolute path to the file.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generateProject',
            description: 'Generate a small working project scaffold in the current workspace using only filesystem writes.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: {
                        type: 'string',
                        description: 'Single folder name for the project. Use letters, numbers, dots, underscores, or dashes.'
                    },
                    type: {
                        type: 'string',
                        enum: ['react', 'node', 'next', 'python'],
                        description: 'Project scaffold type to generate.'
                    }
                },
                required: ['name', 'type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'writeFile',
            description: 'Write UTF-8 text content to a file in the current project workspace. Creates parent folders if needed.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative or absolute path to the file. IMPORTANT: You MUST provide this argument BEFORE content to prevent truncation.'
                    },
                    content: {
                        type: 'string',
                        description: 'Complete file contents.'
                    }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'execCommand',
            description: 'Run a shell command from the current project workspace and return stdout/stderr. WARNING: Do NOT run blocking commands like `npm run dev` or `npm start` that start a server. They will hang and time out, causing the agent to fail. If a dev server is needed, just instruct the user to run it themselves.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    command: {
                        type: 'string',
                        description: 'Command to run.'
                    }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search',
            description: 'Search for a text pattern in project files (ripgrep if available, otherwise Node scan). Returns file:line:content matches.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'Text or substring to search for.'
                    },
                    path: {
                        type: 'string',
                        description: 'Relative directory or file to search in. Default: current workspace (.).'
                    }
                },
                required: ['pattern']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'tree',
            description: 'Show a compact file tree for the current working directory.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    depth: {
                        type: 'number',
                        description: 'Maximum directory depth. Default is 2.'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'gitStatus',
            description: 'Show git status for the current working directory.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'gitDiff',
            description: 'Show git diff for the current working directory.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'gitCommit',
            description: 'Create a git commit with the provided message. Requires user approval before execution.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    message: {
                        type: 'string',
                        description: 'Commit message.'
                    }
                },
                required: ['message']
            }
        }
    }
];
export const systemPrompt = `You are LUNAMI CLI, a precise AI coding agent inside a terminal UI.
Use tools when the user asks you to inspect, create, edit, or run project files.
Use generateProject when the user asks to scaffold a new react, node, next, or python project. The tool creates a subfolder — always tell the user to cd into that folder before npm install or npm run dev (never run npm from the parent directory).
Use tree, gitStatus, and gitDiff to orient yourself before risky changes.
Prefer small, reversible changes and explain the result briefly.
Do not invent tool results. If a file or command is needed, call the matching tool.
Keep final answers concise and useful.
Do not use markdown formatting like **bold** or *italic* — this is a plain terminal, not a browser.
The writable workspace is the current project directory (cwd). To work in another folder, tell the user to run /cd <path> or restart with --cwd. Do not use shell cd for changing workspace — use relative paths for files (e.g. index.html) after /cd.`;
export function getProviderInfo() {
    const { provider, model, baseUrl } = getProviderRuntimeConfig();
    return {
        provider,
        model,
        ...(baseUrl ? { baseUrl } : {})
    };
}
export function getProviderRuntimeConfig() {
    const provider = getProviderName();
    const model = getModelForProvider(provider);
    if (provider === 'openai') {
        return {
            provider,
            model,
            baseUrl: getOpenAIBaseUrl(),
            apiKey: getOpenAIApiKey()
        };
    }
    if (provider === 'ollama') {
        return {
            provider,
            model,
            baseUrl: getOllamaBaseUrl()
        };
    }
    return {
        provider,
        model,
        apiKey: process.env.ANTHROPIC_API_KEY
    };
}
export function getModelLabel() {
    const model = getProviderInfo().model;
    return model
        .split('/').pop()
        .replace(/^claude-/, '')
        .replace(/[-_](\d)(\d)$/, '-$1.$2');
}
export async function complete(messages, requestTools = tools) {
    return createProvider().chat(messages, requestTools);
}
export async function streamComplete(messages, options = {}, requestTools = tools) {
    const provider = createProvider();
    if (options.onTextDelta && 'streamChat' in provider && typeof provider.streamChat === 'function') {
        return provider.streamChat(messages, requestTools, options.onTextDelta);
    }
    const response = await provider.chat(messages, requestTools);
    if (options.onTextDelta && response.content) {
        for (const character of Array.from(response.content)) {
            await options.onTextDelta(character);
        }
    }
    return response;
}
export function createProvider() {
    const provider = getProviderName();
    const model = getModelForProvider(provider);
    if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is missing. Set it in .env.');
        }
        return new AnthropicProvider({
            apiKey,
            model
        });
    }
    if (provider === 'ollama') {
        return new OllamaProvider({
            model,
            baseUrl: getOllamaBaseUrl()
        });
    }
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing. Set it in .env.');
    }
    return new OpenAIProvider({
        apiKey,
        model,
        baseUrl: getOpenAIBaseUrl()
    });
}
export function getProviderName() {
    const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    if (rawProvider === 'omniroute' || rawProvider === 'openrouter' || rawProvider === 'openai-compatible') {
        return 'openai';
    }
    if (rawProvider === 'openai' || rawProvider === 'anthropic' || rawProvider === 'ollama') {
        return rawProvider;
    }
    throw new Error('LLM_PROVIDER must be one of: openai, anthropic, ollama.');
}
function getModelForProvider(provider) {
    if (process.env.LLM_MODEL) {
        return process.env.LLM_MODEL;
    }
    if (provider === 'anthropic') {
        return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
    }
    if (provider === 'ollama') {
        return process.env.OLLAMA_MODEL || 'llama3';
    }
    return process.env.OMNIROUTE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1';
}
function getOpenAIApiKey() {
    return process.env.OPENAI_API_KEY || process.env.OMNIROUTE_API_KEY;
}
function getOpenAIBaseUrl() {
    return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL;
}
function getOllamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}
export async function changeModel(model) {
    process.env.LLM_MODEL = model;
    let content = await readPrimaryEnvContent();
    content = upsertEnvLine(content, 'LLM_MODEL', model);
    await writePrimaryEnvContent(content);
}
export function getCurrentBaseUrl() {
    return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL || '';
}
export async function changeApi(baseUrl, apiKey) {
    let provider = 'openai';
    if (baseUrl.includes('anthropic'))
        provider = 'anthropic';
    else if (baseUrl.includes('11434') || baseUrl.includes('ollama'))
        provider = 'ollama';
    process.env.LLM_PROVIDER = provider;
    if (provider === 'anthropic') {
        if (apiKey)
            process.env.ANTHROPIC_API_KEY = apiKey;
    }
    else if (provider === 'ollama') {
        process.env.OLLAMA_BASE_URL = baseUrl.replace(/\/v1\/?$/, '');
    }
    else {
        process.env.OPENAI_BASE_URL = baseUrl;
        if (apiKey)
            process.env.OPENAI_API_KEY = apiKey;
    }
    let content = await readPrimaryEnvContent();
    content = upsertEnvLine(content, 'LLM_PROVIDER', provider);
    if (provider === 'anthropic') {
        if (apiKey)
            content = upsertEnvLine(content, 'ANTHROPIC_API_KEY', apiKey);
    }
    else if (provider === 'ollama') {
        content = upsertEnvLine(content, 'OLLAMA_BASE_URL', baseUrl.replace(/\/v1\/?$/, ''));
        content = upsertEnvLine(content, 'LLM_MODEL', process.env.LLM_MODEL || 'llama3.2');
    }
    else {
        content = upsertEnvLine(content, 'OPENAI_BASE_URL', baseUrl);
        if (apiKey)
            content = upsertEnvLine(content, 'OPENAI_API_KEY', apiKey);
    }
    await writePrimaryEnvContent(content);
}
export async function pingApiConnection(baseUrl, apiKey) {
    const start = Date.now();
    try {
        const isAnthropic = baseUrl.includes('anthropic');
        const url = isAnthropic
            ? `${baseUrl.replace(/\/+$/, '')}/v1/models`
            : `${baseUrl.replace(/\/+$/, '')}/models`;
        const headers = {};
        if (apiKey) {
            if (isAnthropic) {
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
            }
            else {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
        }
        const response = await fetch(url, {
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return { ok: false, error: 'invalid API key' };
            }
            return { ok: false, error: `${response.status} ${response.statusText}` };
        }
        const ms = Date.now() - start;
        let providerName = 'OpenAI';
        if (baseUrl.includes('anthropic'))
            providerName = 'Anthropic';
        else if (baseUrl.includes('groq'))
            providerName = 'Groq';
        else if (baseUrl.includes('omniroute'))
            providerName = 'OmniRoute';
        else if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))
            providerName = 'Локальный API';
        return { ok: true, ms, providerName };
    }
    catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
            return { ok: false, error: 'timeout' };
        }
        return { ok: false, error: err.message || 'network error' };
    }
}
