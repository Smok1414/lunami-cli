import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from '../theme.js';

type ModalOverlayProps = {
  title: string;
  theme: ThemeTokens;
  height: number;
  children: React.ReactNode;
};

export function ModalOverlay({title, theme, height, children}: ModalOverlayProps): React.ReactElement {
  return (
    <Box flexDirection="column" height={height} borderStyle="double" borderColor={theme.inputBorder} paddingX={1}>
      <Text bold color={theme.modalTitle}>{title}</Text>
      <Text color={theme.modalDim}>{'═'.repeat(Math.min(40, title.length + 8))}</Text>
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}
