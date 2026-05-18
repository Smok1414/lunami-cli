import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from './theme.js';
import {shortenPath} from './uiUtils.js';
import {t} from '../i18n.js';

type HeaderProps = {
  sessionName: string;
  cwdLabel: string;
  hasContext: boolean;
  theme: ThemeTokens;
  width: number;
};

export function Header({sessionName, cwdLabel, hasContext, theme, width}: HeaderProps): React.ReactElement {
  const ctxLabel = hasContext ? t('header_ctx_on') : t('header_ctx_off');
  const ctxColor = hasContext ? theme.ctxOn : theme.ctxOff;
  const shortCwd = shortenPath(cwdLabel, Math.max(24, width - 8));

  return (
    <Box flexDirection="column" flexShrink={0} marginBottom={1}>
      <Box justifyContent="space-between">
        <Text bold color={theme.title}>
          LUNAMI<Text color={theme.muted}> CLI</Text>
        </Text>
        <Text color={theme.muted}>
          {t('header_session')}:<Text color={theme.title}> {sessionName}</Text>
          <Text color={theme.muted}>  </Text>
          <Text color={ctxColor}>{ctxLabel}</Text>
        </Text>
      </Box>
      <Text color={theme.muted}>{shortCwd}</Text>
    </Box>
  );
}
