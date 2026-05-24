// File: src/tools/file/read.tool.ts

import { readFile as readFileNode } from 'node:fs/promises';
import { relative } from 'node:path';
import { getCwd, resolveProjectPath } from '../../state.js';
import type { ITool } from '../../core/tools/tool.interface.js';
import type { ToolResult } from '../../types/index.js';

export class ReadTool implements ITool {
  public readonly name: string;

  constructor(name = 'readFile') {
    this.name = name;
  }
  public readonly description = 'Read a UTF-8 text file from the current project workspace.';
  public readonly parameters = {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: {
        type: 'string',
        description: 'Relative or absolute path to the file.'
      }
    },
    required: ['path']
  };

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const pathArg = args.path;
      if (typeof pathArg !== 'string') {
        return {
          success: false,
          output: '',
          error: 'Argument "path" must be a string.'
        };
      }

      const absolutePath = resolveProjectPath(pathArg);
      const content = await readFileNode(absolutePath, 'utf8');

      return {
        success: true,
        output: content
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
