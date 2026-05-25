// File: src/cli/commands/init.command.ts
//
// `lunami init` — interactive setup wizard. Runs before the TUI so new users
// can land on a working config in <30 seconds (provider + key + model + lang).
// Writes ~/.lunami/.env so it is reused across every workspace.

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getPrimaryEnvPath, readPrimaryEnvContent, writePrimaryEnvContent } from '../../envConfig.js';
import { upsertEnvLine } from '../../utils/helpers.js';

type Provider = 'openai' | 'anthropic' | 'ollama';

type WizardAnswers = {
  provider: Provider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  lang: 'en' | 'ru';
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5',
  ollama: 'llama3.2'
};

export class InitCommand {
  public async run(): Promise<number> {
    const rl = createInterface({ input, output });
    try {
      this.printIntro();
      const existing = await readPrimaryEnvContent();
      if (existing.trim().length > 0) {
        const overwrite = await this.confirm(rl, `~/.lunami/.env already exists. Overwrite?`, false);
        if (!overwrite) {
          output.write('\nCancelled. Existing config kept.\n');
          return 0;
        }
      }

      const answers = await this.collect(rl);
      const content = this.renderEnv(answers, existing);
      await writePrimaryEnvContent(content);

      output.write(`\n✓ Wrote ${getPrimaryEnvPath()}\n`);
      output.write(`  provider: ${answers.provider}\n`);
      output.write(`  model:    ${answers.model}\n`);
      output.write(`  language: ${answers.lang}\n\n`);
      output.write(`Run "lunami" to start.\n`);
      return 0;
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_USE_AFTER_CLOSE') {
        return 130;
      }
      output.write(`\nInit failed: ${(err as Error).message}\n`);
      return 1;
    } finally {
      rl.close();
    }
  }

  private printIntro(): void {
    output.write('\nLUNAMI setup\n');
    output.write('─────────────\n');
    output.write('This wizard writes ~/.lunami/.env so every workspace inherits the config.\n\n');
  }

  private async collect(rl: Interface): Promise<WizardAnswers> {
    const provider = await this.pickProvider(rl);
    const model = await this.ask(rl, `Model`, DEFAULT_MODELS[provider]);

    let apiKey: string | undefined;
    let baseUrl: string | undefined;

    if (provider === 'openai') {
      apiKey = (await this.askSecret(rl, `OpenAI API key (sk-...)`, '')) || undefined;
      const customBase = (await this.ask(rl, `Custom base URL (blank = default)`, '')).trim();
      baseUrl = customBase || undefined;
    } else if (provider === 'anthropic') {
      apiKey = (await this.askSecret(rl, `Anthropic API key (sk-ant-...)`, '')) || undefined;
    } else {
      baseUrl = (await this.ask(rl, `Ollama base URL`, 'http://localhost:11434')).trim();
    }

    const lang = (await this.ask(rl, `Language (en | ru)`, 'en')).trim().toLowerCase() === 'ru' ? 'ru' : 'en';

    return { provider, model, apiKey, baseUrl, lang };
  }

  private async pickProvider(rl: Interface): Promise<Provider> {
    output.write('Pick a provider:\n');
    output.write('  1) openai     (OpenAI / OpenAI-compatible / OmniRoute)\n');
    output.write('  2) anthropic  (Claude direct)\n');
    output.write('  3) ollama     (local model, no cloud key)\n');

    while (true) {
      const raw = (await rl.question('Choice [1]: ')).trim() || '1';
      if (raw === '1' || raw.toLowerCase() === 'openai') return 'openai';
      if (raw === '2' || raw.toLowerCase() === 'anthropic') return 'anthropic';
      if (raw === '3' || raw.toLowerCase() === 'ollama') return 'ollama';
      output.write('Please choose 1, 2, or 3.\n');
    }
  }

  private async ask(rl: Interface, label: string, defaultValue: string): Promise<string> {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const raw = (await rl.question(`${label}${suffix}: `)).trim();
    return raw || defaultValue;
  }

  private async askSecret(rl: Interface, label: string, defaultValue: string): Promise<string> {
    // readline does not provide built-in echo masking. We document the trade-off:
    // the wizard runs locally, the value is written to a file owned by the user.
    return this.ask(rl, label, defaultValue);
  }

  private async confirm(rl: Interface, label: string, defaultYes: boolean): Promise<boolean> {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const raw = (await rl.question(`${label} (${hint}) `)).trim().toLowerCase();
    if (!raw) return defaultYes;
    return raw === 'y' || raw === 'yes';
  }

  private renderEnv(answers: WizardAnswers, existing: string): string {
    let content = existing;
    content = upsertEnvLine(content, 'LLM_PROVIDER', answers.provider);
    content = upsertEnvLine(content, 'LLM_MODEL', answers.model);
    content = upsertEnvLine(content, 'LUNAMI_LANG', answers.lang);

    if (answers.provider === 'openai') {
      if (answers.apiKey) {
        content = upsertEnvLine(content, 'OPENAI_API_KEY', answers.apiKey);
      }
      if (answers.baseUrl) {
        content = upsertEnvLine(content, 'OPENAI_BASE_URL', answers.baseUrl);
      }
    } else if (answers.provider === 'anthropic') {
      if (answers.apiKey) {
        content = upsertEnvLine(content, 'ANTHROPIC_API_KEY', answers.apiKey);
      }
    } else {
      content = upsertEnvLine(content, 'OLLAMA_BASE_URL', answers.baseUrl ?? 'http://localhost:11434');
    }

    return content;
  }
}
