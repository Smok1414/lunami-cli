import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { shortenPath } from '../uiUtils.js';
import { t } from '../../i18n.js';
export function Header({ sessionName, cwdLabel, hasContext, theme, width }) {
    const ctxLabel = hasContext ? t('header_ctx_on') : t('header_ctx_off');
    const ctxColor = hasContext ? theme.ctxOn : theme.ctxOff;
    const shortCwd = shortenPath(cwdLabel, Math.max(24, width - 8));
    return (_jsxs(Box, { flexDirection: "column", flexShrink: 0, marginBottom: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: theme.title, children: ["LUNAMI", _jsx(Text, { color: theme.muted, children: " CLI" })] }), _jsxs(Text, { color: theme.muted, children: [t('header_session'), ":", _jsxs(Text, { color: theme.title, children: [" ", sessionName] }), _jsx(Text, { color: theme.muted, children: "  " }), _jsx(Text, { color: ctxColor, children: ctxLabel })] })] }), _jsx(Text, { color: theme.muted, children: shortCwd })] }));
}
