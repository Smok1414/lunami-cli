import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import type {AgentStatus} from '../../agent.js';
import type {ThemeTokens} from '../theme.js';
import { t } from '../../i18n.js';

type StatusBarProps = {
  status: AgentStatus;
  tokenCount: number;
  theme: ThemeTokens;
  hasContext: boolean;
  toolLabel: string;
  toolChain: {names: string[]; activeIndex: number} | null;
};

export function StatusBar({status, tokenCount, theme, hasContext, toolLabel, toolChain}: StatusBarProps): React.ReactElement {
  const [waveFrame, setWaveFrame] = useState(0);
  const waveText = t('status_done');

  useEffect(() => {
    if (status === 'DONE') {
      let frame = 0;
      setWaveFrame(0);
      const timer = setInterval(() => {
        frame++;
        setWaveFrame(frame);
        if (frame > waveText.length + 5) {
          clearInterval(timer);
        }
      }, 50);
      return () => clearInterval(timer);
    }

    setWaveFrame(0);
  }, [status, waveText.length]);

  const statusColor = status === 'ERROR' ? theme.error : status === 'DONE' ? theme.title : theme.assistant;
  const ctxColor = hasContext ? theme.ctxOn : theme.ctxOff;
  const ctxLabel = hasContext ? t('status_ctx_loaded') : t('status_ctx_none');

  let statusElement: React.ReactNode;

  if (status === 'DONE') {
    if (waveFrame > 0 && waveFrame <= waveText.length + 5) {
      statusElement = (
        <Text>
          {waveText.split('').map((char, i) => {
            const distance = Math.abs(waveFrame - 2 - i);
            const charColor = distance < 2 ? theme.accent : theme.title;
            return (
              <Text key={i} color={charColor}>
                {char}
              </Text>
            );
          })}
        </Text>
      );
    } else {
      statusElement = (
        <Text bold color={statusColor}>
          {waveText}
        </Text>
      );
    }
  } else if (status === 'TOOL' && toolChain && toolChain.names.length > 0) {
    statusElement = (
      <Text>
        {toolChain.names.map((name, i) => {
          const isActive = i === toolChain.activeIndex;
          const isDone = i < toolChain.activeIndex;
          const color = isActive ? theme.accent : isDone ? theme.title : theme.muted;

          return (
            <React.Fragment key={i}>
              {i > 0 ? <Text color={theme.muted}> → </Text> : null}
              <Text bold={isActive} color={color}>
                {isActive ? `[${name}]` : name}
              </Text>
            </React.Fragment>
          );
        })}
      </Text>
    );
  } else {
    const statusText = toolLabel && status === 'TOOL' ? `TOOL · ${toolLabel}` : status;
    statusElement = (
      <Text bold color={statusColor}>
        {statusText}
      </Text>
    );
  }

  return (
    <Box justifyContent="space-between">
      <Box>
        <Text color={theme.muted}>{t('status_label')}</Text>
        <Text color={ctxColor}> {ctxLabel}</Text>
      </Box>
      <Box>
        {statusElement}
        <Text color={theme.muted}>
          {' '}
          {t('status_tokens').toUpperCase()}: {tokenCount}
        </Text>
      </Box>
    </Box>
  );
}
