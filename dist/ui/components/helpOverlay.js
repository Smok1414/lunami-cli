import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { commands } from '../../commands.js';
import { t } from '../../i18n.js';
const groupOrder = ['agent', 'config', 'session', 'workspace'];
const groupLabels = {
    agent: () => t('palette_group_agent'),
    config: () => t('palette_group_config'),
    session: () => t('palette_group_session'),
    workspace: () => t('palette_group_workspace')
};
export function HelpOverlay({ theme, height }) {
    return (_jsxs(Box, { flexDirection: "column", height: height, borderStyle: "double", borderColor: theme.accent, paddingX: 1, overflow: "hidden", children: [_jsx(Text, { bold: true, color: theme.title, children: t('help_title') }), _jsx(Text, { color: theme.muted, children: t('shortcuts_line1') }), _jsx(Text, { color: theme.muted, children: t('shortcuts_line2') }), _jsx(Text, { children: " " }), groupOrder.map((group) => {
                const items = commands.filter((c) => c.group === group);
                if (items.length === 0) {
                    return null;
                }
                return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: theme.accent, bold: true, children: groupLabels[group]() }), items.map((cmd) => (_jsxs(Text, { children: [_jsx(Text, { color: theme.paletteCmd, children: cmd.name.padEnd(14) }), _jsx(Text, { color: theme.muted, children: cmd.description })] }, cmd.name)))] }, group));
            }), _jsx(Text, { color: theme.muted, children: t('help_close') })] }));
}
