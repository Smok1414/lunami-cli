import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { runAgent } from './agent.js';
import { getMcpManager } from './mcp/manager.js';
import { loadMemory, saveMemory } from './memory.js';
import { changeCwd, getAgentMode, setAgentMode, shouldSkipWriteApproval } from './state.js';
import { changeModel } from './llm.js';
import { t } from './i18n.js';
import { resolveMentions } from './mentions.js';
import { isAutoApproveWrites } from './parseArgs.js';
const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;
function c(code, text, noColor) {
    if (noColor)
        return text;
    return `\x1b[${code}m${text}\x1b[0m`;
}
const green = (t, nc) => c("32", t, nc);
const yellow = (t, nc) => c("33", t, nc);
const red = (t, nc) => c("31", t, nc);
const cyan = (t, nc) => c("36", t, nc);
const gray = (t, nc) => c("90", t, nc);
const bold = (t, nc) => c("1", t, nc);
class HeadlessReporter {
    nc;
    verbose;
    quiet;
    json;
    startTime;
    toolCalls = [];
    filesChanged = new Set();
    rounds = 0;
    debugLog;
    // Track the current round manually based on tool_start events
    currentRound = 0;
    currentToolStartTime = 0;
    currentToolName = '';
    constructor(opts) {
        this.nc = opts.noColor || NO_COLOR;
        this.verbose = opts.verbose;
        this.quiet = opts.quiet;
        this.json = opts.json;
        this.startTime = Date.now();
        if (opts.debug) {
            const logDir = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".lunami");
            fs.mkdirSync(logDir, { recursive: true });
            const logPath = path.join(logDir, "debug.log");
            this.debugLog = fs.createWriteStream(logPath, { flags: "a" });
            this.debugLog.write(`\n=== LUNAMI headless ${new Date().toISOString()} ===\n`);
        }
    }
    info(msg) {
        process.stderr.write(gray("  " + msg, this.nc) + "\n");
        this.debugLog?.write(`[INFO] ${msg}\n`);
    }
    hasError = false;
    lastErrorMessage = '';
    handleEvent(event) {
        if (event.type === 'tool_start') {
            this.currentRound++;
            this.rounds = this.currentRound;
            this.currentToolName = event.name;
            this.currentToolStartTime = Date.now();
            if (this.verbose) {
                process.stderr.write(`${cyan("⚙", this.nc)} round ${this.rounds}  ${yellow(event.name, this.nc)}  ${gray(event.summary.split('\n')[0], this.nc)}\n`);
            }
            else {
                process.stderr.write(`${cyan("⠸", this.nc)} ${gray(`round ${this.rounds} · ${event.name}`, this.nc)}\r`);
            }
            this.debugLog?.write(`[TOOL_START] round=${this.rounds} tool=${event.name}\n`);
        }
        if (event.type === 'tool') {
            const ms = Date.now() - this.currentToolStartTime;
            const isError = event.summary.toLowerCase().includes('failed') || event.summary.toLowerCase().includes('error');
            const resultStat = isError ? 'error' : 'ok';
            this.toolCalls.push({
                round: this.rounds,
                tool: event.name,
                args: {}, // We don't have raw args in AgentEvent currently, only summary
                result: resultStat,
                durationMs: ms
            });
            if (['writeFile'].includes(event.name)) {
                // Basic extraction of path from summary if possible
                const pathMatch = event.summary.match(/^([^\s]+)\s+(modified|created)/);
                if (pathMatch) {
                    this.filesChanged.add(pathMatch[1]);
                }
            }
            if (isError && this.verbose) {
                process.stderr.write(`${red("✗", this.nc)} ${event.name} ${red("failed", this.nc)}: ${gray(event.summary.split('\n')[0], this.nc)} ${gray(`(${ms}ms)`, this.nc)}\n`);
            }
            else if (this.verbose) {
                process.stderr.write(`${green("✓", this.nc)} ${event.name} ${green("success", this.nc)}: ${gray(event.summary.split('\n')[0], this.nc)} ${gray(`(${ms}ms)`, this.nc)}\n`);
            }
            this.debugLog?.write(`[TOOL_DONE] tool=${event.name} ms=${ms} summary=${event.summary.split('\n')[0]}\n`);
        }
        if (event.type === 'assistant_delta') {
            if (!this.quiet) {
                const out = this.json ? process.stderr : process.stdout;
                out.write(event.delta);
            }
            this.debugLog?.write(`[OUTPUT_DELTA] ${event.delta}\n`);
        }
        if (event.type === 'assistant_done' || (event.type === 'assistant' && event.content)) {
            if (!this.quiet) {
                const out = this.json ? process.stderr : process.stdout;
                if (event.type === 'assistant') {
                    out.write(event.content);
                }
                out.write("\n");
            }
            this.debugLog?.write(`[OUTPUT_DONE]\n`);
        }
        if (event.type === 'error') {
            this.hasError = true;
            this.lastErrorMessage = event.message;
            // We print the error here, but we will return the failure result at the end of runHeadless
            const ms = Date.now() - this.startTime;
            process.stderr.write(`\n${red("✗", this.nc)} ${bold(t('headless_err_prefix'), this.nc)}  ${red(event.message, this.nc)}\n`);
            this.debugLog?.write(`[ERROR] ${event.message}\n`);
        }
    }
    success(summary) {
        const ms = Date.now() - this.startTime;
        process.stderr.write(`\n${green("✓", this.nc)} ${bold(t('headless_done'), this.nc)}  ` +
            `${gray(t('headless_stats', this.rounds, this.filesChanged.size, (ms / 1000).toFixed(1)), this.nc)}\n`);
        this.debugLog?.write(`[DONE] rounds=${this.rounds} files=${this.filesChanged.size} ms=${ms}\n`);
        this.debugLog?.end();
        return {
            success: true,
            exitCode: 0,
            summary,
            toolCalls: this.toolCalls,
            filesChanged: Array.from(this.filesChanged),
            durationMs: ms,
            rounds: this.rounds,
        };
    }
    failure(error, exitCode = 1, muteLog = false) {
        const ms = Date.now() - this.startTime;
        if (!muteLog) {
            process.stderr.write(`\n${red("✗", this.nc)} ${bold(t('headless_err_prefix'), this.nc)}  ${red(error, this.nc)}\n`);
        }
        // We still print the summary stats even on failure
        process.stderr.write(`${gray(`exit: `, this.nc)}${red("✗", this.nc)} ${gray(t('headless_stats', this.rounds, this.filesChanged.size, (ms / 1000).toFixed(1)), this.nc)}\n`);
        this.debugLog?.write(`[ERROR] ${error}\n`);
        this.debugLog?.end();
        return {
            success: false,
            exitCode,
            summary: error,
            toolCalls: this.toolCalls,
            filesChanged: Array.from(this.filesChanged),
            durationMs: ms,
            rounds: this.rounds,
            error,
        };
    }
    cancelled(summary = t('headless_interrupted')) {
        const ms = Date.now() - this.startTime;
        this.debugLog?.write(`[CANCELLED] ${summary}\n`);
        this.debugLog?.end();
        return {
            success: false,
            exitCode: 130,
            summary,
            toolCalls: this.toolCalls,
            filesChanged: Array.from(this.filesChanged),
            durationMs: ms,
            rounds: this.rounds,
            error: summary,
        };
    }
}
export async function runHeadless(opts) {
    const nc = opts.noColor || NO_COLOR;
    const reporter = new HeadlessReporter({
        noColor: nc,
        verbose: opts.verbose ?? false,
        quiet: opts.quiet ?? false,
        debug: opts.debug ?? false,
        json: opts.json ?? false,
    });
    const controller = new AbortController();
    let interrupted = false;
    let rejectOnInterrupt;
    const handleInterrupt = () => {
        if (interrupted) {
            return;
        }
        interrupted = true;
        controller.abort();
        process.stderr.write(`\n! ${t('headless_interrupted')}\n`);
        rejectOnInterrupt?.(new Error(t('headless_interrupted')));
    };
    const handleSigint = () => {
        handleInterrupt();
    };
    const handleKeypress = (_input, key) => {
        if (key.ctrl && key.name === 'c') {
            handleInterrupt();
        }
    };
    const useRawInput = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
    process.once('SIGINT', handleSigint);
    if (useRawInput) {
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('keypress', handleKeypress);
    }
    let prompt = opts.prompt;
    if (!prompt && opts.runFile) {
        const filePath = path.resolve(opts.runFile);
        if (!fs.existsSync(filePath)) {
            return reporter.failure(t('headless_file_not_found', filePath), 2);
        }
        const buf = fs.readFileSync(filePath);
        if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
            prompt = buf.toString("utf16le").trim();
        }
        else if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            prompt = buf.toString("utf8").replace(/^\uFEFF/, "").trim();
        }
        else {
            prompt = buf.toString("utf8").trim();
        }
    }
    if (!prompt && !process.stdin.isTTY) {
        prompt = await readStdin();
    }
    if (!prompt || prompt.trim() === "") {
        return reporter.failure(t('headless_no_prompt'), 2);
    }
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
    if (!fs.existsSync(cwd)) {
        return reporter.failure(t('headless_cwd_not_found', cwd), 2);
    }
    const requestedMode = opts.mode ?? 'auto';
    const previousMode = getAgentMode();
    // Init state
    await changeCwd(cwd);
    void getMcpManager().ensureReady();
    setAgentMode(requestedMode);
    if (opts.model) {
        await changeModel(opts.model);
    }
    reporter.info(`cwd: ${cwd}`);
    reporter.info(`mode: ${requestedMode}`);
    if (opts.dryRun) {
        reporter.info(t('headless_dry_run'));
    }
    reporter.info(`prompt: ${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}`);
    let history = [];
    const sessionName = opts.sessionId;
    let activeMem;
    if (sessionName) {
        activeMem = await loadMemory(opts.model ?? 'sonnet-4.5', sessionName);
        if (activeMem && activeMem.history) {
            history = activeMem.history;
            reporter.info(`loaded session: ${sessionName} (${history.length} messages)`);
        }
    }
    const mentionResult = await resolveMentions(prompt);
    const agentInput = mentionResult.strippedPrompt || prompt;
    if (mentionResult.errors.length > 0) {
        for (const err of mentionResult.errors) {
            reporter.info(`mention: ${err}`);
        }
    }
    try {
        const nextHistory = await Promise.race([
            runAgent({
                input: agentInput,
                mentionPreamble: mentionResult.preamble || undefined,
                history,
                sessionName: sessionName ?? 'headless-session',
                mode: requestedMode,
                skipWriteApproval: shouldSkipWriteApproval(requestedMode) || isAutoApproveWrites(opts.yes ?? false),
                onEvent: (event) => reporter.handleEvent(event)
            }),
            new Promise((_, reject) => {
                rejectOnInterrupt = reject;
            })
        ]);
        // Save if session provided
        if (sessionName && activeMem) {
            activeMem.history = nextHistory;
            await saveMemory(activeMem);
        }
        if (reporter.hasError) {
            let exitCode = 1;
            if (reporter.lastErrorMessage === t('agent_max_rounds'))
                exitCode = 3;
            const finalResult = reporter.failure(reporter.lastErrorMessage, exitCode, true);
            if (opts.json)
                process.stdout.write(JSON.stringify(finalResult, null, 2) + "\n");
            return finalResult;
        }
        const finalResult = reporter.success(t('headless_done'));
        if (opts.json) {
            process.stdout.write(JSON.stringify(finalResult, null, 2) + "\n");
        }
        return finalResult;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (interrupted || msg === t('headless_interrupted')) {
            const finalResult = reporter.cancelled();
            if (opts.json)
                process.stdout.write(JSON.stringify(finalResult, null, 2) + "\n");
            return finalResult;
        }
        if (msg === t('agent_max_rounds') || msg.includes("too many tool rounds")) {
            return reporter.failure(t('headless_err_rounds'), 3);
        }
        if (msg.includes("API") || msg.includes("rate limit") || msg.includes("timeout")) {
            return reporter.failure(`${t('headless_err_prefix')} API: ${msg}`, 4);
        }
        return reporter.failure(msg, 1);
    }
    finally {
        if (useRawInput) {
            process.stdin.off('keypress', handleKeypress);
            process.stdin.setRawMode(false);
        }
        process.off('SIGINT', handleSigint);
        setAgentMode(previousMode);
    }
}
function readStdin() {
    return new Promise((resolve) => {
        const chunks = [];
        process.stdin.on('data', chunk => chunks.push(chunk));
        process.stdin.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve(text.trim());
        });
    });
}
