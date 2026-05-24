// File: src/app/model/model.service.ts

import { changeModel, getProviderInfo } from '../../llm.js';
import { fetchDynamicGroups, fallbackGroups, type ModelGroup } from '../../config/models.config.js';

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
}
