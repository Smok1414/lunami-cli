import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { fuzzyHighlightParts } from './uiUtils.js';
import { pluralCommands, t } from '../i18n.js';
const groupOrder = ['agent', 'config', 'session', 'workspace'];
const groupTitle = {
    agent: () => t('palette_group_agent'),
    config: () => t('palette_group_config'),
    session: () => t('palette_group_session'),
    workspace: () => t('palette_group_workspace')
};
export function CommandPalette({ commands: items, selectedIndex, query, theme }) {
    if (items.length === 0) {
        return null;
    }
    const maxLength = Math.max(...items.map((c) => c.name.length));
    let flatIndex = 0;
    return (_jsxs(Box, { flexDirection: "column", flexShrink: 0, borderStyle: "single", borderColor: theme.inputBorder, paddingX: 1, marginBottom: 1, children: [groupOrder.map((group) => {
                const groupItems = items.filter((c) => c.group === group);
                if (groupItems.length === 0) {
                    return null;
                }
                return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: theme.accent, bold: true, children: ["\u2500 ", groupTitle[group](), " \u2500"] }), groupItems.map((cmd) => {
                            const index = flatIndex;
                            flatIndex += 1;
                            const isSelected = index === selectedIndex;
                            const descParts = fuzzyHighlightParts(cmd.description, query.slice(1));
                            const prefix = isSelected ? '▸ ' : '  ';
                            return (_jsxs(Text, { wrap: "truncate", children: [_jsxs(Text, { color: isSelected ? theme.paletteSelected : theme.paletteCmd, bold: isSelected, children: [prefix, cmd.name.padEnd(maxLength + 1)] }), _jsx(Text, { children: descParts.map((part, i) => (_jsx(Text, { color: part.match ? theme.paletteSelected : isSelected ? theme.assistant : theme.paletteDesc, bold: part.match, children: part.text }, i))) })] }, cmd.name));
                        })] }, group));
            }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: theme.muted, children: pluralCommands(items.length) }), _jsx(Text, { color: theme.muted, children: t('palette_esc_hint') })] })] }));
}
export function getPaletteHeight(commandCount) {
    if (commandCount === 0) {
        return 0;
    }
    return commandCount + 11;
}
