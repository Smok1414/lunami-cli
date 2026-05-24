import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { modeAccent } from '../theme.js';
import { t } from '../../i18n.js';
/** Модель закреплена над полем ввода — не уезжает с чатом. */
export function ModelBar({ modelLabel, agentMode, theme }) {
    const accent = modeAccent(theme, agentMode);
    return (_jsx(Box, { flexShrink: 0, marginBottom: 1, children: _jsxs(Text, { children: [_jsxs(Text, { color: theme.muted, children: [t('header_model'), ": "] }), _jsx(Text, { color: accent, bold: true, children: modelLabel || t('header_model_unknown') }), _jsx(Text, { color: theme.muted, children: " \u00B7 " }), _jsx(Text, { color: accent, bold: true, children: agentMode.toUpperCase() })] }) }));
}
