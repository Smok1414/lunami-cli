import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { wrapMultilineText } from '../chatUtils.js';
import { formatDiffLine, getToolIcon, splitCodeBlocks, shouldCollapseToolOutput } from '../uiUtils.js';
import { t } from '../../i18n.js';
import { asciiFallback, prefersAsciiOutput } from '../../utils/terminal.js';
function useAnimatedLines(totalLines, enabled, delayMs = 15) {
    const [visibleLines, setVisibleLines] = useState(enabled ? 1 : totalLines);
    useEffect(() => {
        if (!enabled || visibleLines >= totalLines) {
            return;
        }
        const timer = setInterval(() => {
            setVisibleLines((prev) => (prev >= totalLines - 1 ? totalLines : prev + 1));
        }, delayMs);
        return () => {
            clearInterval(timer);
        };
    }, [totalLines, enabled, delayMs, visibleLines]);
    return visibleLines;
}
export function MessageLine({ message, theme, textWidth, expanded, onToggleExpand, isStreaming, showTimestamp }) {
    const visibleText = message.text.replace(/\t/g, '  ');
    const timestamp = showTimestamp ? (_jsxs(Text, { color: theme.muted, children: [message.timestamp, " "] })) : null;
    if (message.kind === 'user') {
        const tsLen = showTimestamp ? message.timestamp.length + 1 : 0;
        const lines = wrapMultilineText(visibleText, textWidth, (index) => index === 0 ? 2 + tsLen : 2);
        return (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: lines.map((line, index) => (_jsxs(Text, { color: theme.user, children: [index === 0 ? asciiFallback('▸ ', '> ') : '  ', index === 0 ? timestamp : null, line] }, `${message.id}-${index}`))) }));
    }
    if (message.kind === 'error') {
        const tsLen = showTimestamp ? message.timestamp.length + 1 : 0;
        const lines = wrapMultilineText(visibleText, textWidth, (index) => index === 0 ? 2 + tsLen : 2);
        return (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: lines.map((line, index) => (_jsxs(Text, { color: theme.error, children: [index === 0 ? '! ' : '  ', index === 0 ? timestamp : null, line] }, `${message.id}-${index}`))) }));
    }
    if (message.kind === 'tool') {
        return (_jsx(ToolMessage, { message: message, theme: theme, textWidth: textWidth, expanded: expanded, onToggleExpand: onToggleExpand, timestamp: timestamp }));
    }
    return (_jsx(AssistantMessage, { message: message, theme: theme, textWidth: textWidth, timestamp: timestamp, isStreaming: isStreaming }));
}
function ToolMessage({ message, theme, textWidth, expanded, onToggleExpand, timestamp }) {
    const icon = getToolIcon(message.text);
    const tsLen = timestamp ? message.timestamp.length + 1 : 0;
    const lines = wrapMultilineText(message.text.replace(/\t/g, '  '), textWidth, (index) => {
        if (index === 0) {
            return 2 + tsLen + 2;
        }
        return 4;
    });
    const collapsible = message.collapsible !== false && shouldCollapseToolOutput(message.text, lines.length);
    const visibleLineCount = collapsible && !expanded ? 3 : lines.length;
    const isAnimated = !!message.animate;
    const animatedCount = useAnimatedLines(visibleLineCount, isAnimated, 25);
    const displayCount = isAnimated ? animatedCount : visibleLineCount;
    const hiddenCount = lines.length - visibleLineCount;
    const expandIndent = prefersAsciiOutput() ? '  ' : '  ';
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [lines.slice(0, displayCount).map((line, index) => {
                const diff = formatDiffLine(line);
                const color = diff.kind === 'add' ? theme.toolAdd : diff.kind === 'remove' ? theme.toolRemove : theme.tool;
                const prefix = index === 0 ? `${icon} ` : '  ';
                const gutter = diff.kind !== 'neutral' ? `${diff.gutter} ` : '  ';
                return (_jsxs(Text, { color: color, children: [prefix, index === 0 ? timestamp : null, gutter, diff.body] }, `${message.id}-${index}`));
            }), collapsible && hiddenCount > 0 && !expanded ? (_jsxs(Text, { color: theme.muted, children: [expandIndent, t('tool_collapsed', hiddenCount), " ", t('tool_expand')] })) : null, collapsible && expanded ? (_jsxs(Text, { color: theme.muted, children: [expandIndent, t('tool_collapse')] })) : null] }));
}
function AssistantMessage({ message, theme, textWidth, timestamp, isStreaming }) {
    const segments = splitCodeBlocks(message.text.replace(/\t/g, '  '));
    const tsLen = timestamp ? message.timestamp.length + 1 : 0;
    let messageLineOffset = 0;
    const codeBorderStyle = prefersAsciiOutput() ? undefined : 'single';
    const assistantPrefix = asciiFallback('◆ ', '* ');
    const codeMetaPrefix = asciiFallback('◆ ', '* ');
    return (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: segments.map((segment, segIndex) => {
            if (segment.code) {
                const codeLines = wrapMultilineText(segment.text, textWidth, (index) => {
                    const globalIndex = messageLineOffset + index;
                    const withMeta = globalIndex === 0 && timestamp ? 2 + tsLen : 2;
                    return withMeta + 4;
                });
                messageLineOffset += codeLines.length;
                return (_jsx(Box, { flexDirection: "column", borderStyle: codeBorderStyle, borderColor: theme.codeBorder, paddingX: 1, marginBottom: 1, children: codeLines.map((line, index) => {
                        const showMeta = messageLineOffset - codeLines.length + index === 0 && timestamp;
                        return (_jsxs(Text, { color: theme.code, children: [showMeta ? (_jsxs(_Fragment, { children: [codeMetaPrefix, timestamp] })) : ('  '), line] }, `${message.id}-c-${segIndex}-${index}`));
                    }) }, `${message.id}-code-${segIndex}`));
            }
            const lines = wrapMultilineText(segment.text, textWidth, (index) => {
                const globalIndex = messageLineOffset + index;
                return globalIndex === 0 && timestamp ? 2 + tsLen : 2;
            });
            const segmentStart = messageLineOffset;
            messageLineOffset += lines.length;
            return (_jsx(React.Fragment, { children: lines.map((line, index) => (_jsxs(Text, { color: theme.assistant, children: [segmentStart + index === 0 ? assistantPrefix : '  ', segmentStart + index === 0 ? timestamp : null, line, isStreaming && segIndex === segments.length - 1 && index === lines.length - 1 ? (_jsx(Text, { color: theme.accent, children: asciiFallback('▌', '|') })) : null] }, `${message.id}-t-${segIndex}-${index}`))) }, `${message.id}-txt-${segIndex}`));
        }) }));
}
