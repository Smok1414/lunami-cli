// File: src/cli/commands/agent.command.ts

import { AgentService } from '../../app/agent/agent.service.js';
import { setAgentMode } from '../../state.js';

export class AgentCommand {
  private readonly agentService: AgentService;

  constructor() {
    this.agentService = new AgentService();
  }

  public setMode(mode: 'plan' | 'auto' | 'yolo' | 'lunatic'): void {
    setAgentMode(mode);
  }

  public getPendingApproval() {
    return this.agentService.getPendingApproval();
  }

  public approve(): void {
    this.agentService.clearPendingApproval();
  }

  public deny(): void {
    this.agentService.clearPendingApproval();
  }
}
