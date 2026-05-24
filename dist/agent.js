import { AgentService } from './app/agent/agent.service.js';
const agentService = new AgentService();
export async function runAgent(options) {
    return agentService.run(options);
}
