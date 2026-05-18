import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { t } from '../i18n.js';
import { ModalOverlay } from './ModalOverlay.js';
export function WriteApprovalOverlay({ approval, theme, height }) {
    const action = approval.isNew ? 'create' : 'modify';
    return (_jsxs(ModalOverlay, { title: t('write_approval_title'), theme: theme, height: height, children: [_jsxs(Text, { color: theme.tool, children: [t('write_approval_path', approval.path), " (", action, " +", approval.linesAdded, approval.linesRemoved > 0 ? ` -${approval.linesRemoved}` : '', ")"] }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: approval.diff.map((line, index) => (_jsx(Text, { color: line.startsWith('+') ? theme.toolAdd : line.startsWith('-') ? theme.toolRemove : theme.modalDim, children: line }, `${index}-${line}`))) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: theme.modalDim, children: t('write_approval_hint') }) })] }));
}
