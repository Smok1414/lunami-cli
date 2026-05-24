import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text} from 'ink';
import type {AgentStatus} from '../../agent.js';
import type {CommandDefinition} from '../../commands.js';
import type {ThemeName} from '../theme.js';
import type {AgentMode} from '../../state.js';
import {ApiPicker, type ApiPickerPhase} from './apiPicker.js';
import {CommandPalette, getPaletteHeight} from './commandPalette.js';
import {EmptyState} from './emptyState.js';
import {Header} from './header.js';
import {ModelBar} from './modelBar.js';
import {HelpOverlay} from './helpOverlay.js';
import {InputBox} from './inputBox.js';
import {MessageLine} from './messageLine.js';
import {ModalOverlay} from './modalOverlay.js';
import {WriteApprovalOverlay} from './writeApprovalOverlay.js';
import type {PendingApproval} from '../../state.js';
import {ModelPicker} from './modelPicker.js';
import {ActivityLog} from './activityLog.js';
import {StatusBar} from './statusbar.js';
import type {ActivityStep} from '../../activity.js';
import {estimateMessageLines, type UiMessage} from '../chatUtils.js';
import {getTheme, noColorMode} from '../theme.js';
import {shouldCollapseToolOutput} from '../uiUtils.js';
import {t} from '../../i18n.js';
import type {ModelGroup} from '../../models.js';
import {prefersAsciiOutput} from '../../utils/terminal.js';

export type {UiMessage} from '../chatUtils.js';
export {wrapText, estimateMessageLines} from '../chatUtils.js';
export {getPaletteHeight} from './commandPalette.js';

type ChatPanelProps = {
  input: string;
  pastedText: string | null;
  messages: UiMessage[];
  hiddenMessageCount: number;
  hiddenMessageCountBottom?: number;
  progress: number;
  progressRound: number;
  progressTool: string;
  isBusy: boolean;
  status: AgentStatus;
  tokenCount: number;
  modelLabel: string;
  sessionName: string;
  cwdLabel: string;
  agentMode: AgentMode;
  themeName: ThemeName;
  panelWidth: number;
  panelHeight: number;
  paletteCommands: CommandDefinition[];
  paletteIndex: number;
  paletteVisible: boolean;
  paletteQuery: string;
  modelPickerOpen: boolean;
  modelPickerGroups: ModelGroup[];
  modelPickerSearch: string;
  modelPickerLoading: boolean;
  modelPickerIndex: number;
  modelPickerCustomMode: boolean;
  modelPickerCustomInput: string;
  apiPickerOpen: boolean;
  apiSetupMode?: boolean;
  apiPickerPhase: ApiPickerPhase;
  apiPickerIndex: number;
  apiPickerEndpoint: string;
  apiPickerKey: string;
  apiPickerField: 'endpoint' | 'key';
  apiCurrentEndpoint: string;
  hasContext: boolean;
  toolLabel: string;
  toolChain: {names: string[]; activeIndex: number} | null;
  activitySteps: ActivityStep[];
  helpOpen: boolean;
  writeApproval: Extract<PendingApproval, {type: 'writeFile'}> | null;
  expandedToolIds: Set<string>;
  streamingMessageId: string | null;
  onToggleToolExpand: (id: string) => void;
};

const minPanelWidth = 48;
const headerLines = 3;
const pinnedFooterLines = 7;

export function ChatPanel(props: ChatPanelProps): React.ReactElement {
  const {
    input,
    pastedText,
    messages,
    hiddenMessageCount,
    hiddenMessageCountBottom = 0,
    progress,
    progressRound,
    progressTool,
    isBusy,
    status,
    tokenCount,
    modelLabel,
    sessionName,
    cwdLabel,
    agentMode,
    themeName,
    panelWidth,
    panelHeight,
    paletteCommands,
    paletteIndex,
    paletteVisible,
    paletteQuery,
    modelPickerOpen,
    modelPickerGroups,
    modelPickerSearch,
    modelPickerLoading,
    modelPickerIndex,
    modelPickerCustomMode,
    modelPickerCustomInput,
    apiPickerOpen,
    apiSetupMode = false,
    apiPickerPhase,
    apiPickerIndex,
    apiPickerEndpoint,
    apiPickerKey,
    apiPickerField,
    apiCurrentEndpoint,
    hasContext,
    toolLabel,
    toolChain,
    activitySteps,
    helpOpen,
    writeApproval,
    expandedToolIds,
    streamingMessageId,
    onToggleToolExpand
  } = props;

  const theme = getTheme(themeName);
  const borderStyle = prefersAsciiOutput() ? 'single' : 'round';
  const [borderFlash, setBorderFlash] = useState(false);
  const width = Math.max(minPanelWidth, panelWidth);
  const contentWidth = Math.max(24, width - 6);
  const textWidth = Math.max(24, contentWidth - 6);
  const paletteLines = paletteVisible ? getPaletteHeight(paletteCommands.length) : 0;
  const overlayOpen = modelPickerOpen || apiPickerOpen || helpOpen || Boolean(writeApproval);
  const pickerAreaHeight = Math.max(6, panelHeight - headerLines - 2);
  const activityLines = isBusy ? Math.max(2, activitySteps.length || 1) + 1 : 0;
  const messageAreaHeight = Math.max(
    4,
    panelHeight - headerLines - pinnedFooterLines - paletteLines - activityLines - (hiddenMessageCount > 0 ? 1 : 0) - (hiddenMessageCountBottom > 0 ? 1 : 0)
  );

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
        return messages[i]!.id;
      }
    }
    return null;
  }, [messages]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={panelHeight}
      borderStyle={borderStyle}
      borderColor={borderFlash ? theme.borderFlash : theme.border}
      paddingX={1}
      paddingY={0}
    >
      <Header
        sessionName={sessionName}
        cwdLabel={cwdLabel}
        hasContext={hasContext}
        theme={theme}
        width={contentWidth}
      />
      <Divider width={contentWidth} color={borderFlash ? theme.borderFlash : theme.border} />

      {overlayOpen ? (
        <Box flexDirection="column" height={pickerAreaHeight} overflow="hidden">
          {writeApproval ? (
            <WriteApprovalOverlay approval={writeApproval} theme={theme} height={pickerAreaHeight} />
          ) : helpOpen ? (
            <HelpOverlay theme={theme} height={pickerAreaHeight} />
          ) : modelPickerOpen ? (
            <ModalOverlay title={t('model_picker_title')} theme={theme} height={pickerAreaHeight}>
              <ModelPicker
                groups={modelPickerGroups}
                search={modelPickerSearch}
                loading={modelPickerLoading}
                selectedIndex={modelPickerIndex}
                customMode={modelPickerCustomMode}
                customInput={modelPickerCustomInput}
                theme={theme}
              />
            </ModalOverlay>
          ) : (
            <ModalOverlay
              title={apiSetupMode ? t('api_setup_title') : t('api_title')}
              theme={theme}
              height={pickerAreaHeight}
            >
              <ApiPicker
                phase={apiPickerPhase}
                selectedIndex={apiPickerIndex}
                endpoint={apiPickerEndpoint}
                apiKey={apiPickerKey}
                activeField={apiPickerField}
                currentEndpoint={apiCurrentEndpoint}
                setupMode={apiSetupMode}
                theme={theme}
              />
            </ModalOverlay>
          )}
        </Box>
      ) : (
        <>
          <Box
            flexDirection="column"
            height={messageAreaHeight}
            overflow="hidden"
            marginBottom={1}
            justifyContent={messages.length === 0 ? 'center' : 'flex-start'}
          >
            {hiddenMessageCount > 0 ? (
              <Text color={theme.muted}>{t('hidden_messages', hiddenMessageCount)}</Text>
            ) : null}

            {messages.length === 0 ? (
              <EmptyState theme={theme} height={messageAreaHeight} width={contentWidth} />
            ) : (
              messages.map((message) => (
                <MessageLine
                  key={message.id}
                  message={message}
                  theme={theme}
                  textWidth={textWidth}
                  expanded={expandedToolIds.has(message.id)}
                  onToggleExpand={() => onToggleToolExpand(message.id)}
                  isStreaming={message.id === streamingMessageId && message.id === lastAssistantId}
                  showTimestamp={message.kind === 'user' || message.id === lastAssistantId}
                />
              ))
            )}

            {hiddenMessageCountBottom > 0 ? (
              <Text color={theme.muted}>{t('hidden_messages_bottom', hiddenMessageCountBottom)}</Text>
            ) : null}
          </Box>

          {isBusy ? (
            <Box flexDirection="column" marginBottom={1}>
              <ActivityLog
                steps={activitySteps}
                theme={theme}
                fallbackLabel={toolLabel || t('agent_thinking')}
              />
            </Box>
          ) : null}
        </>
      )}

      {paletteVisible && !overlayOpen ? (
        <CommandPalette
          commands={paletteCommands}
          selectedIndex={paletteIndex}
          query={paletteQuery}
          theme={theme}
        />
      ) : null}

      <Box flexDirection="column" flexShrink={0}>
        <Divider width={contentWidth} color={theme.border} />
        <ModelBar modelLabel={modelLabel} agentMode={agentMode} theme={theme} />
        {!overlayOpen ? (
          <InputBox
            typedText={input}
            pastedText={pastedText}
            boxWidth={contentWidth}
            theme={theme}
            agentMode={agentMode}
            placeholder={t('input_placeholder')}
          />
        ) : null}
        <ShortcutBar theme={theme} />
        <StatusBar
        status={status}
        tokenCount={tokenCount}
        theme={theme}
        hasContext={hasContext}
        toolLabel={toolLabel}
        toolChain={toolChain}
        />
      </Box>
    </Box>
  );
}

function Divider({width, color}: {width: number; color: string}): React.ReactElement {
  return (
    <Text color={color} wrap="truncate">
      {'-'.repeat(Math.max(1, width))}
    </Text>
  );
}

function ShortcutBar({theme}: {theme: ReturnType<typeof getTheme>}): React.ReactElement {
  return (
    <Box marginBottom={1}>
      <Text color={theme.muted} wrap="truncate">
        {t('shortcuts_bar')}
      </Text>
    </Box>
  );
}

export function isCollapsibleToolMessage(message: UiMessage): boolean {
  if (message.kind !== 'tool' || message.collapsible === false) {
    return false;
  }

  const lines = estimateMessageLines(message.text, 60);
  return shouldCollapseToolOutput(message.text, lines);
}
