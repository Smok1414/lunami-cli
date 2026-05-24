// File: src/config/models.config.ts
import { getProviderRuntimeConfig } from '../llm/provider.js';
import { t } from '../i18n.js';
export const fallbackGroups = [
    { icon: '🟢', get label() { return t('model_group_openai'); }, models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2'] },
    { icon: '🟠', label: 'Kiro AI', models: ['kr/claude-sonnet-4.5', 'kr/claude-haiku-4.5'] },
    { icon: '🟣', label: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-haiku-4-5'] },
    {
        icon: '🔵',
        label: 'Gemini CLI',
        models: [
            'gemini-cli/gemini-2.5-pro',
            'gemini-cli/gemini-2.5-flash',
            'gemini-cli/gemini-2.0-pro-exp-02-05',
            'gemini-cli/gemini-2.0-flash',
            'gemini-cli/gemini-2.0-flash-lite-preview-02-05',
            'gemini-cli/gemini-1.5-pro'
        ]
    },
    {
        icon: '🚀',
        label: 'Antigravity',
        models: [
            'antigravity/claude-opus-4-6-thinking',
            'antigravity/claude-sonnet-4-6',
            'antigravity/gemini-3-flash',
            'antigravity/gemini-3.1-flash-image',
            'antigravity/gemini-3.1-pro-high',
            'antigravity/gemini-3.1-pro-low',
            'antigravity/gpt-oss-120b-medium'
        ]
    },
    { icon: '🟡', get label() { return t('model_group_groq'); }, models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
    { icon: '⚪', get label() { return t('model_group_ollama'); }, models: ['llama3', 'mistral', 'phi3'] }
];
const dynamicFetchTimeoutMs = 3000;
export function flattenModelGroups(groups) {
    return groups.flatMap((group) => group.models);
}
export function getTotalPickerEntries(groups) {
    return flattenModelGroups(groups).length + 1;
}
export async function fetchDynamicGroups() {
    const { provider, baseUrl, apiKey } = getProviderRuntimeConfig();
    try {
        if (provider === 'anthropic' || !baseUrl) {
            return null;
        }
        const url = provider === 'ollama'
            ? `${trimTrailingSlash(baseUrl)}/api/tags`
            : `${trimTrailingSlash(baseUrl)}/models`;
        const response = await fetch(url, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
            signal: AbortSignal.timeout(dynamicFetchTimeoutMs)
        });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json();
        const models = provider === 'ollama'
            ? parseOllamaModels(payload)
            : parseOpenAiCompatibleModels(payload);
        if (models.length === 0) {
            return null;
        }
        return [{ icon: '🌐', get label() { return t('model_group_available'); }, models }];
    }
    catch {
        return null;
    }
}
function parseOllamaModels(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.models)) {
        return [];
    }
    const items = payload.models;
    return dedupeStrings(items.map((item) => item?.name).filter((item) => typeof item === 'string'));
}
function parseOpenAiCompatibleModels(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
        return [];
    }
    const items = payload.data;
    return dedupeStrings(items.map((item) => item?.id).filter((item) => typeof item === 'string'));
}
function dedupeStrings(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
