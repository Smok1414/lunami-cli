import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function ModalOverlay({ title, theme, height, children }) {
    return (_jsxs(Box, { flexDirection: "column", height: height, borderStyle: "double", borderColor: theme.inputBorder, paddingX: 1, children: [_jsx(Text, { bold: true, color: theme.modalTitle, children: title }), _jsx(Text, { color: theme.modalDim, children: '═'.repeat(Math.min(40, title.length + 8)) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1, children: children })] }));
}
