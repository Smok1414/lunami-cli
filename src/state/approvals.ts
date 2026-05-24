// File: src/state/approvals.ts
// Pending-approval state for dangerous actions (writeFile, execCommand, gitCommit).

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

let pendingApproval: PendingApproval | null = null;

export function getPendingApproval(): PendingApproval | null {
  return pendingApproval;
}

export function setPendingApproval(approval: PendingApprovalInput): PendingApproval {
  pendingApproval = {
    ...approval,
    id: `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString()
  } as PendingApproval;

  return pendingApproval;
}

export function clearPendingApproval(): void {
  pendingApproval = null;
}
