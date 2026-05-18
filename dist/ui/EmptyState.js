import { jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { t } from '../i18n.js';
export function EmptyState({ theme }) {
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Text, { color: theme.accent, children: ["\u25C6 ", t('ai_ready')] }), _jsxs(Text, { color: theme.muted, children: ["  ", t('empty_hint_1')] }), _jsxs(Text, { color: theme.muted, children: ["  ", t('empty_hint_2')] }), _jsxs(Text, { color: theme.muted, children: ["  ", t('empty_hint_3')] }), _jsxs(Text, { color: theme.muted, children: ["  ", t('empty_hint_4')] })] }));
}
