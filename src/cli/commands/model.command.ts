// File: src/cli/commands/model.command.ts

import { ModelService, type PullProgress, type PullResult } from '../../app/model/model.service.js';

export class ModelCommand {
  private readonly modelService: ModelService;

  constructor() {
    this.modelService = new ModelService();
  }

  public async setModel(modelName: string): Promise<void> {
    await this.modelService.setModel(modelName);
  }

  public getActiveModel(): string {
    return this.modelService.getActiveModel();
  }

  public async getModelGroups() {
    return this.modelService.getModelGroups();
  }

  public async pull(modelName: string, onProgress?: (chunk: PullProgress) => void): Promise<PullResult> {
    return this.modelService.pull(modelName, onProgress);
  }
}
