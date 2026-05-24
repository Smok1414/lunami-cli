import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AgentService } from './app/agent/agent.service.js';
import type { AgentRunOptions } from './types/index.js';

export type { AgentEvent, AgentRunOptions, AgentStatus } from './types/index.js';

const agentService = new AgentService();

export async function runAgent(options: AgentRunOptions): Promise<ChatCompletionMessageParam[]> {
  return agentService.run(options);
}
