import React from 'react';
import {Box, Text} from 'ink';
import {flattenModelGroups, type ModelGroup} from '../../models.js';
import {useBlink} from '../hooks/useBlink.js';
import type {ThemeTokens} from '../theme.js';
import { t } from '../../i18n.js';

type ModelPickerProps = {
  groups: ModelGroup[];
  search: string;
  loading?: boolean;
  selectedIndex: number;
  customMode: boolean;
  customInput: string;
  theme: ThemeTokens;
};

type RenderItem =
  | { type: 'group'; label: string; icon: string; isFirst: boolean }
  | { type: 'model'; model: string; index: number }
  | { type: 'custom' };

export function ModelPicker({groups, search, loading = false, selectedIndex, customMode, customInput, theme}: ModelPickerProps): React.ReactElement {
  const caretVisible = useBlink();
  const flatModels = flattenModelGroups(groups);

  const renderItems: RenderItem[] = [];
  renderItems.push({ type: 'custom' });
  groups.forEach((group, groupIndex) => {
    renderItems.push({ type: 'group', label: group.label, icon: group.icon, isFirst: groupIndex === 0 });
    group.models.forEach((model) => {
      const flatIndex = flatModels.indexOf(model);
      renderItems.push({ type: 'model', model, index: flatIndex });
    });
  });

  const maxVisibleItems = 12;
  let targetIndex = 0;
  if (customMode || selectedIndex === 0) {
    targetIndex = 0;
  } else {
    targetIndex = renderItems.findIndex(i => i.type === 'model' && i.index === selectedIndex - 1);
    if (targetIndex === -1) targetIndex = 0;
  }

  let startIndex = 0;
  if (renderItems.length > maxVisibleItems) {
    startIndex = targetIndex - Math.floor(maxVisibleItems / 2);
    if (startIndex < 0) startIndex = 0;
    if (startIndex + maxVisibleItems > renderItems.length) {
      startIndex = renderItems.length - maxVisibleItems;
    }
  }

  const visibleItems = renderItems.slice(startIndex, startIndex + maxVisibleItems);

  return (
    <Box flexDirection="column">
      {!customMode && (
        <Text color={search ? theme.assistant : theme.muted}>
          ({t('search_prompt')} {search}{caretVisible ? '█' : ' '})
        </Text>
      )}

      {startIndex > 0 && <Text color={theme.modalDim}>  {t('hidden_above')} ({startIndex})...</Text>}

      {visibleItems.map((item, i) => {
        if (item.type === 'custom') {
          return (
            <Text
              key="custom"
              color={customMode || selectedIndex === 0 ? theme.modalTitle : theme.muted}
              bold={customMode || selectedIndex === 0}
            >
              {customMode || selectedIndex === 0 ? '  ❯ ' : '    '}
              {t('enter_model')} {customMode ? `${customInput}${caretVisible ? '█' : ' '}` : ''}
            </Text>
          );
        }

        if (item.type === 'group') {
          return (
            <Box key={`g-${item.label}`} flexDirection="column">
              {i > 0 && <Text> </Text>}
              <Text color={theme.modalDim}>
                {'  '}{item.icon} <Text color={theme.assistant} bold>{item.label}</Text>
              </Text>
            </Box>
          );
        }

        if (item.type === 'model') {
          const sel = item.index === selectedIndex - 1 && !customMode;
          return (
            <Text key={`m-${item.model}`} color={sel ? theme.modalTitle : theme.muted} bold={sel}>
              {sel ? '  ❯ ' : '    '}{item.model}
            </Text>
          );
        }

        return null;
      })}

      {startIndex + maxVisibleItems < renderItems.length && (
        <Text color={theme.modalDim}>  {t('hidden_below')} ({renderItems.length - (startIndex + maxVisibleItems)})...</Text>
      )}

      {loading && <Text color={theme.muted}>  {t('loading_models')}</Text>}

      <Text color={theme.muted}>  {t('nav_hint')}</Text>
    </Box>
  );
}
