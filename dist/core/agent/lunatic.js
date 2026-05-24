// File: src/core/agent/lunatic.ts
import { mkdir, writeFile as writeFileNode, readFile as readFileNode, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Planner } from './planner.js';
import { Executor } from './executor.js';
import { Reflector } from './reflector.js';
import { ToolRegistry } from '../tools/registry.js';
import { streamComplete, systemPrompt } from '../../llm.js';
import { getCwd, getAgentMode, setPendingApproval, shouldSkipWriteApproval, resolveProjectPath } from '../../state.js';
import { initializeRegistry } from './agent.js';
const execPromise = promisify(exec);
export class LunaticEngine {
    planner;
    executor;
    reflector;
    constructor() {
        this.planner = new Planner();
        this.executor = new Executor();
        this.reflector = new Reflector();
    }
    async run(options) {
        initializeRegistry();
        const { input, mentionPreamble, history, sessionName, maxRounds = 30, onEvent } = options;
        const dryRun = options.dryRun === true;
        onEvent({ type: 'status', status: 'ACTIVE' });
        onEvent({ type: 'progress', value: 10 });
        // Load Memory
        const memory = await this.loadMemory();
        const memoryPrompt = this.buildMemoryPrompt(memory);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'system', content: `LUNATIC ENGINE. Working directory: ${getCwd()}. Dry-run: ${dryRun}.` },
            ...(memoryPrompt ? [{ role: 'system', content: memoryPrompt }] : []),
            ...(mentionPreamble ? [{ role: 'system', content: mentionPreamble }] : []),
            ...history,
            ...(input ? [{ role: 'user', content: input }] : [])
        ];
        // 1. Generate plan
        const context = `Task: ${input || ''}`;
        const plan = await this.planner.generatePlan(input || '', context, async (prompt) => {
            const resp = await streamComplete([{ role: 'user', content: prompt }], { intent: 'summary' });
            return resp.content;
        });
        onEvent({ type: 'progress', value: 20 });
        onEvent({
            type: 'activity',
            steps: [{ id: 'plan-step', kind: 'planning', label: `Plan generated: ${plan.length} steps`, status: 'done' }]
        });
        // Track original contents for rollback
        const originalContents = {};
        const modifiedFiles = new Set();
        const virtualFiles = {}; // for dry-run mode
        let linesAdded = 0;
        let linesRemoved = 0;
        const errorsList = [];
        const registryLlmTools = ToolRegistry.getInstance().getLlmTools();
        for (let round = 0; round < maxRounds; round++) {
            const streamId = this.createStreamId('assistant-lunatic');
            let streamedText = false;
            onEvent({ type: 'status', status: 'ACTIVE' });
            // Run LLM call
            let response;
            try {
                response = await streamComplete(messages, {
                    onTextDelta: (delta) => {
                        if (!streamedText) {
                            streamedText = true;
                            onEvent({ type: 'assistant_start', id: streamId });
                        }
                        onEvent({ type: 'assistant_delta', id: streamId, delta });
                    },
                    intent: 'agent_loop'
                }, registryLlmTools);
            }
            catch (err) {
                onEvent({ type: 'error', message: err.message || String(err) });
                throw err;
            }
            messages.push(response.message);
            if (streamedText) {
                onEvent({ type: 'assistant_done', id: streamId });
            }
            else if (response.content.trim()) {
                onEvent({ type: 'assistant', content: response.content.trim() });
            }
            if (response.toolCalls.length === 0) {
                break;
            }
            onEvent({ type: 'status', status: 'TOOL' });
            // Execute tool calls in batch
            for (const toolCall of response.toolCalls) {
                onEvent({ type: 'tool_start', name: toolCall.name, summary: `Executing ${toolCall.name}...` });
                const isWrite = ['writeFile', 'file.write', 'patchFile', 'file.patch'].includes(toolCall.name);
                if (isWrite) {
                    const filePath = toolCall.arguments.path;
                    if (filePath) {
                        const absolutePath = resolveProjectPath(filePath);
                        modifiedFiles.add(absolutePath);
                        // Capture original content if not already snapshotted
                        if (!(absolutePath in originalContents)) {
                            try {
                                const currentContent = await readFileNode(absolutePath, 'utf8');
                                originalContents[absolutePath] = currentContent;
                                virtualFiles[absolutePath] = currentContent;
                            }
                            catch {
                                originalContents[absolutePath] = null; // file didn't exist
                            }
                        }
                        // Estimate diff lines for confirmation logic
                        if (toolCall.name === 'writeFile' || toolCall.name === 'file.write') {
                            const content = toolCall.arguments.content;
                            if (content) {
                                const oldText = virtualFiles[absolutePath] || '';
                                const { added, removed } = this.countDiffLines(oldText, content);
                                linesAdded += added;
                                linesRemoved += removed;
                                virtualFiles[absolutePath] = content;
                            }
                        }
                        else if (toolCall.name === 'patchFile' || toolCall.name === 'file.patch') {
                            const patches = toolCall.arguments.patches;
                            if (Array.isArray(patches)) {
                                const oldText = virtualFiles[absolutePath] || '';
                                const lines = oldText.split('\n');
                                // Apply patch in memory to track virtual files and count diff
                                const sortedPatches = [...patches].sort((a, b) => b.startLine - a.startLine);
                                for (const p of sortedPatches) {
                                    const start = p.startLine - 1;
                                    const end = p.endLine;
                                    const replacementLines = p.replace.split('\n');
                                    lines.splice(start, end - start, ...replacementLines);
                                }
                                const newText = lines.join('\n');
                                const { added, removed } = this.countDiffLines(oldText, newText);
                                linesAdded += added;
                                linesRemoved += removed;
                                virtualFiles[absolutePath] = newText;
                            }
                        }
                    }
                }
                // Run the tool execution
                let result;
                if (dryRun && isWrite) {
                    // In dry-run mode, simulate the write without committing to disk
                    const filePath = toolCall.arguments.path;
                    result = {
                        success: true,
                        output: JSON.stringify({
                            ok: true,
                            path: filePath,
                            dryRun: true,
                            diff: [`[Dry-Run] Edits to ${filePath}`]
                        })
                    };
                }
                else {
                    result = await ToolRegistry.getInstance().execute(toolCall.name, toolCall.arguments, { toolCallId: toolCall.id });
                }
                onEvent({
                    type: 'tool',
                    name: toolCall.name,
                    summary: result.success ? `${toolCall.name} complete` : `error: ${result.error || 'Unknown error'}`
                });
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: result.success ? result.output : JSON.stringify({ ok: false, error: result.error })
                });
            }
            // Verification checks at the end of the round
            if (modifiedFiles.size > 0 && !dryRun) {
                onEvent({ type: 'status', status: 'ACTIVE', label: 'Verifying changes...' });
                let validRes = await this.verify(modifiedFiles);
                // Self-healing loop
                if (!validRes.valid) {
                    let selfHealed = false;
                    errorsList.push(validRes.error || 'Unknown verify error');
                    onEvent({ type: 'status', status: 'ACTIVE', label: 'Verification failed. Starting Self-Healing...' });
                    for (let attempt = 1; attempt <= 2; attempt++) {
                        onEvent({ type: 'status', status: 'ACTIVE', label: `Self-Healing attempt ${attempt}/2...` });
                        // Build the healing prompt
                        const repairPrompt = `Verification failed with the following compilation or test errors:\n\n${validRes.error}\n\nModified files: ${Array.from(modifiedFiles).map(f => relative(getCwd(), f)).join(', ')}.\nPlease analyze these errors and make precise code patches or writes using patchFile or writeFile tools to repair the broken code. Do not introduce new errors.`;
                        messages.push({ role: 'user', content: repairPrompt });
                        const healStreamId = this.createStreamId(`assistant-heal-${attempt}`);
                        let healStreamedText = false;
                        let healResponse;
                        try {
                            healResponse = await streamComplete(messages, {
                                onTextDelta: (delta) => {
                                    if (!healStreamedText) {
                                        healStreamedText = true;
                                        onEvent({ type: 'assistant_start', id: healStreamId });
                                    }
                                    onEvent({ type: 'assistant_delta', id: healStreamId, delta });
                                },
                                intent: 'agent_loop'
                            }, registryLlmTools);
                        }
                        catch (err) {
                            onEvent({ type: 'error', message: `Self-healing LLM call failed: ${err.message || String(err)}` });
                            break;
                        }
                        messages.push(healResponse.message);
                        if (healStreamedText) {
                            onEvent({ type: 'assistant_done', id: healStreamId });
                        }
                        else if (healResponse.content.trim()) {
                            onEvent({ type: 'assistant', content: healResponse.content.trim() });
                        }
                        if (healResponse.toolCalls.length === 0) {
                            break; // No healing tool calls returned
                        }
                        onEvent({ type: 'status', status: 'TOOL' });
                        // Execute healing tool calls
                        for (const toolCall of healResponse.toolCalls) {
                            onEvent({ type: 'tool_start', name: toolCall.name, summary: `[Healing] Executing ${toolCall.name}...` });
                            const healResult = await ToolRegistry.getInstance().execute(toolCall.name, toolCall.arguments, { toolCallId: toolCall.id });
                            onEvent({
                                type: 'tool',
                                name: toolCall.name,
                                summary: healResult.success ? `[Healing] ${toolCall.name} complete` : `[Healing] error: ${healResult.error || 'Unknown error'}`
                            });
                            messages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: healResult.success ? healResult.output : JSON.stringify({ ok: false, error: healResult.error })
                            });
                        }
                        // Verify again
                        validRes = await this.verify(modifiedFiles);
                        if (validRes.valid) {
                            selfHealed = true;
                            onEvent({ type: 'status', status: 'ACTIVE', label: 'Self-Healing succeeded! Verification passed.' });
                            break;
                        }
                        else {
                            errorsList.push(validRes.error || `Attempt ${attempt} verify error`);
                        }
                    }
                    if (!selfHealed) {
                        // Self-healing failed -> Rollback
                        onEvent({ type: 'error', message: `Self-healing failed: ${validRes.error}. Rolling back all changes...` });
                        await this.rollback(originalContents);
                        messages.push({
                            role: 'assistant',
                            content: `Verification failed & self-healing was unable to repair the code:\n${validRes.error}\nAll changes have been safely rolled back.`
                        });
                        await this.saveMemoryEntry(input || '', false, Array.from(modifiedFiles), errorsList);
                        onEvent({ type: 'status', status: 'ERROR' });
                        return messages.filter((m) => m.role !== 'system');
                    }
                }
            }
        }
        // Safety guard 1: Empty changes check
        if (modifiedFiles.size === 0) {
            onEvent({ type: 'error', message: 'Lunatic Engine finished but no files were changed.' });
            messages.push({ role: 'assistant', content: 'No changes were made to files.' });
            return messages.filter((m) => m.role !== 'system');
        }
        // Safety guard 2: Large change check confirmation
        const tooManyChanges = modifiedFiles.size > 5 || (linesAdded + linesRemoved) > 500;
        if (tooManyChanges && !dryRun && !shouldSkipWriteApproval(getAgentMode())) {
            const diffSummary = Array.from(modifiedFiles).map(f => relative(getCwd(), f));
            const approval = setPendingApproval({
                type: 'writeFile',
                path: '[Lunatic Batch Changes]',
                content: '',
                diff: ['Proposed changes:', ...diffSummary.map(f => `* ${f}`), `Total lines added: +${linesAdded}`, `Total lines removed: -${linesRemoved}`],
                isNew: false,
                linesAdded,
                linesRemoved,
                toolCallId: `lunatic-batch-${Date.now()}`
            });
            onEvent({
                type: 'tool',
                name: 'lunaticBatch',
                summary: `Approval required for lunatic engine batch changes. approvalId: ${approval.id}`
            });
            return messages.filter((m) => m.role !== 'system');
        }
        // 4. Save Snapshot to disk
        if (modifiedFiles.size > 0 && !dryRun) {
            await this.saveSnapshot(input || '', originalContents);
        }
        // Update memory upon success
        await this.saveMemoryEntry(input || '', true, Array.from(modifiedFiles), errorsList);
        onEvent({ type: 'status', status: 'DONE' });
        onEvent({ type: 'progress', value: 100 });
        return messages.filter((m) => m.role !== 'system');
    }
    async verify(modifiedFiles) {
        let runTypecheck = false;
        let runTest = false;
        for (const file of modifiedFiles) {
            const ext = file.split('.').pop() || '';
            if (['ts', 'tsx'].includes(ext)) {
                runTypecheck = true;
            }
            if (['ts', 'tsx', 'js', 'jsx', 'py', 'go'].includes(ext)) {
                runTest = true;
            }
        }
        try {
            if (runTypecheck) {
                try {
                    await execPromise('npm run typecheck');
                }
                catch (err) {
                    return { valid: false, error: `Typecheck failed:\n${err.stdout || err.stderr || err.message}` };
                }
            }
            if (runTest) {
                try {
                    await execPromise('npm run test');
                }
                catch (err) {
                    return { valid: false, error: `Test suite failed:\n${err.stdout || err.stderr || err.message}` };
                }
            }
        }
        catch (err) {
            return { valid: false, error: err.message || String(err) };
        }
        return { valid: true };
    }
    createStreamId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    async rollback(originalContents) {
        for (const [filePath, content] of Object.entries(originalContents)) {
            if (content === null) {
                // File did not exist before -> delete it
                try {
                    await rm(filePath, { force: true });
                }
                catch { }
            }
            else {
                // Restore original content
                try {
                    await writeFileNode(filePath, content, 'utf8');
                }
                catch { }
            }
        }
    }
    async saveSnapshot(task, originalContents) {
        try {
            const snapshotDir = resolve(getCwd(), '.lunatic', 'snapshots');
            await mkdir(snapshotDir, { recursive: true });
            const snapshot = {
                timestamp: new Date().toISOString(),
                task,
                files: originalContents
            };
            const filename = `${Date.now()}_snapshot.json`;
            await writeFileNode(join(snapshotDir, filename), JSON.stringify(snapshot, null, 2), 'utf8');
        }
        catch {
            // Ignore snapshot write issues
        }
    }
    async loadMemory() {
        try {
            const memoryPath = resolve(getCwd(), '.lunatic', 'memory.json');
            const text = await readFileNode(memoryPath, 'utf8');
            return JSON.parse(text);
        }
        catch {
            return { history: [] };
        }
    }
    async saveMemoryEntry(task, success, modifiedFiles, errors) {
        try {
            const lunaticDir = resolve(getCwd(), '.lunatic');
            await mkdir(lunaticDir, { recursive: true });
            const memory = await this.loadMemory();
            const relativeFiles = modifiedFiles.map(f => relative(getCwd(), f));
            const newEntry = {
                task,
                timestamp: new Date().toISOString(),
                success,
                modifiedFiles: relativeFiles,
                errors: errors.map(e => e.slice(0, 500)) // truncate large traces
            };
            memory.history.unshift(newEntry);
            // Limit history to 15 entries
            if (memory.history.length > 15) {
                memory.history = memory.history.slice(0, 15);
            }
            await writeFileNode(join(lunaticDir, 'memory.json'), JSON.stringify(memory, null, 2), 'utf8');
        }
        catch {
            // Ignore memory saving errors
        }
    }
    buildMemoryPrompt(memory) {
        if (!memory.history || memory.history.length === 0) {
            return '';
        }
        const items = memory.history
            .slice(0, 5) // use last 5 entries to conserve context tokens
            .map((entry, idx) => {
            return `[Task #${idx + 1}] "${entry.task}"
Timestamp: ${entry.timestamp}
Result: ${entry.success ? 'SUCCESS' : 'FAILED'}
Files Modified: ${entry.modifiedFiles.join(', ') || 'none'}
${entry.errors.length > 0 ? `Errors Encountered:\n${entry.errors.join('\n')}` : 'Errors: none'}`;
        })
            .join('\n\n');
        return `CONTEXT MEMORY: The following is a log of recent tasks executed in this workspace by the Lunatic Engine. Use this knowledge to avoid repeating past compilation/test errors:

${items}`;
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
}
