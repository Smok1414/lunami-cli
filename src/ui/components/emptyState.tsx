import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from '../theme.js';
import {t} from '../../i18n.js';

type EmptyStateProps = {
  theme: ThemeTokens;
  height?: number;
  width?: number;
};

export function EmptyState({theme, height = 10, width = 60}: EmptyStateProps): React.ReactElement {
  const safeHeight = Math.max(8, height);
  const safeWidth = Math.max(32, width);

  return (
    <Box
      flexDirection="column"
      height={safeHeight}
      width={safeWidth}
      justifyContent="center"
      alignItems="center"
    >
      <Text color={theme.title} bold>LUNAMI CLI</Text>
      <Text color={theme.accent}>{t('ai_ready')}</Text>
      <Box height={1} />
      <Text color={theme.muted}>{t('empty_hint_1')}</Text>
      <Text color={theme.muted}>{t('empty_hint_2')}</Text>
      <Text color={theme.muted}>{t('empty_hint_3')}</Text>
      <Text color={theme.muted}>{t('empty_hint_4')}</Text>
    </Box>
  );
}
