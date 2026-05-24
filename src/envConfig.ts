import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

export function getPrimaryEnvPath(): string {
  return resolve(homedir(), '.lunami', '.env');
}

export function isPlaceholderApiKey(key: string | undefined): boolean {
  if (!key?.trim()) {
    return true;
  }

  const normalized = key.trim().toLowerCase();

  return (
    normalized.includes('your-') ||
    normalized.includes('sk-your') ||
    normalized.startsWith('sk-...') ||
    normalized === 'changeme'
  );
}

export function isLocalApiBaseUrl(baseUrl: string | undefined): boolean {
  return Boolean(baseUrl && /localhost|127\.0\.0\.1/i.test(baseUrl));
}

export function hasConfiguredApi(): boolean {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  if (provider === 'ollama') {
    return true;
  }

  if (provider === 'anthropic') {
    return !isPlaceholderApiKey(process.env.ANTHROPIC_API_KEY);
  }

  const baseUrl = process.env.OPENAI_BASE_URL || process.env.OMNIROUTE_BASE_URL || '';

  if (isLocalApiBaseUrl(baseUrl)) {
    return true;
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OMNIROUTE_API_KEY;

  return !isPlaceholderApiKey(apiKey);
}

export async function readPrimaryEnvContent(): Promise<string> {
  try {
    return await readFile(getPrimaryEnvPath(), 'utf8');
  } catch {
    return '';
  }
}

export async function writePrimaryEnvContent(content: string): Promise<void> {
  const envPath = getPrimaryEnvPath();
  await mkdir(dirname(envPath), {recursive: true});
  await writeFile(envPath, content, 'utf8');
}
