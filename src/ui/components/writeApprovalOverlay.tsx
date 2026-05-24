import React from 'react';
import {Box, Text} from 'ink';
import type {PendingApproval} from '../../state.js';
import type {ThemeTokens} from '../theme.js';
import {t} from '../../i18n.js';
import {ModalOverlay} from './modalOverlay.js';

type WriteApprovalOverlayProps = {
  approval: Extract<PendingApproval, {type: 'writeFile'}>;
  theme: ThemeTokens;
  height: number;
};

export function WriteApprovalOverlay({approval, theme, height}: WriteApprovalOverlayProps): React.ReactElement {
  const action = approval.isNew ? 'create' : 'modify';

  return (
    <ModalOverlay title={t('write_approval_title')} theme={theme} height={height}>
      <Text color={theme.tool}>
        {t('write_approval_path', approval.path)} ({action} +{approval.linesAdded}
        {approval.linesRemoved > 0 ? ` -${approval.linesRemoved}` : ''})
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {approval.diff.map((line, index) => (
          <Text key={`${index}-${line}`} color={line.startsWith('+') ? theme.toolAdd : line.startsWith('-') ? theme.toolRemove : theme.modalDim}>
            {line}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.modalDim}>{t('write_approval_hint')}</Text>
      </Box>
    </ModalOverlay>
  );
}
