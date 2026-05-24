// File: src/cli/commands/model.command.ts
import { ModelService } from '../../app/model/model.service.js';
export class ModelCommand {
    modelService;
    constructor() {
        this.modelService = new ModelService();
    }
    async setModel(modelName) {
        await this.modelService.setModel(modelName);
    }
    getActiveModel() {
        return this.modelService.getActiveModel();
    }
    async getModelGroups() {
        return this.modelService.getModelGroups();
    }
}
