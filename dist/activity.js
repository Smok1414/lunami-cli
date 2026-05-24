import { t } from './i18n.js';
export function createEmptyToolCounts() {
    return {
        readFile: 0,
        tree: 0,
        search: 0,
        writeFile: 0,
        execCommand: 0,
        git: 0,
        other: 0
    };
}
export function bumpToolCount(counts, toolName) {
    if (toolName === 'readFile' || toolName === 'file.read') {
        counts.readFile += 1;
        return;
    }
    if (toolName === 'tree') {
        counts.tree += 1;
        return;
    }
    if (toolName === 'search') {
        counts.search += 1;
        return;
    }
    if (toolName === 'writeFile' || toolName === 'file.write') {
        counts.writeFile += 1;
        return;
    }
    if (toolName === 'execCommand' || toolName === 'system.exec') {
        counts.execCommand += 1;
        return;
    }
    if (toolName === 'gitStatus' || toolName === 'gitDiff' || toolName === 'gitCommit') {
        counts.git += 1;
        return;
    }
    counts.other += 1;
}
export function formatWorkLabel(counts) {
    const parts = [];
    const reads = counts.readFile + counts.tree;
    if (reads > 0) {
        parts.push(t('activity_read_files', reads));
    }
    if (counts.search > 0) {
        parts.push(t('activity_searches', counts.search));
    }
    if (counts.writeFile > 0) {
        parts.push(t('activity_writes', counts.writeFile));
    }
    if (counts.execCommand > 0) {
        parts.push(t('activity_commands', counts.execCommand));
    }
    if (counts.git > 0) {
        parts.push(t('activity_git_ops', counts.git));
    }
    if (counts.other > 0) {
        parts.push(t('activity_other_tools', counts.other));
    }
    return parts.length > 0 ? parts.join(', ') : t('activity_tools');
}
export function formatStepLine(step) {
    if (step.status === 'active') {
        return step.label;
    }
    const duration = step.durationSec ?? 0;
    const suffix = duration > 0 ? ` ${duration}s` : '';
    return `${step.label}${suffix}`;
}
export function finishActivityStep(steps, id, startedAt) {
    const step = steps.find((entry) => entry.id === id);
    if (!step) {
        return;
    }
    step.status = 'done';
    step.durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}
