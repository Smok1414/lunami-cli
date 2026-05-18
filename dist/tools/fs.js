import { mkdir, readFile as readFileNode, rm, writeFile as writeFileNode } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { getCwd, popUndoSnapshot, pushUndoSnapshot, resolveProjectPath } from '../state.js';
export async function readFile(path) {
    const absolutePath = resolveProjectPath(path);
    const content = await readFileNode(absolutePath, 'utf8');
    return {
        ok: true,
        path: displayPath(absolutePath),
        content
    };
}
export async function previewWrite(path, content) {
    const absolutePath = resolveProjectPath(path);
    let isNew = true;
    let oldContent = null;
    try {
        oldContent = await readFileNode(absolutePath, 'utf8');
        isNew = false;
    }
    catch {
        // New file.
    }
    const { added, removed } = isNew
        ? { added: countLines(content), removed: 0 }
        : countDiffLines(oldContent ?? '', content);
    return {
        path: displayPath(absolutePath),
        isNew,
        linesAdded: added,
        linesRemoved: removed,
        diff: createMiniDiff(displayPath(absolutePath), oldContent ?? '', content, isNew)
    };
}
export async function writeFile(path, content) {
    const absolutePath = resolveProjectPath(path);
    let isNew = true;
    let oldContent = null;
    try {
        oldContent = await readFileNode(absolutePath, 'utf8');
        isNew = false;
    }
    catch {
        // New file.
    }
    pushUndoSnapshot({
        path: absolutePath,
        displayPath: displayPath(absolutePath),
        existed: !isNew,
        previousContent: oldContent
    });
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFileNode(absolutePath, content, 'utf8');
    const { added, removed } = isNew
        ? { added: countLines(content), removed: 0 }
        : countDiffLines(oldContent ?? '', content);
    return {
        ok: true,
        path: displayPath(absolutePath),
        bytes: Buffer.byteLength(content, 'utf8'),
        isNew,
        linesAdded: added,
        linesRemoved: removed,
        diff: createMiniDiff(displayPath(absolutePath), oldContent ?? '', content, isNew)
    };
}
export async function undoLastWrite() {
    const snapshot = popUndoSnapshot();
    if (!snapshot) {
        throw new Error('Nothing to undo.');
    }
    if (snapshot.existed) {
        await mkdir(dirname(snapshot.path), { recursive: true });
        await writeFileNode(snapshot.path, snapshot.previousContent ?? '', 'utf8');
        return {
            ok: true,
            path: snapshot.displayPath,
            action: 'restored'
        };
    }
    await rm(snapshot.path, { force: true });
    return {
        ok: true,
        path: snapshot.displayPath,
        action: 'deleted'
    };
}
function countLines(text) {
    if (text.length === 0) {
        return 0;
    }
    return text.split('\n').length;
}
function countDiffLines(oldContent, newContent) {
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
function displayPath(path) {
    const relativePath = relative(getCwd(), path);
    return relativePath || '.';
}
function createMiniDiff(path, oldContent, newContent, isNew) {
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
        return appendTruncation(diffLines, Math.max(0, newLines.length - 8));
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
    const removedBlock = oldLines.slice(prefix, oldSuffix + 1).filter((line) => line.length > 0);
    const addedBlock = newLines.slice(prefix, newSuffix + 1).filter((line) => line.length > 0);
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
    return appendTruncation(diffLines, Math.max(0, removedBlock.length - removed.length) + Math.max(0, addedBlock.length - added.length));
}
function appendTruncation(lines, hiddenCount) {
    if (hiddenCount > 0) {
        lines.push(`... ${hiddenCount} more line(s)`);
    }
    return lines;
}
