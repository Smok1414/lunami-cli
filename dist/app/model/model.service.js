// File: src/app/model/model.service.ts
import { changeModel, getProviderInfo } from '../../llm.js';
import { fetchDynamicGroups, fallbackGroups } from '../../config/models.config.js';
export class ModelService {
    async setModel(modelName) {
        await changeModel(modelName);
    }
    getActiveModel() {
        return getProviderInfo().model;
    }
    async getModelGroups() {
        const dynamicGroups = await fetchDynamicGroups();
        return dynamicGroups || fallbackGroups;
    }
}
