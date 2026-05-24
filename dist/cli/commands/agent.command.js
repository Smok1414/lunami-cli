// File: src/cli/commands/agent.command.ts
import { AgentService } from '../../app/agent/agent.service.js';
import { setAgentMode } from '../../state.js';
export class AgentCommand {
    agentService;
    constructor() {
        this.agentService = new AgentService();
    }
    setMode(mode) {
        setAgentMode(mode);
    }
    getPendingApproval() {
        return this.agentService.getPendingApproval();
    }
    approve() {
        this.agentService.clearPendingApproval();
    }
    deny() {
        this.agentService.clearPendingApproval();
    }
}
