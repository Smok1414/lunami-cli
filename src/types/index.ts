// File: src/types/index.ts

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type AgentStatus = 'IDLE' | 'ACTIVE' | 'TOOL' | 'DONE' | 'ERROR';

export type AgentMode = 'plan' | 'auto' | 'yolo' | 'lunatic';

export type ActivityStepKind = 'planning' | 'thought' | 'work';
export type ActivityStepStatus = 'active' | 'done' | 'success' | 'failure';

export interface ActivityStep {
  id: string;
  kind: ActivityStepKind;
  label: string;
  status: ActivityStepStatus;
  startedAt?: number;
  durationSec?: number;
  durationMs?: number;
}

export type AgentEvent =
  | {
      type: 'status';
      status: AgentStatus;
      label?: string;
      chain?: { names: string[]; activeIndex: number };
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'assistant';
      content: string;
    }
  | {
      type: 'assistant_start';
      id: string;
    }
  | {
      type: 'assistant_delta';
      id: string;
      delta: string;
    }
  | {
      type: 'assistant_done';
      id: string;
    }
  | {
      type: 'tool_start';
      name: string;
      summary: string;
    }
  | {
      type: 'tool';
      name: string;
      summary: string;
    }
  | {
      type: 'progress';
      value: number;
    }
  | {
      type: 'tokens';
      total: number;
      prompt?: number;
      completion?: number;
    }
  | {
      type: 'activity';
      steps: ActivityStep[];
    };

export interface AgentRunOptions {
  input?: string;
  mentionPreamble?: string;
  history: ChatCompletionMessageParam[];
  sessionName?: string;
  mode?: AgentMode;
  maxRounds?: number;
  skipWriteApproval?: boolean;
  onEvent: (event: AgentEvent) => void;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export type PendingApproval =
  | {
      id: string;
      type: 'execCommand';
      command: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'gitCommit';
      message: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'writeFile';
      path: string;
      content: string;
      diff: string[];
      isNew: boolean;
      linesAdded: number;
      linesRemoved: number;
      toolCallId: string;
      createdAt: string;
    };

export type PendingApprovalInput =
  | {
      type: 'execCommand';
      command: string;
    }
  | {
      type: 'gitCommit';
      message: string;
    }
  | {
      type: 'writeFile';
      path: string;
      content: string;
      diff: string[];
      isNew: boolean;
      linesAdded: number;
      linesRemoved: number;
      toolCallId: string;
    };

export interface UndoSnapshot {
  path: string;
  displayPath: string;
  existed: boolean;
  previousContent: string | null;
}
