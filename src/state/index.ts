// File: src/state/index.ts
// Aggregated state barrel. Each concern lives in its own module:
//   ./cwd        — workspace root + cwd + path resolution
//   ./mode       — agent execution mode (plan / auto / yolo / lunatic)
//   ./approvals  — pending dangerous-action approvals
//   ./undo       — bounded undo stack for writes
//   ./context    — project/auto/rules markdown context

export * from './cwd.js';
export * from './mode.js';
export * from './approvals.js';
export * from './undo.js';
export * from './context.js';
