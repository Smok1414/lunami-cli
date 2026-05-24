// File: src/core/agent/executor.ts
import { ToolRegistry } from '../tools/registry.js';
export class Executor {
    registry;
    constructor() {
        this.registry = ToolRegistry.getInstance();
    }
    async execute(toolCall) {
        if (!toolCall.name) {
            return {
                success: false,
                output: '',
                error: 'Tool call is missing a tool name.'
            };
        }
        if (!toolCall.arguments || typeof toolCall.arguments !== 'object' || Array.isArray(toolCall.arguments)) {
            return {
                success: false,
                output: '',
                error: `Tool "${toolCall.name}" received invalid arguments. Expected an object.`
            };
        }
        return this.registry.execute(toolCall.name, toolCall.arguments, { toolCallId: toolCall.id });
    }
}
