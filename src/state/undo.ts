// File: src/state/undo.ts
// Bounded undo stack for the last 30 file writes.

export type UndoSnapshot = {
  path: string;
  displayPath: string;
  existed: boolean;
  previousContent: string | null;
};

const undoStack: UndoSnapshot[] = [];
const MAX_UNDO = 30;

export function pushUndoSnapshot(snapshot: UndoSnapshot): void {
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
}

export function popUndoSnapshot(): UndoSnapshot | undefined {
  return undoStack.pop();
}

export function hasUndoSnapshot(): boolean {
  return undoStack.length > 0;
}
