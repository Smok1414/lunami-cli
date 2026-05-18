const toolIcons = {
    read: 'R',
    write: 'W',
    exec: '$',
    git: 'G',
    tree: 'T',
    gen: '+',
    approve: '!',
    tool: '·'
};
export function getToolKind(text) {
    const lower = text.toLowerCase();
    if (lower.includes('approval required')) {
        return 'approve';
    }
    if (lower.includes('scaffold') || lower.includes('generateproject')) {
        return 'gen';
    }
    if (lower.includes('git ') || lower.startsWith('git') || lower.includes('git commit') || lower.includes('git diff') || lower.includes('git status')) {
        return 'git';
    }
    if (text.includes('├──') || text.includes('└──') || lower.includes('listtree')) {
        return 'tree';
    }
    if (lower.includes('command finished') || lower.includes('execcommand') || lower.includes('◇ tool: exec')) {
        return 'exec';
    }
    if (/\b(read|\.read)\b/.test(lower) || lower.endsWith(' read')) {
        return 'read';
    }
    if (lower.includes('write') || lower.includes(' created') || lower.includes(' updated') || lower.includes('writefile')) {
        return 'write';
    }
    return 'tool';
}
export function getToolIcon(text) {
    return toolIcons[getToolKind(text)];
}
export function shortenPath(path, maxLen = 42) {
    const normalized = path.replace(/\\/g, '/');
    if (normalized.length <= maxLen) {
        return normalized;
    }
    const parts = normalized.split('/');
    const file = parts.pop() ?? normalized;
    let prefix = parts.join('/');
    while (prefix.length > 8 && parts.length > 1) {
        parts.shift();
        prefix = `…/${parts.join('/')}`;
        if (`${prefix}/${file}`.length <= maxLen) {
            return `${prefix}/${file}`;
        }
    }
    const keep = Math.max(8, maxLen - file.length - 4);
    return `…${normalized.slice(-keep)}/${file}`;
}
export function splitCodeBlocks(text) {
    const segments = [];
    const parts = text.split(/(```[\s\S]*?```)/g);
    for (const part of parts) {
        if (part.startsWith('```') && part.endsWith('```')) {
            const inner = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
            segments.push({ text: inner, code: true });
        }
        else if (part.length > 0) {
            segments.push({ text: part, code: false });
        }
    }
    return segments.length > 0 ? segments : [{ text, code: false }];
}
export function fuzzyMatch(query, target) {
    if (!query || query === '/') {
        return true;
    }
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i += 1) {
        if (t[i] === q[qi]) {
            qi += 1;
        }
    }
    return qi === q.length;
}
export function fuzzyHighlightParts(text, query) {
    if (!query || query === '/') {
        return [{ text, match: false }];
    }
    const q = query.toLowerCase();
    const parts = [];
    let qi = 0;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const isMatch = qi < q.length && char.toLowerCase() === q[qi];
        if (isMatch) {
            qi += 1;
        }
        const last = parts[parts.length - 1];
        if (last && last.match === isMatch) {
            last.text += char;
        }
        else {
            parts.push({ text: char, match: isMatch });
        }
    }
    return parts.length > 0 ? parts : [{ text, match: false }];
}
export function formatDiffLine(line) {
    if (line.startsWith('+ ')) {
        return { gutter: '+', body: line.slice(2), kind: 'add' };
    }
    if (line.startsWith('- ')) {
        return { gutter: '-', body: line.slice(2), kind: 'remove' };
    }
    return { gutter: ' ', body: line, kind: 'neutral' };
}
export const toolCollapseThreshold = 12;
/** Не сворачивать дерево каталогов и короткие статусы. */
export function shouldCollapseToolOutput(text, lineCount) {
    if (lineCount <= toolCollapseThreshold) {
        return false;
    }
    if (/[├└│]/.test(text) || text.includes('├──') || text.includes('└──')) {
        return false;
    }
    if (text.length < 400) {
        return false;
    }
    return true;
}
