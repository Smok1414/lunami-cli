// File: src/core/agent/executor.ts

import { ToolRegistry } from '../tools/registry.js';
import type { ToolResult } from '../../types/index.js';
import type { ToolInput } from '../tools/tool.interface.js';

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: ToolInput;
}

export class Executor {
  private registry: ToolRegistry;

  constructor() {
    this.registry = ToolRegistry.getInstance();
  }

  public async execute(toolCall: LlmToolCall): Promise<ToolResult> {
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
