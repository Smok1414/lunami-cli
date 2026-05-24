// File: src/app/agent/agent.service.ts

import { runAgent } from '../../core/agent/agent.js';
import { LunaticEngine } from '../../core/agent/lunatic.js';
import type { AgentRunOptions } from '../../types/index.js';
import { getAgentMode, getPendingApproval, clearPendingApproval } from '../../state.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class AgentService {
  public async run(options: AgentRunOptions): Promise<ChatCompletionMessageParam[]> {
    const mode = options.mode ?? getAgentMode();

    if (mode === 'lunatic') {
      return new LunaticEngine().run({...options, mode});
    }
    return runAgent({...options, mode});
  }

  public getPendingApproval() {
    return getPendingApproval();
  }

  public clearPendingApproval() {
    clearPendingApproval();
  }
}
