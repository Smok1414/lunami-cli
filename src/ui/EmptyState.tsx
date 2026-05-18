import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from './theme.js';
import {t} from '../i18n.js';

type EmptyStateProps = {
  theme: ThemeTokens;
};

export function EmptyState({theme}: EmptyStateProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={theme.accent}>◆ {t('ai_ready')}</Text>
      <Text color={theme.muted}>  {t('empty_hint_1')}</Text>
      <Text color={theme.muted}>  {t('empty_hint_2')}</Text>
      <Text color={theme.muted}>  {t('empty_hint_3')}</Text>
      <Text color={theme.muted}>  {t('empty_hint_4')}</Text>
    </Box>
  );
}
