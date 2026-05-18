import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { t } from '../i18n.js';
export const apiPresets = [
    { name: 'OpenAI', url: 'https://api.openai.com/v1', needsCustomUrl: false },
    { name: 'Groq', url: 'https://api.groq.com/openai/v1', needsCustomUrl: false },
    { name: 'Anthropic', url: 'https://api.anthropic.com', needsCustomUrl: false },
    { name: 'OmniRoute', url: '', needsCustomUrl: true },
    { name: 'Ollama', url: 'http://localhost:11434/v1', needsCustomUrl: false },
    { get name() { return t('api_preset_custom'); }, url: '', needsCustomUrl: true }
];
export function ApiPicker({ phase, selectedIndex, endpoint, apiKey, activeField, currentEndpoint, setupMode = false, theme }) {
    if (phase === 'input') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: theme.muted, children: t('api_endpoint') }), _jsxs(Text, { color: activeField === 'endpoint' ? theme.modalTitle : theme.assistant, bold: activeField === 'endpoint', children: ['  > ', endpoint, activeField === 'endpoint' ? '_' : ''] }), _jsx(Text, { children: " " }), _jsx(Text, { color: theme.muted, children: t('api_key') }), _jsxs(Text, { color: activeField === 'key' ? theme.modalTitle : theme.assistant, bold: activeField === 'key', children: ['  > ', maskKey(apiKey), activeField === 'key' ? '_' : ''] }), _jsx(Text, { children: " " }), _jsx(Text, { color: theme.muted, children: t('api_hint_input') })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [setupMode ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.accent, children: t('api_setup_intro') }), _jsx(Text, { color: theme.muted, children: t('api_setup_hint') }), _jsx(Text, { children: " " })] })) : (_jsx(Text, { color: theme.muted, children: t('api_current', currentEndpoint || t('api_not_set')) })), _jsx(Text, { children: " " }), _jsx(Text, { color: theme.muted, children: t('api_quick_select') }), apiPresets.map((preset, index) => {
                const sel = index === selectedIndex;
                const desc = preset.needsCustomUrl ? t('api_manual') : preset.url.replace('https://', '');
                return (_jsxs(Text, { color: sel ? theme.modalTitle : theme.assistant, bold: sel, children: ['  ', sel ? '❯ ' : '  ', preset.name.padEnd(16), desc] }, preset.name));
            }), _jsx(Text, { children: " " }), _jsxs(Text, { color: theme.muted, children: ["  ", t('nav_hint')] })] }));
}
function maskKey(key) {
    if (key.length <= 4) {
        return key;
    }
    return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 4, 32))}`;
}
