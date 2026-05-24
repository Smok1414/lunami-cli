// File: src/cli/commands/config.command.ts
import { changeApi, getCurrentBaseUrl, getProviderInfo } from '../../llm.js';
import { changeLang } from '../../i18n.js';
export class ConfigCommand {
    async setApi(baseUrl, apiKey) {
        await changeApi(baseUrl, apiKey);
    }
    getApiUrl() {
        return getCurrentBaseUrl();
    }
    getProvider() {
        return getProviderInfo();
    }
    async setLanguage(lang) {
        await changeLang(lang);
    }
}
