// File: src/app/agent/agent.service.ts
import { runAgent } from '../../core/agent/agent.js';
import { LunaticEngine } from '../../core/agent/lunatic.js';
import { getAgentMode, getPendingApproval, clearPendingApproval } from '../../state.js';
export class AgentService {
    async run(options) {
        const mode = options.mode ?? getAgentMode();
        if (mode === 'lunatic') {
            return new LunaticEngine().run({ ...options, mode });
        }
        return runAgent({ ...options, mode });
    }
    getPendingApproval() {
        return getPendingApproval();
    }
    clearPendingApproval() {
        clearPendingApproval();
    }
}
