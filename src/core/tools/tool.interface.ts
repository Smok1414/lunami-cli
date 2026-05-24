// File: src/core/tools/tool.interface.ts

import type { ToolResult } from '../../types/index.js';

export type ToolInput = Record<string, unknown>;

export type ToolContext = {
  toolCallId?: string;
};

export type ToolParameters = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export interface ITool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute(args: ToolInput, context?: ToolContext): Promise<ToolResult>;
}
