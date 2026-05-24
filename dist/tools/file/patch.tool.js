// File: src/tools/file/patch.tool.ts
import { readFile as readFileNode, writeFile as writeFileNode } from 'node:fs/promises';
import { relative } from 'node:path';
import { getCwd, getAgentMode, shouldSkipWriteApproval, setPendingApproval, pushUndoSnapshot, resolveProjectPath } from '../../state.js';
export class PatchTool {
    name;
    constructor(name = 'patchFile') {
        this.name = name;
    }
    description = 'Patch a file by replacing specific line ranges with new content. Useful for precise and partial edits.';
    parameters = {
        type: 'object',
        additionalProperties: false,
        properties: {
            path: {
                type: 'string',
                description: 'Relative or absolute path to the file.'
            },
            patches: {
                type: 'array',
                description: 'List of line range replacements, sorted or unsorted. Will be applied from bottom to top.',
                items: {
                    type: 'object',
                    properties: {
                        startLine: {
                            type: 'number',
                            description: 'The 1-based start line number (inclusive).'
                        },
                        endLine: {
                            type: 'number',
                            description: 'The 1-based end line number (inclusive).'
                        },
                        replace: {
                            type: 'string',
                            description: 'The replacement text.'
                        }
                    },
                    required: ['startLine', 'endLine', 'replace']
                }
            }
        },
        required: ['path', 'patches']
    };
    async execute(args, context) {
        try {
            const { path: pathArg, patches: patchesArg } = args;
            if (typeof pathArg !== 'string' || !Array.isArray(patchesArg)) {
                return {
                    success: false,
                    output: '',
                    error: 'Arguments "path" (string) and "patches" (array) are required.'
                };
            }
            const absolutePath = resolveProjectPath(pathArg);
            const displayPathName = this.displayPath(absolutePath);
            const mode = getAgentMode();
            const skipApproval = shouldSkipWriteApproval(mode);
            let oldContent = '';
            try {
                oldContent = await readFileNode(absolutePath, 'utf8');
            }
            catch (err) {
                return {
                    success: false,
                    output: '',
                    error: `Failed to read file ${displayPathName} for patching: ${err.message}`
                };
            }
            const lines = oldContent.split('\n');
            // Sort patches from bottom to top to preserve line numbering of earlier edits
            const sortedPatches = [...patchesArg].sort((a, b) => b.startLine - a.startLine);
            for (const patch of sortedPatches) {
                const { startLine, endLine, replace } = patch;
                if (typeof startLine !== 'number' ||
                    typeof endLine !== 'number' ||
                    typeof replace !== 'string') {
                    return {
                        success: false,
                        output: '',
                        error: 'Each patch must contain startLine (number), endLine (number), and replace (string).'
                    };
                }
                if (startLine < 1 || startLine > lines.length || endLine < startLine || endLine > lines.length) {
                    return {
                        success: false,
                        output: '',
                        error: `Invalid line range [${startLine}, ${endLine}] for file with ${lines.length} lines.`
                    };
                }
                // 1-based index conversion to 0-based
                const startIndex = startLine - 1;
                const endIndex = endLine; // exclusive slice range
                const replacementLines = replace.split('\n');
                lines.splice(startIndex, endIndex - startIndex, ...replacementLines);
            }
            const newContent = lines.join('\n');
            // Calculate diff lines added/removed
            const { added, removed } = this.countDiffLines(oldContent, newContent);
            const diff = this.createMiniDiff(displayPathName, oldContent, newContent);
            // Handle approval in auto mode
            if (mode === 'auto' && !skipApproval) {
                const approval = setPendingApproval({
                    type: 'writeFile',
                    path: pathArg,
                    content: newContent,
                    diff,
                    isNew: false,
                    linesAdded: added,
                    linesRemoved: removed,
                    toolCallId: context?.toolCallId || `${this.name}-${Date.now()}`
                });
                return {
                    success: true,
                    output: JSON.stringify({
                        ok: false,
                        needsApproval: true,
                        approvalId: approval.id,
                        path: displayPathName,
                        isNew: false
                    })
                };
            }
            // Snapshot for undo stack
            pushUndoSnapshot({
                path: absolutePath,
                displayPath: displayPathName,
                existed: true,
                previousContent: oldContent
            });
            await writeFileNode(absolutePath, newContent, 'utf8');
            return {
                success: true,
                output: JSON.stringify({
                    ok: true,
                    path: displayPathName,
                    bytes: Buffer.byteLength(newContent, 'utf8'),
                    isNew: false,
                    linesAdded: added,
                    linesRemoved: removed,
                    diff
                })
            };
        }
        catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    displayPath(path) {
        const relativePath = relative(getCwd(), path);
        return relativePath || '.';
    }
    countDiffLines(oldContent, newContent) {
        const oldArr = oldContent.split('\n');
        const newArr = newContent.split('\n');
        const oldFreq = new Map();
        for (const line of oldArr) {
            oldFreq.set(line, (oldFreq.get(line) ?? 0) + 1);
        }
        let added = 0;
        for (const line of newArr) {
            const count = oldFreq.get(line) ?? 0;
            if (count > 0) {
                oldFreq.set(line, count - 1);
            }
            else {
                added++;
            }
        }
        let removed = 0;
        for (const count of oldFreq.values()) {
            removed += count;
        }
        return { added, removed };
    }
    createMiniDiff(path, oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const header = `patched ${path}`;
        const diffLines = [header];
        let prefix = 0;
        while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
            prefix += 1;
        }
        let oldSuffix = oldLines.length - 1;
        let newSuffix = newLines.length - 1;
        while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
            oldSuffix -= 1;
            newSuffix -= 1;
        }
        const removedBlock = oldLines.slice(prefix, oldSuffix + 1);
        const addedBlock = newLines.slice(prefix, newSuffix + 1);
        const removed = removedBlock.slice(0, 5);
        const added = addedBlock.slice(0, 5);
        const pairs = Math.max(removed.length, added.length);
        for (let i = 0; i < pairs; i++) {
            if (removed[i]) {
                diffLines.push(`- ${removed[i]}`);
            }
            if (added[i]) {
                diffLines.push(`+ ${added[i]}`);
            }
        }
        if (diffLines.length === 1) {
            diffLines.push('no visible line diff');
        }
        return this.appendTruncation(diffLines, Math.max(0, removedBlock.length - removed.length) + Math.max(0, addedBlock.length - added.length));
    }
    appendTruncation(lines, hiddenCount) {
        if (hiddenCount > 0) {
            lines.push(`... ${hiddenCount} more line(s)`);
        }
        return lines;
    }
}
