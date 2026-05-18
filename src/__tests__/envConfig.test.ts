import {describe, expect, it, beforeEach, afterEach} from '@jest/globals';
import {hasConfiguredApi, isPlaceholderApiKey} from '../envConfig.js';

describe('envConfig', () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'LLM_PROVIDER',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'OPENAI_BASE_URL'
    ]) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('detects placeholder keys', () => {
    expect(isPlaceholderApiKey('sk-your-openai-key')).toBe(true);
    expect(isPlaceholderApiKey('sk-live-real-key')).toBe(false);
  });

  it('treats ollama as configured without key', () => {
    process.env.LLM_PROVIDER = 'ollama';
    expect(hasConfiguredApi()).toBe(true);
  });

  it('requires openai key by default', () => {
    expect(hasConfiguredApi()).toBe(false);
    process.env.OPENAI_API_KEY = 'sk-test-key';
    expect(hasConfiguredApi()).toBe(true);
  });
});
