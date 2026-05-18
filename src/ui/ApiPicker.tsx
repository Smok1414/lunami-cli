import React from 'react';
import {Box, Text} from 'ink';
import type {ThemeTokens} from './theme.js';
import { t } from '../i18n.js';

export type ApiPreset = {
  name: string;
  url: string;
  needsCustomUrl: boolean;
};

export const apiPresets: ApiPreset[] = [
  {name: 'OpenAI', url: 'https://api.openai.com/v1', needsCustomUrl: false},
  {name: 'Groq', url: 'https://api.groq.com/openai/v1', needsCustomUrl: false},
  {name: 'Anthropic', url: 'https://api.anthropic.com', needsCustomUrl: false},
  {name: 'OmniRoute', url: '', needsCustomUrl: true},
  {name: 'Ollama', url: 'http://localhost:11434/v1', needsCustomUrl: false},
  {get name() { return t('api_preset_custom'); }, url: '', needsCustomUrl: true}
];

export type ApiPickerPhase = 'select' | 'input';

type ApiPickerProps = {
  phase: ApiPickerPhase;
  selectedIndex: number;
  endpoint: string;
  apiKey: string;
  activeField: 'endpoint' | 'key';
  currentEndpoint: string;
  setupMode?: boolean;
  theme: ThemeTokens;
};

export function ApiPicker({
  phase,
  selectedIndex,
  endpoint,
  apiKey,
  activeField,
  currentEndpoint,
  setupMode = false,
  theme
}: ApiPickerProps): React.ReactElement {
  if (phase === 'input') {
    return (
      <Box flexDirection="column">
        <Text color={theme.muted}>{t('api_endpoint')}</Text>
        <Text color={activeField === 'endpoint' ? theme.modalTitle : theme.assistant} bold={activeField === 'endpoint'}>
          {'  > '}{endpoint}{activeField === 'endpoint' ? '_' : ''}
        </Text>
        <Text> </Text>
        <Text color={theme.muted}>{t('api_key')}</Text>
        <Text color={activeField === 'key' ? theme.modalTitle : theme.assistant} bold={activeField === 'key'}>
          {'  > '}{maskKey(apiKey)}{activeField === 'key' ? '_' : ''}
        </Text>
        <Text> </Text>
        <Text color={theme.muted}>{t('api_hint_input')}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {setupMode ? (
        <>
          <Text color={theme.accent}>{t('api_setup_intro')}</Text>
          <Text color={theme.muted}>{t('api_setup_hint')}</Text>
          <Text> </Text>
        </>
      ) : (
        <Text color={theme.muted}>{t('api_current', currentEndpoint || t('api_not_set'))}</Text>
      )}
      <Text> </Text>
      <Text color={theme.muted}>{t('api_quick_select')}</Text>
      {apiPresets.map((preset, index) => {
        const sel = index === selectedIndex;
        const desc = preset.needsCustomUrl ? t('api_manual') : preset.url.replace('https://', '');

        return (
          <Text key={preset.name} color={sel ? theme.modalTitle : theme.assistant} bold={sel}>
            {'  '}{sel ? '❯ ' : '  '}{preset.name.padEnd(16)}{desc}
          </Text>
        );
      })}
      <Text> </Text>
      <Text color={theme.muted}>  {t('nav_hint')}</Text>
    </Box>
  );
}

function maskKey(key: string): string {
  if (key.length <= 4) {
    return key;
  }

  return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 4, 32))}`;
}
