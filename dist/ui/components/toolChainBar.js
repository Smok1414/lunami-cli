import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Box, Text } from 'ink';
export function ToolChainBar({ toolChain, toolLabel, theme }) {
    if (!toolChain || toolChain.names.length === 0) {
        if (!toolLabel) {
            return null;
        }
        return (_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: theme.muted, children: [_jsx(Text, { color: theme.accent, children: "\u2192 " }), toolLabel] }) }));
    }
    return (_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: theme.muted, children: [_jsx(Text, { color: theme.accent, children: "\u2192 " }), toolChain.names.map((name, i) => {
                    const isActive = i === toolChain.activeIndex;
                    const isDone = i < toolChain.activeIndex;
                    const color = isActive ? theme.accent : isDone ? theme.title : theme.muted;
                    return (_jsxs(React.Fragment, { children: [i > 0 ? _jsx(Text, { color: theme.muted, children: " \u2192 " }) : null, _jsx(Text, { bold: isActive, color: color, children: isActive ? `[${name}]` : name })] }, `${name}-${i}`));
                })] }) }));
}
