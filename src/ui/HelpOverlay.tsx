import React from 'react';
import {Box, Text} from 'ink';
import {commands, type CommandGroup} from '../commands.js';
import type {ThemeTokens} from './theme.js';
import {t} from '../i18n.js';

type HelpOverlayProps = {
  theme: ThemeTokens;
  height: number;
};

const groupOrder: CommandGroup[] = ['agent', 'config', 'session', 'workspace'];

const groupLabels: Record<CommandGroup, () => string> = {
  agent: () => t('palette_group_agent'),
  config: () => t('palette_group_config'),
  session: () => t('palette_group_session'),
  workspace: () => t('palette_group_workspace')
};

export function HelpOverlay({theme, height}: HelpOverlayProps): React.ReactElement {
  return (
    <Box flexDirection="column" height={height} borderStyle="double" borderColor={theme.accent} paddingX={1} overflow="hidden">
      <Text bold color={theme.title}>{t('help_title')}</Text>
      <Text color={theme.muted}>{t('shortcuts_line1')}</Text>
      <Text color={theme.muted}>{t('shortcuts_line2')}</Text>
      <Text> </Text>
      {groupOrder.map((group) => {
        const items = commands.filter((c) => c.group === group);
        if (items.length === 0) {
          return null;
        }

        return (
          <Box key={group} flexDirection="column" marginBottom={1}>
            <Text color={theme.accent} bold>
              {groupLabels[group]()}
            </Text>
            {items.map((cmd) => (
              <Text key={cmd.name}>
                <Text color={theme.paletteCmd}>{cmd.name.padEnd(14)}</Text>
                <Text color={theme.muted}>{cmd.description}</Text>
              </Text>
            ))}
          </Box>
        );
      })}
      <Text color={theme.muted}>{t('help_close')}</Text>
    </Box>
  );
}
