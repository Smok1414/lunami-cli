// File: src/state/mode.ts
// Agent execution-mode state.

export type AgentMode = 'plan' | 'auto' | 'yolo' | 'lunatic';

let agentMode: AgentMode = 'auto';

export function getAgentMode(): AgentMode {
  return agentMode;
}

export function setAgentMode(mode: AgentMode): AgentMode {
  agentMode = mode;
  return agentMode;
}

export function agentSkipsApprovals(mode: AgentMode): boolean {
  return mode === 'yolo';
}

export function shouldSkipWriteApproval(mode: AgentMode): boolean {
  return (
    agentSkipsApprovals(mode) ||
    mode === 'lunatic' ||
    process.env.LUNAMI_YES === '1' ||
    process.env.LUNAMI_AUTO_APPROVE_WRITES === '1'
  );
}
