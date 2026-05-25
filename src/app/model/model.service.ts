// File: src/app/model/model.service.ts

import { spawn } from 'node:child_process';
import { changeModel, getProviderInfo, getProviderRuntimeConfig } from '../../llm.js';
import { fetchDynamicGroups, fallbackGroups, type ModelGroup } from '../../config/models.config.js';

export type PullProgress = {
  type: 'data' | 'error';
  text: string;
};

export type PullResult = {
  ok: boolean;
  provider: string;
  model: string;
  exitCode: number;
  message?: string;
};

export class ModelService {
  public async setModel(modelName: string): Promise<void> {
    await changeModel(modelName);
  }

  public getActiveModel(): string {
    return getProviderInfo().model;
  }

  public async getModelGroups(): Promise<ModelGroup[]> {
    const dynamicGroups = await fetchDynamicGroups();
    return dynamicGroups || fallbackGroups;
  }

  /**
   * Download a model for the active provider.
   *
   * Today only Ollama supports a real `pull` operation — cloud providers serve
   * their catalogue on demand, so we surface a clear, actionable message instead
   * of pretending to download. The wiring (router + CLI subcommand) is in place
   * so adding LM Studio / llama.cpp later is a one-method change.
   */
  public async pull(modelName: string, onProgress?: (chunk: PullProgress) => void): Promise<PullResult> {
    const trimmed = modelName.trim();
    const { provider } = getProviderRuntimeConfig();

    if (!trimmed) {
      return {
        ok: false,
        provider,
        model: trimmed,
        exitCode: 2,
        message: 'Model name is required: `lunami models pull <name>`'
      };
    }

    if (provider === 'ollama') {
      return this.pullOllama(trimmed, onProgress);
    }

    if (provider === 'anthropic') {
      return {
        ok: false,
        provider,
        model: trimmed,
        exitCode: 1,
        message:
          'Anthropic models are served on demand — no pull needed. ' +
          `Set LLM_MODEL=${trimmed} (or run \`lunami\` and use /model) and you are ready.`
      };
    }

    return {
      ok: false,
      provider,
      model: trimmed,
      exitCode: 1,
      message:
        `OpenAI-compatible providers serve "${trimmed}" on demand — no pull needed. ` +
        `Set LLM_MODEL=${trimmed} or run \`lunami\` and use /model.`
    };
  }

  private async pullOllama(modelName: string, onProgress?: (chunk: PullProgress) => void): Promise<PullResult> {
    return new Promise((resolve) => {
      const child = spawn('ollama', ['pull', modelName], { stdio: ['ignore', 'pipe', 'pipe'] });

      child.stdout.on('data', (chunk) => {
        onProgress?.({ type: 'data', text: chunk.toString() });
      });

      child.stderr.on('data', (chunk) => {
        onProgress?.({ type: 'error', text: chunk.toString() });
      });

      child.on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          resolve({
            ok: false,
            provider: 'ollama',
            model: modelName,
            exitCode: 127,
            message: 'ollama binary not found on PATH. Install from https://ollama.com/download'
          });
          return;
        }
        resolve({
          ok: false,
          provider: 'ollama',
          model: modelName,
          exitCode: 1,
          message: err.message
        });
      });

      child.on('close', (code) => {
        const exitCode = code ?? 0;
        resolve({
          ok: exitCode === 0,
          provider: 'ollama',
          model: modelName,
          exitCode,
          ...(exitCode === 0 ? {} : { message: `ollama pull exited with code ${exitCode}` })
        });
      });
    });
  }
}
