import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { ApiPicker } from './ApiPicker.js';
import { CommandPalette, getPaletteHeight } from './CommandPalette.js';
import { EmptyState } from './EmptyState.js';
import { Header } from './Header.js';
import { ModelBar } from './ModelBar.js';
import { HelpOverlay } from './HelpOverlay.js';
import { InputBox } from './InputBox.js';
import { MessageLine } from './MessageLine.js';
import { ModalOverlay } from './ModalOverlay.js';
import { WriteApprovalOverlay } from './WriteApprovalOverlay.js';
import { ModelPicker } from './ModelPicker.js';
import { ActivityLog } from './ActivityLog.js';
import { StatusBar } from './StatusBar.js';
import { estimateMessageLines } from './chatUtils.js';
import { getTheme, noColorMode } from './theme.js';
import { shouldCollapseToolOutput } from './uiUtils.js';
import { t } from '../i18n.js';
export { wrapText, estimateMessageLines } from './chatUtils.js';
export { getPaletteHeight } from './CommandPalette.js';
const minPanelWidth = 48;
const headerLines = 2;
const pinnedFooterLines = 6;
export function ChatPanel(props) {
    const { input, pastedText, messages, hiddenMessageCount, progress, progressRound, progressTool, isBusy, status, tokenCount, modelLabel, sessionName, cwdLabel, agentMode, themeName, panelWidth, panelHeight, paletteCommands, paletteIndex, paletteVisible, paletteQuery, modelPickerOpen, modelPickerGroups, modelPickerSearch, modelPickerLoading, modelPickerIndex, modelPickerCustomMode, modelPickerCustomInput, apiPickerOpen, apiSetupMode = false, apiPickerPhase, apiPickerIndex, apiPickerEndpoint, apiPickerKey, apiPickerField, apiCurrentEndpoint, hasContext, toolLabel, toolChain, activitySteps, helpOpen, writeApproval, expandedToolIds, streamingMessageId, onToggleToolExpand } = props;
    const theme = getTheme(themeName);
    const [borderFlash, setBorderFlash] = useState(false);
    const width = Math.max(minPanelWidth, panelWidth);
    const textWidth = Math.max(24, width - 20);
    const paletteLines = paletteVisible ? getPaletteHeight(paletteCommands.length) : 0;
    const overlayOpen = modelPickerOpen || apiPickerOpen || helpOpen || Boolean(writeApproval);
    const pickerAreaHeight = Math.max(6, panelHeight - headerLines - 2);
    const activityLines = isBusy ? Math.max(2, activitySteps.length || 1) : 0;
    const messageAreaHeight = Math.max(4, panelHeight - headerLines - pinnedFooterLines - paletteLines - activityLines - (hiddenMessageCount > 0 ? 1 : 0));
    useEffect(() => {
        if (status !== 'DONE' || noColorMode()) {
            return;
        }
        setBorderFlash(true);
        const timer = setTimeout(() => setBorderFlash(false), 280);
        return () => clearTimeout(timer);
    }, [status]);
    const lastAssistantId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i]?.kind === 'assistant') {
                return messages[i].id;
            }
        }
        return null;
    }, [messages]);
    return (_jsxs(Box, { flexDirection: "column", width: width, height: panelHeight, borderStyle: "round", borderColor: borderFlash ? theme.borderFlash : theme.border, paddingX: 1, paddingY: 0, children: [_jsx(Header, { sessionName: sessionName, cwdLabel: cwdLabel, hasContext: hasContext, theme: theme, width: width - 4 }), overlayOpen ? (_jsx(Box, { flexDirection: "column", height: pickerAreaHeight, overflow: "hidden", children: writeApproval ? (_jsx(WriteApprovalOverlay, { approval: writeApproval, theme: theme, height: pickerAreaHeight })) : helpOpen ? (_jsx(HelpOverlay, { theme: theme, height: pickerAreaHeight })) : modelPickerOpen ? (_jsx(ModalOverlay, { title: t('model_picker_title'), theme: theme, height: pickerAreaHeight, children: _jsx(ModelPicker, { groups: modelPickerGroups, search: modelPickerSearch, loading: modelPickerLoading, selectedIndex: modelPickerIndex, customMode: modelPickerCustomMode, customInput: modelPickerCustomInput, theme: theme }) })) : (_jsx(ModalOverlay, { title: apiSetupMode ? t('api_setup_title') : t('api_title'), theme: theme, height: pickerAreaHeight, children: _jsx(ApiPicker, { phase: apiPickerPhase, selectedIndex: apiPickerIndex, endpoint: apiPickerEndpoint, apiKey: apiPickerKey, activeField: apiPickerField, currentEndpoint: apiCurrentEndpoint, setupMode: apiSetupMode, theme: theme }) })) })) : (_jsx(_Fragment, { children: _jsxs(Box, { flexDirection: "column", height: messageAreaHeight, overflow: "hidden", marginBottom: 1, children: [hiddenMessageCount > 0 ? (_jsx(Text, { color: theme.muted, children: t('hidden_messages', hiddenMessageCount) })) : null, messages.length === 0 ? (_jsx(EmptyState, { theme: theme })) : (messages.map((message) => (_jsx(MessageLine, { message: message, theme: theme, textWidth: textWidth, expanded: expandedToolIds.has(message.id), onToggleExpand: () => onToggleToolExpand(message.id), isStreaming: message.id === streamingMessageId && message.id === lastAssistantId, showTimestamp: message.kind === 'user' || message.id === lastAssistantId }, message.id)))), isBusy ? (_jsx(ActivityLog, { steps: activitySteps, theme: theme, fallbackLabel: toolLabel || t('agent_thinking') })) : null] }) })), paletteVisible && !overlayOpen ? (_jsx(CommandPalette, { commands: paletteCommands, selectedIndex: paletteIndex, query: paletteQuery, theme: theme })) : null, _jsxs(Box, { flexDirection: "column", flexShrink: 0, children: [_jsx(ModelBar, { modelLabel: modelLabel, agentMode: agentMode, theme: theme }), !overlayOpen ? (_jsx(InputBox, { typedText: input, pastedText: pastedText, boxWidth: width - 4, theme: theme, agentMode: agentMode, placeholder: t('input_placeholder') })) : null, _jsx(ShortcutBar, { theme: theme }), _jsx(StatusBar, { status: status, tokenCount: tokenCount, theme: theme, hasContext: hasContext, toolLabel: toolLabel, toolChain: toolChain })] })] }));
}
function ShortcutBar({ theme }) {
    return (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: theme.muted, wrap: "truncate", children: t('shortcuts_bar') }) }));
}
export function isCollapsibleToolMessage(message) {
    if (message.kind !== 'tool' || message.collapsible === false) {
        return false;
    }
    const lines = estimateMessageLines(message.text, 60);
    return shouldCollapseToolOutput(message.text, lines);
}
