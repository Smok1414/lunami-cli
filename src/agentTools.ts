import type { LLMTool } from './llm.js';
import { tools as builtinTools } from './llm.js';
import type { AgentMode } from './state.js';
import { getMcpManager } from './mcp/manager.js';

export async function getAgentTools(mode: AgentMode): Promise<LLMTool[]> {
  if (mode === 'plan') {
    return [];
  }

  const mcpTools = await getMcpManager().getLlmTools();
  return [...builtinTools, ...mcpTools];
}
