import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { t } from '../../i18n.js';
export function EmptyState({ theme, height = 10, width = 60 }) {
    const safeHeight = Math.max(8, height);
    const safeWidth = Math.max(32, width);
    return (_jsxs(Box, { flexDirection: "column", height: safeHeight, width: safeWidth, justifyContent: "center", alignItems: "center", children: [_jsx(Text, { color: theme.title, bold: true, children: "LUNAMI CLI" }), _jsx(Text, { color: theme.accent, children: t('ai_ready') }), _jsx(Box, { height: 1 }), _jsx(Text, { color: theme.muted, children: t('empty_hint_1') }), _jsx(Text, { color: theme.muted, children: t('empty_hint_2') }), _jsx(Text, { color: theme.muted, children: t('empty_hint_3') }), _jsx(Text, { color: theme.muted, children: t('empty_hint_4') })] }));
}
