import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useBlink } from './hooks/useBlink.js';
import { wrapText } from './chatUtils.js';
import { t } from '../i18n.js';
export function InputBox({ typedText, pastedText, boxWidth, theme, agentMode, placeholder }) {
    const cursorVisible = useBlink();
    const modePrefix = agentMode === 'plan'
        ? t('input_plan_prefix')
        : agentMode === 'yolo'
            ? t('input_yolo_prefix')
            : '';
    const fieldWidth = Math.max(24, boxWidth);
    // single border + paddingX(1) с каждой стороны
    const innerWidth = Math.max(8, fieldWidth - 4);
    let tag = '';
    if (pastedText) {
        const lines = pastedText.split(/\r?\n/).length;
        tag = lines > 1 ? t('input_pasted_lines', lines - 1) : t('input_pasted_chars', pastedText.length);
    }
    const isEmpty = !typedText && !pastedText;
    let displayTyped = typedText.replace(/[\n\r\t]/g, ' ');
    const prefixLen = 2 + modePrefix.length + (modePrefix ? 1 : 0) + tag.length;
    const availableWidth = Math.max(0, innerWidth - prefixLen - 1);
    if (displayTyped.length > availableWidth) {
        displayTyped = `…${displayTyped.slice(displayTyped.length - availableWidth + 1)}`;
    }
    const previewLines = pastedText
        ? wrapText(pastedText, innerWidth).slice(0, 3)
        : [];
    return (_jsxs(Box, { flexDirection: "column", width: fieldWidth, marginBottom: 1, flexShrink: 0, children: [previewLines.length > 0 ? (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: theme.inputBorder, paddingX: 1, marginBottom: 1, width: fieldWidth, children: [previewLines.map((line, index) => (_jsx(Text, { color: theme.muted, wrap: "truncate", children: line }, index))), pastedText && pastedText.split(/\r?\n/).length > 3 ? (_jsx(Text, { color: theme.muted, children: "\u2026" })) : null, _jsx(Text, { color: theme.accent, children: t('input_press_enter') })] })) : null, _jsx(Box, { borderStyle: "single", borderColor: theme.inputBorder, paddingX: 1, width: fieldWidth, children: _jsxs(Text, { wrap: "truncate", children: [_jsx(Text, { color: theme.user, children: '> ' }), modePrefix ? (_jsxs(Text, { color: agentMode === 'yolo' ? theme.yoloAccent : theme.planAccent, children: [modePrefix, " "] })) : null, tag ? _jsx(Text, { color: theme.accent, children: tag }) : null, isEmpty && !tag ? (_jsx(Text, { color: theme.muted, children: placeholder })) : (_jsx(Text, { color: theme.user, children: displayTyped })), _jsx(Text, { color: theme.title, children: cursorVisible ? '█' : ' ' })] }) })] }));
}
