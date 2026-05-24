// File: src/tools/file/write.tool.ts
import { mkdir, writeFile as writeFileNode, readFile as readFileNode } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { getCwd, getAgentMode, shouldSkipWriteApproval, setPendingApproval, pushUndoSnapshot, resolveProjectPath } from '../../state.js';
export class WriteTool {
    name;
    constructor(name = 'writeFile') {
        this.name = name;
    }
    description = 'Write UTF-8 text content to a file in the current project workspace. Creates parent folders if needed.';
    parameters = {
        type: 'object',
        additionalProperties: false,
        properties: {
            path: {
                type: 'string',
                description: 'Relative or absolute path to the file. IMPORTANT: You MUST provide this argument BEFORE content to prevent truncation.'
            },
            content: {
                type: 'string',
                description: 'Complete file contents.'
            }
        },
        required: ['path', 'content']
    };
    async execute(args, context) {
        try {
            const { path: pathArg, content: contentArg } = args;
            if (typeof pathArg !== 'string' || typeof contentArg !== 'string') {
                return {
                    success: false,
                    output: '',
                    error: 'Arguments "path" and "content" must be strings.'
                };
            }
            const absolutePath = resolveProjectPath(pathArg);
            const displayPathName = this.displayPath(absolutePath);
            const mode = getAgentMode();
            const skipApproval = shouldSkipWriteApproval(mode);
            let isNew = true;
            let oldContent = null;
            try {
                oldContent = await readFileNode(absolutePath, 'utf8');
                isNew = false;
            }
            catch {
                // File does not exist, so it's a new file.
            }
            const { added, removed } = isNew
                ? { added: this.countLines(contentArg), removed: 0 }
                : this.countDiffLines(oldContent ?? '', contentArg);
            const diff = this.createMiniDiff(displayPathName, oldContent ?? '', contentArg, isNew);
            if (mode === 'auto' && !skipApproval) {
                const approval = setPendingApproval({
                    type: 'writeFile',
                    path: pathArg,
                    content: contentArg,
                    diff,
                    isNew,
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
                        isNew
                    })
                };
            }
            pushUndoSnapshot({
                path: absolutePath,
                displayPath: displayPathName,
                existed: !isNew,
                previousContent: oldContent
            });
            await mkdir(dirname(absolutePath), { recursive: true });
            await writeFileNode(absolutePath, contentArg, 'utf8');
            return {
                success: true,
                output: JSON.stringify({
                    ok: true,
                    path: displayPathName,
                    bytes: Buffer.byteLength(contentArg, 'utf8'),
                    isNew,
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
    countLines(text) {
        if (text.length === 0)
            return 0;
        return text.split('\n').length;
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
    displayPath(path) {
        const relativePath = relative(getCwd(), path);
        return relativePath || '.';
    }
    createMiniDiff(path, oldContent, newContent, isNew) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const header = `${isNew ? 'created' : 'modified'} ${path}`;
        const diffLines = [header];
        if (isNew) {
            for (const line of newLines.slice(0, 8)) {
                if (line.length > 0) {
                    diffLines.push(`+ ${line}`);
                }
            }
            return this.appendTruncation(diffLines, Math.max(0, newLines.length - 8));
        }
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
