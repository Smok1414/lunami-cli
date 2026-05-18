import React from 'react';
import {Box, Text} from 'ink';
import type {AgentMode} from '../state.js';
import type {ThemeTokens} from './theme.js';
import {useBlink} from './hooks/useBlink.js';
import {wrapText} from './chatUtils.js';
import {t} from '../i18n.js';

type InputBoxProps = {
  typedText: string;
  pastedText: string | null;
  boxWidth: number;
  theme: ThemeTokens;
  agentMode: AgentMode;
  placeholder: string;
};

export function InputBox({
  typedText,
  pastedText,
  boxWidth,
  theme,
  agentMode,
  placeholder
}: InputBoxProps): React.ReactElement {
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

  return (
    <Box flexDirection="column" width={fieldWidth} marginBottom={1} flexShrink={0}>
      {previewLines.length > 0 ? (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.inputBorder}
          paddingX={1}
          marginBottom={1}
          width={fieldWidth}
        >
          {previewLines.map((line, index) => (
            <Text key={index} color={theme.muted} wrap="truncate">
              {line}
            </Text>
          ))}
          {pastedText && pastedText.split(/\r?\n/).length > 3 ? (
            <Text color={theme.muted}>…</Text>
          ) : null}
          <Text color={theme.accent}>{t('input_press_enter')}</Text>
        </Box>
      ) : null}

      <Box
        borderStyle="single"
        borderColor={theme.inputBorder}
        paddingX={1}
        width={fieldWidth}
      >
        <Text wrap="truncate">
          <Text color={theme.user}>{'> '}</Text>
          {modePrefix ? (
            <Text color={agentMode === 'yolo' ? theme.yoloAccent : theme.planAccent}>{modePrefix} </Text>
          ) : null}
          {tag ? <Text color={theme.accent}>{tag}</Text> : null}
          {isEmpty && !tag ? (
            <Text color={theme.muted}>{placeholder}</Text>
          ) : (
            <Text color={theme.user}>{displayTyped}</Text>
          )}
          <Text color={theme.title}>{cursorVisible ? '█' : ' '}</Text>
        </Text>
      </Box>
    </Box>
  );
}
