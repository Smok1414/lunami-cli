import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from './theme.js';

type ToolChainBarProps = {
  toolChain: {names: string[]; activeIndex: number} | null;
  toolLabel: string;
  theme: ThemeTokens;
};

export function ToolChainBar({toolChain, toolLabel, theme}: ToolChainBarProps): React.ReactElement | null {
  if (!toolChain || toolChain.names.length === 0) {
    if (!toolLabel) {
      return null;
    }

    return (
      <Box marginBottom={1}>
        <Text color={theme.muted}>
          <Text color={theme.accent}>→ </Text>
          {toolLabel}
        </Text>
      </Box>
    );
  }

  return (
    <Box marginBottom={1}>
      <Text color={theme.muted}>
        <Text color={theme.accent}>→ </Text>
        {toolChain.names.map((name, i) => {
          const isActive = i === toolChain.activeIndex;
          const isDone = i < toolChain.activeIndex;
          const color = isActive ? theme.accent : isDone ? theme.title : theme.muted;

          return (
            <React.Fragment key={`${name}-${i}`}>
              {i > 0 ? <Text color={theme.muted}> → </Text> : null}
              <Text bold={isActive} color={color}>
                {isActive ? `[${name}]` : name}
              </Text>
            </React.Fragment>
          );
        })}
      </Text>
    </Box>
  );
}
