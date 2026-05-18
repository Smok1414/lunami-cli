import { tools as builtinTools } from './llm.js';
import { getMcpManager } from './mcp/manager.js';
export async function getAgentTools(mode) {
    if (mode === 'plan') {
        return [];
    }
    const mcpTools = await getMcpManager().getLlmTools();
    return [...builtinTools, ...mcpTools];
}
