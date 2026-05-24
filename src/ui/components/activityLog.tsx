import React from 'react';
import {Box, Text} from 'ink';
import type {ActivityStep} from '../../activity.js';
import {formatStepLine} from '../../activity.js';
import type {ThemeTokens} from '../theme.js';
import {t} from '../../i18n.js';

type ActivityLogProps = {
  steps: ActivityStep[];
  theme: ThemeTokens;
  fallbackLabel?: string;
};

export function ActivityLog({steps, theme, fallbackLabel}: ActivityLogProps): React.ReactElement {
  const rows = steps.length > 0
    ? steps
    : fallbackLabel
      ? [{
          id: 'fallback',
          kind: 'thought' as const,
          label: fallbackLabel,
          status: 'active' as const
        }]
      : [];

  return (
    <Box flexDirection="column">
      {rows.map((step) => {
        const active = step.status === 'active';
        const iconColor = active ? theme.accent : theme.title;
        const textColor = active ? theme.title : theme.muted;

        return (
          <Box key={step.id}>
            <Text color={iconColor}>⬡ </Text>
            <Text color={textColor} bold={active}>
              {formatStepLine(step)}
            </Text>
          </Box>
        );
      })}
      {rows.length === 0 ? (
        <Text color={theme.muted}>{t('agent_thinking')}</Text>
      ) : null}
    </Box>
  );
}
