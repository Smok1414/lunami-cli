import React from 'react';
import {Box, Text} from 'ink';
import type {AgentMode} from '../../state.js';
import type {ThemeTokens} from '../theme.js';
import {modeAccent} from '../theme.js';
import {t} from '../../i18n.js';

type ModelBarProps = {
  modelLabel: string;
  agentMode: AgentMode;
  theme: ThemeTokens;
};

/** Модель закреплена над полем ввода — не уезжает с чатом. */
export function ModelBar({modelLabel, agentMode, theme}: ModelBarProps): React.ReactElement {
  const accent = modeAccent(theme, agentMode);

  return (
    <Box flexShrink={0} marginBottom={1}>
      <Text>
        <Text color={theme.muted}>{t('header_model')}: </Text>
        <Text color={accent} bold>
          {modelLabel || t('header_model_unknown')}
        </Text>
        <Text color={theme.muted}> · </Text>
        <Text color={accent} bold>
          {agentMode.toUpperCase()}
        </Text>
      </Text>
    </Box>
  );
}
