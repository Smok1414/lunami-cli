import React from 'react';
import {Box, Text} from 'ink';
import type {CommandDefinition, CommandGroup} from '../commands.js';
import type {ThemeTokens} from './theme.js';
import {fuzzyHighlightParts} from './uiUtils.js';
import {pluralCommands, t} from '../i18n.js';

type CommandPaletteProps = {
  commands: CommandDefinition[];
  selectedIndex: number;
  query: string;
  theme: ThemeTokens;
};

const groupOrder: CommandGroup[] = ['agent', 'config', 'session', 'workspace'];

const groupTitle: Record<CommandGroup, () => string> = {
  agent: () => t('palette_group_agent'),
  config: () => t('palette_group_config'),
  session: () => t('palette_group_session'),
  workspace: () => t('palette_group_workspace')
};

export function CommandPalette({commands: items, selectedIndex, query, theme}: CommandPaletteProps): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  const maxLength = Math.max(...items.map((c) => c.name.length));
  let flatIndex = 0;

  return (
    <Box flexDirection="column" flexShrink={0} borderStyle="single" borderColor={theme.inputBorder} paddingX={1} marginBottom={1}>
      {groupOrder.map((group) => {
        const groupItems = items.filter((c) => c.group === group);
        if (groupItems.length === 0) {
          return null;
        }

        return (
          <Box key={group} flexDirection="column">
            <Text color={theme.accent} bold>
              ─ {groupTitle[group]()} ─
            </Text>
            {groupItems.map((cmd) => {
              const index = flatIndex;
              flatIndex += 1;
              const isSelected = index === selectedIndex;
              const descParts = fuzzyHighlightParts(cmd.description, query.slice(1));
              const prefix = isSelected ? '▸ ' : '  ';

              return (
                <Text key={cmd.name} wrap="truncate">
                  <Text color={isSelected ? theme.paletteSelected : theme.paletteCmd} bold={isSelected}>
                    {prefix}
                    {cmd.name.padEnd(maxLength + 1)}
                  </Text>
                  <Text>
                    {descParts.map((part, i) => (
                      <Text
                        key={i}
                        color={part.match ? theme.paletteSelected : isSelected ? theme.assistant : theme.paletteDesc}
                        bold={part.match}
                      >
                        {part.text}
                      </Text>
                    ))}
                  </Text>
                </Text>
              );
            })}
          </Box>
        );
      })}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.muted}>{pluralCommands(items.length)}</Text>
        <Text color={theme.muted}>{t('palette_esc_hint')}</Text>
      </Box>
    </Box>
  );
}

export function getPaletteHeight(commandCount: number): number {
  if (commandCount === 0) {
    return 0;
  }

  return commandCount + 11;
}
