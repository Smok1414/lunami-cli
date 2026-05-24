import {config} from 'dotenv';
import {readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hasConfiguredApi, isLocalApiBaseUrl, readPrimaryEnvContent, writePrimaryEnvContent} from './envConfig.js';
import {upsertEnvLine} from './utils.js';

export {hasConfiguredApi} from './envConfig.js';
import type {ChatCompletionMessageParam, ChatCompletionTool} from 'openai/resources/chat/completions';
import {AnthropicProvider} from './providers/anthropic.js';
import {OllamaProvider} from './providers/ollama.js';
import {OpenAIProvider} from './providers/openai.js';
import {LlmRouter, type TaskIntent} from './llm/router.js';
import type { BuiltinToolName } from './toolNames.js';

const localConfig = config();
if (localConfig.parsed) {
  for (const [key, value] of Object.entries(localConfig.parsed)) {
    if (!value || !value.trim()) {
      delete process.env[key];
    }
  }
}

const globalConfig = config({path: resolve(homedir(), '.lunami', '.env'), override: false});
if (globalConfig.parsed) {
  for (const [key, value] of Object.entries(globalConfig.parsed)) {
    if (value && value.trim()) {
      const currentVal = process.env[key];
      if (!currentVal || !currentVal.trim()) {
        process.env[key] = value;
      }
    }
  }
}

/** Built-in LUNAMI tools (MCP tools use `mcp__<server>__<tool>` names). */
export type LlmToolName = BuiltinToolName;
export type LLMMessage = ChatCompletionMessageParam;
export type LLMTool = ChatCompletionTool;
export type LLMProviderName = 'openai' | 'anthropic' | 'ollama';

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMResponse = {
  content: string;
  toolCalls: LlmToolCall[];
  message: LLMMessage;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export interface LLMProvider {
  chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse>;
  streamChat?(
    messages: LLMMessage[],
    tools: LLMTool[],
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<LLMResponse>;
}

export type LlmStreamOptions = {
  onTextDelta?: (delta: string) => void | Promise<void>;
  intent?: TaskIntent;
};

export type ProviderInfo = {
  provider: LLMProviderName;
  model: string;
  baseUrl?: string;
};

export type ProviderRuntimeConfig = ProviderInfo & {
  apiKey?: string;
};

export const tools: LLMTool[] = [
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
      name: 'patchFile',
      description: 'Patch a file by replacing specific line ranges with new content. Useful for precise and partial edits.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute path to the file.'
          },
          patches: {
            type: 'array',
            description: 'List of line range replacements to apply.',
            items: {
              type: 'object',
              properties: {
                startLine: {
                  type: 'number',
                  description: 'The 1-based start line number (inclusive).'
                },
                endLine: {
                  type: 'number',
                  description: 'The 1-based end line number (inclusive).'
                },
                replace: {
                  type: 'string',
                  description: 'The replacement text.'
                }
              },
              required: ['startLine', 'endLine', 'replace']
            }
          }
        },
        required: ['path', 'patches']
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
When calling writeFile, always provide both string arguments exactly as separate fields: path and content. If a writeFile tool result says the call is retryable or missing path/content, immediately retry the same file write with {"path":"relative/file.ext","content":"complete file contents"}.
Do not print internal workflow scaffolding such as PLAN/ACT/REFLECT unless the user explicitly asks for that format.
In AUTO or YOLO mode, when the user asks to create, build, scaffold, fix, inspect, or verify something, use tools and make reasonable assumptions for small projects instead of only asking clarifying questions.
Keep final answers concise and useful.
Do not use markdown formatting like **bold** or *italic* — this is a plain terminal, not a browser.
The writable workspace is the current project directory (cwd). To work in another folder, tell the user to run /cd <path> or restart with --cwd. Do not use shell cd for changing workspace — use relative paths for files (e.g. index.html) after /cd.`;

export function getProviderInfo(): ProviderInfo {
  const {provider, model, baseUrl} = getProviderRuntimeConfig();

  return {
    provider,
    model,
    ...(baseUrl ? {baseUrl} : {})
  };
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
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

export function getModelLabel(): string {
  const model = getProviderInfo().model;

  return model
    .split('/').pop()!
    .replace(/^claude-/, '')
    .replace(/[-_](\d)(\d)$/, '-$1.$2');
}

async function withIntentRouting<T>(
  intent: TaskIntent | undefined,
  operation: (provider: LLMProvider) => Promise<T>
): Promise<T> {
  if (!intent || process.env.LLM_MODEL) {
    return operation(createProvider());
  }

  const decision = new LlmRouter().decide(intent);
  if (!decision.model) {
    return operation(createProvider());
  }

  const previousModel = process.env.LLM_MODEL;

  try {
    process.env.LLM_MODEL = decision.model;
    return await operation(createProvider());
  } finally {
    if (previousModel === undefined) {
      delete process.env.LLM_MODEL;
    } else {
      process.env.LLM_MODEL = previousModel;
    }
  }
}

export async function complete(
  messages: LLMMessage[],
  requestTools: LLMTool[] = tools,
  intent?: TaskIntent
): Promise<LLMResponse> {
  return withIntentRouting(intent, (provider) => provider.chat(messages, getToolsForIntent(requestTools, intent)));
}

export async function streamComplete(
  messages: LLMMessage[],
  options: LlmStreamOptions = {},
  requestTools: LLMTool[] = tools
): Promise<LLMResponse> {
  return withIntentRouting(options.intent, async (provider) => {
    const routedTools = getToolsForIntent(requestTools, options.intent);

    if (options.onTextDelta && provider.streamChat) {
      return provider.streamChat(messages, routedTools, options.onTextDelta);
    }

    const response = await provider.chat(messages, routedTools);

    if (options.onTextDelta && response.content) {
      for (const character of Array.from(response.content)) {
        await options.onTextDelta(character);
      }
    }

    return response;
  });
}

function getToolsForIntent(requestTools: LLMTool[], intent?: TaskIntent): LLMTool[] {
  if (intent === 'summary' || intent === 'chat_format' || intent === 'explanation') {
    return [];
  }

  return requestTools;
}

export function createProvider(): LLMProvider {
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

export function getProviderName(): LLMProviderName {
  const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  if (rawProvider === 'omniroute' || rawProvider === 'openrouter' || rawProvider === 'openai-compatible') {
    return 'openai';
  }

  if (rawProvider === 'openai' || rawProvider === 'anthropic' || rawProvider === 'ollama') {
    return rawProvider;
  }

  throw new Error('LLM_PROVIDER must be one of: openai, anthropic, ollama.');
}

function getModelForProvider(provider: LLMProviderName): string {
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

function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.OMNIROUTE_API_KEY;
}

function getOpenAIBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL;
}

function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

export async function changeModel(model: string): Promise<void> {
  process.env.LLM_MODEL = model;

  let content = await readPrimaryEnvContent();
  content = upsertEnvLine(content, 'LLM_MODEL', model);
  await writePrimaryEnvContent(content);
}

export function getCurrentBaseUrl(): string {
  return process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL || '';
}

export async function preflightConfiguredApi(): Promise<{ok: boolean; error?: string}> {
  const runtime = getProviderRuntimeConfig();

  if (runtime.provider === 'ollama') {
    const result = await pingApiConnection(runtime.baseUrl || 'http://localhost:11434', '');
    return result.ok
      ? {ok: true}
      : {ok: false, error: `Ollama endpoint is not reachable: ${result.error || 'network error'}`};
  }

  if (runtime.provider === 'anthropic') {
    if (!runtime.apiKey?.trim()) {
      return {ok: false, error: 'ANTHROPIC_API_KEY is missing. Set it in .env.'};
    }

    return {ok: true};
  }

  if (!runtime.apiKey?.trim()) {
    return {ok: false, error: 'OPENAI_API_KEY is missing. Set it in .env.'};
  }

  if (isLocalApiBaseUrl(runtime.baseUrl)) {
    const result = await pingApiConnection(runtime.baseUrl!, runtime.apiKey);
    return result.ok
      ? {ok: true}
      : {ok: false, error: `Local API endpoint is configured but unreachable: ${runtime.baseUrl} (${result.error || 'network error'})`};
  }

  return {ok: true};
}

export async function changeApi(baseUrl: string, apiKey: string): Promise<void> {
  let provider = 'openai';
  if (baseUrl.includes('anthropic')) provider = 'anthropic';
  else if (baseUrl.includes('11434') || baseUrl.includes('ollama')) provider = 'ollama';

  process.env.LLM_PROVIDER = provider;

  if (provider === 'anthropic') {
    if (apiKey) process.env.ANTHROPIC_API_KEY = apiKey;
  } else if (provider === 'ollama') {
    process.env.OLLAMA_BASE_URL = baseUrl.replace(/\/v1\/?$/, '');
  } else {
    process.env.OPENAI_BASE_URL = baseUrl;
    if (apiKey) process.env.OPENAI_API_KEY = apiKey;
  }

  let content = await readPrimaryEnvContent();

  content = upsertEnvLine(content, 'LLM_PROVIDER', provider);

  if (provider === 'anthropic') {
    if (apiKey) content = upsertEnvLine(content, 'ANTHROPIC_API_KEY', apiKey);
  } else if (provider === 'ollama') {
    content = upsertEnvLine(content, 'OLLAMA_BASE_URL', baseUrl.replace(/\/v1\/?$/, ''));
    content = upsertEnvLine(content, 'LLM_MODEL', process.env.LLM_MODEL || 'llama3.2');
  } else {
    content = upsertEnvLine(content, 'OPENAI_BASE_URL', baseUrl);
    if (apiKey) content = upsertEnvLine(content, 'OPENAI_API_KEY', apiKey);
  }

  await writePrimaryEnvContent(content);
}

export async function pingApiConnection(baseUrl: string, apiKey: string): Promise<{ ok: boolean; ms?: number; providerName?: string; error?: string }> {
  const start = Date.now();
  try {
    const isAnthropic = baseUrl.includes('anthropic');
    const url = isAnthropic
      ? `${baseUrl.replace(/\/+$/, '')}/v1/models`
      : `${baseUrl.replace(/\/+$/, '')}/models`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      if (isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
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
    if (baseUrl.includes('anthropic')) providerName = 'Anthropic';
    else if (baseUrl.includes('groq')) providerName = 'Groq';
    else if (baseUrl.includes('omniroute')) providerName = 'OmniRoute';
    else if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) providerName = 'Локальный API';
    
    return { ok: true, ms, providerName };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: err.message || 'network error' };
  }
}
