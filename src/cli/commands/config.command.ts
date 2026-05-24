// File: src/cli/commands/config.command.ts

import { changeApi, getCurrentBaseUrl, getProviderInfo } from '../../llm.js';
import { changeLang } from '../../i18n.js';

export class ConfigCommand {
  public async setApi(baseUrl: string, apiKey: string): Promise<void> {
    await changeApi(baseUrl, apiKey);
  }

  public getApiUrl(): string {
    return getCurrentBaseUrl();
  }

  public getProvider() {
    return getProviderInfo();
  }

  public async setLanguage(lang: 'en' | 'ru'): Promise<void> {
    await changeLang(lang);
  }
}
