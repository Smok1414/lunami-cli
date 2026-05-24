import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import type {UiMessage} from '../chatUtils.js';
import {wrapMultilineText, wrapText} from '../chatUtils.js';
import type {ThemeTokens} from '../theme.js';
import {
  formatDiffLine,
  getToolIcon,
  splitCodeBlocks,
  shouldCollapseToolOutput
} from '../uiUtils.js';
import {t} from '../../i18n.js';
import {asciiFallback, prefersAsciiOutput} from '../../utils/terminal.js';

type MessageLineProps = {
  message: UiMessage;
  theme: ThemeTokens;
  textWidth: number;
  expanded: boolean;
  onToggleExpand: () => void;
  isStreaming?: boolean;
  showTimestamp: boolean;
};

function useAnimatedLines(totalLines: number, enabled: boolean, delayMs = 15): number {
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

export function MessageLine({
  message,
  theme,
  textWidth,
  expanded,
  onToggleExpand,
  isStreaming,
  showTimestamp
}: MessageLineProps): React.ReactElement {
  const visibleText = message.text.replace(/\t/g, '  ');
  const timestamp = showTimestamp ? (
    <Text color={theme.muted}>{message.timestamp} </Text>
  ) : null;

  if (message.kind === 'user') {
    const tsLen = showTimestamp ? message.timestamp.length + 1 : 0;
    const lines = wrapMultilineText(visibleText, textWidth, (index) =>
      index === 0 ? 2 + tsLen : 2
    );

    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <Text key={`${message.id}-${index}`} color={theme.user}>
            {index === 0 ? asciiFallback('▸ ', '> ') : '  '}
            {index === 0 ? timestamp : null}
            {line}
          </Text>
        ))}
      </Box>
    );
  }

  if (message.kind === 'error') {
    const tsLen = showTimestamp ? message.timestamp.length + 1 : 0;
    const lines = wrapMultilineText(visibleText, textWidth, (index) =>
      index === 0 ? 2 + tsLen : 2
    );

    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <Text key={`${message.id}-${index}`} color={theme.error}>
            {index === 0 ? '! ' : '  '}
            {index === 0 ? timestamp : null}
            {line}
          </Text>
        ))}
      </Box>
    );
  }

  if (message.kind === 'tool') {
    return (
      <ToolMessage
        message={message}
        theme={theme}
        textWidth={textWidth}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        timestamp={timestamp}
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      theme={theme}
      textWidth={textWidth}
      timestamp={timestamp}
      isStreaming={isStreaming}
    />
  );
}

function ToolMessage({
  message,
  theme,
  textWidth,
  expanded,
  onToggleExpand,
  timestamp
}: {
  message: UiMessage;
  theme: ThemeTokens;
  textWidth: number;
  expanded: boolean;
  onToggleExpand: () => void;
  timestamp: React.ReactNode;
}): React.ReactElement {
  const icon = getToolIcon(message.text);
  const tsLen = timestamp ? message.timestamp.length + 1 : 0;
  const lines = wrapMultilineText(message.text.replace(/\t/g, '  '), textWidth, (index) => {
    if (index === 0) {
      return 2 + tsLen + 2;
    }

    return 4;
  });
  const collapsible =
    message.collapsible !== false && shouldCollapseToolOutput(message.text, lines.length);
  const visibleLineCount = collapsible && !expanded ? 3 : lines.length;
  const isAnimated = !!message.animate;
  const animatedCount = useAnimatedLines(visibleLineCount, isAnimated, 25);
  const displayCount = isAnimated ? animatedCount : visibleLineCount;
  const hiddenCount = lines.length - visibleLineCount;
  const expandIndent = prefersAsciiOutput() ? '  ' : '  ';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.slice(0, displayCount).map((line, index) => {
        const diff = formatDiffLine(line);
        const color =
          diff.kind === 'add' ? theme.toolAdd : diff.kind === 'remove' ? theme.toolRemove : theme.tool;
        const prefix = index === 0 ? `${icon} ` : '  ';
        const gutter = diff.kind !== 'neutral' ? `${diff.gutter} ` : '  ';

        return (
          <Text key={`${message.id}-${index}`} color={color}>
            {prefix}
            {index === 0 ? timestamp : null}
            {gutter}
            {diff.body}
          </Text>
        );
      })}
      {collapsible && hiddenCount > 0 && !expanded ? (
        <Text color={theme.muted}>
          {expandIndent}
          {t('tool_collapsed', hiddenCount)} {t('tool_expand')}
        </Text>
      ) : null}
      {collapsible && expanded ? (
        <Text color={theme.muted}>
          {expandIndent}
          {t('tool_collapse')}
        </Text>
      ) : null}
    </Box>
  );
}

function AssistantMessage({
  message,
  theme,
  textWidth,
  timestamp,
  isStreaming
}: {
  message: UiMessage;
  theme: ThemeTokens;
  textWidth: number;
  timestamp: React.ReactNode;
  isStreaming?: boolean;
}): React.ReactElement {
  const segments = splitCodeBlocks(message.text.replace(/\t/g, '  '));
  const tsLen = timestamp ? message.timestamp.length + 1 : 0;
  let messageLineOffset = 0;
  const codeBorderStyle = prefersAsciiOutput() ? undefined : 'single';
  const assistantPrefix = asciiFallback('◆ ', '* ');
  const codeMetaPrefix = asciiFallback('◆ ', '* ');

  return (
    <Box flexDirection="column" marginBottom={1}>
      {segments.map((segment, segIndex) => {
        if (segment.code) {
          const codeLines = wrapMultilineText(segment.text, textWidth, (index) => {
            const globalIndex = messageLineOffset + index;
            const withMeta = globalIndex === 0 && timestamp ? 2 + tsLen : 2;
            return withMeta + 4;
          });
          messageLineOffset += codeLines.length;

          return (
            <Box
              key={`${message.id}-code-${segIndex}`}
              flexDirection="column"
              borderStyle={codeBorderStyle}
              borderColor={theme.codeBorder}
              paddingX={1}
              marginBottom={1}
            >
              {codeLines.map((line, index) => {
                const showMeta = messageLineOffset - codeLines.length + index === 0 && timestamp;

                return (
                  <Text key={`${message.id}-c-${segIndex}-${index}`} color={theme.code}>
                    {showMeta ? (
                      <>
                        {codeMetaPrefix}{timestamp}
                      </>
                    ) : (
                      '  '
                    )}
                    {line}
                  </Text>
                );
              })}
            </Box>
          );
        }

        const lines = wrapMultilineText(segment.text, textWidth, (index) => {
          const globalIndex = messageLineOffset + index;
          return globalIndex === 0 && timestamp ? 2 + tsLen : 2;
        });
        const segmentStart = messageLineOffset;
        messageLineOffset += lines.length;

        return (
          <React.Fragment key={`${message.id}-txt-${segIndex}`}>
            {lines.map((line, index) => (
              <Text key={`${message.id}-t-${segIndex}-${index}`} color={theme.assistant}>
                {segmentStart + index === 0 ? assistantPrefix : '  '}
                {segmentStart + index === 0 ? timestamp : null}
                {line}
                {isStreaming && segIndex === segments.length - 1 && index === lines.length - 1 ? (
                  <Text color={theme.accent}>{asciiFallback('▌', '|')}</Text>
                ) : null}
              </Text>
            ))}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
