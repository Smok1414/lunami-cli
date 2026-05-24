// File: src/tools/file/read.tool.ts
import { readFile as readFileNode } from 'node:fs/promises';
import { resolveProjectPath } from '../../state.js';
export class ReadTool {
    name;
    constructor(name = 'readFile') {
        this.name = name;
    }
    description = 'Read a UTF-8 text file from the current project workspace.';
    parameters = {
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
    async execute(args) {
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
        }
        catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
