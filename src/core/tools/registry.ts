// File: src/core/tools/registry.ts

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ITool, ToolContext, ToolInput } from './tool.interface.js';
import type { ToolResult } from '../../types/index.js';
import { isValidLlmFunctionName } from '../../providers/requestSanitizer.js';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ITool> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: ITool): void {
    this.assertValidTool(tool);
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  public getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  public clear(): void {
    this.tools.clear();
  }

  public async execute(name: string, args: ToolInput, context?: ToolContext): Promise<ToolResult> {
    const tool = this.get(name);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool "${name}" is not registered in the central tool registry.`
      };
    }

    try {
      const result = await tool.execute(args, context);
      return this.normalizeResult(name, result);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  public getLlmTools(): ChatCompletionTool[] {
    return this.getAll()
      .filter((tool) => isValidLlmFunctionName(tool.name))
      .map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as ChatCompletionTool['function']['parameters']
        }
      }));
  }

  private assertValidTool(tool: ITool): void {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Cannot register an invalid tool.');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(tool.name)) {
      throw new Error(`Invalid tool name "${tool.name}".`);
    }

    if (typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      throw new Error(`Tool "${tool.name}" must have a description.`);
    }

    if (!tool.parameters || tool.parameters.type !== 'object') {
      throw new Error(`Tool "${tool.name}" must expose an object JSON schema.`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool "${tool.name}" must implement execute().`);
    }
  }

  private normalizeResult(name: string, result: ToolResult): ToolResult {
    if (!result || typeof result !== 'object') {
      return {
        success: false,
        output: '',
        error: `Tool "${name}" returned an invalid result object.`
      };
    }

    if (typeof result.success !== 'boolean' || typeof result.output !== 'string') {
      return {
        success: false,
        output: typeof result.output === 'string' ? result.output : '',
        error: `Tool "${name}" must return { success: boolean; output: string; error?: string }.`
      };
    }

    if (result.error !== undefined && typeof result.error !== 'string') {
      return {
        success: false,
        output: result.output,
        error: `Tool "${name}" returned a non-string error value.`
      };
    }

    return result;
  }
}
