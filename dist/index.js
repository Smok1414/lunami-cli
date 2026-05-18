#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { runHeadless } from './headless.js';
import { execSync } from 'node:child_process';
import { setAgentMode, changeCwd, setWorkspaceRoot } from './state.js';
import { getCliMetadata, installLatestVersion, startBackgroundUpdateCheck } from './update.js';
import { parseArgs, ParseArgsError } from './parseArgs.js';
if (process.platform === 'win32') {
    try {
        execSync('chcp 65001', { stdio: 'ignore' });
    }
    catch { }
}
function printHelp() {
    const t = process.stdout.isTTY;
    const bold = (s) => t ? `\x1b[1m${s}\x1b[0m` : s;
    const cyan = (s) => t ? `\x1b[36m${s}\x1b[0m` : s;
    const green = (s) => t ? `\x1b[32m${s}\x1b[0m` : s;
    const gray = (s) => t ? `\x1b[90m${s}\x1b[0m` : s;
    console.log(`
${bold("LUNAMI")} — agentic TUI для парного программирования с AI

${cyan("Использование:")}
  lunami                          запустить интерактивный TUI
  lunami ${green("--prompt")} ${gray('"задача"')}           headless-режим, без TUI
  lunami ${green("--run")} ${gray("task.md")}               выполнить задачу из файла
  lunami ${green("--update")}                  обновить CLI до latest
  lunami ${green("update")}                    то же самое, отдельной командой
  echo "задача" | lunami          принять задачу из stdin

${cyan("Флаги:")}
  ${green("-p, --prompt")} ${gray("TEXT")}       задача для headless-режима
  ${green("    --run")} ${gray("FILE")}           файл с задачей (.md, .txt)
  ${green("    --plan")}             только план без вызова инструментов
  ${green("    --yolo")}             инструменты без подтверждений (запись, rm, git commit)
  ${green("    --dry-run")}          показать план без выполнения (эквивалентно --plan)
  ${green("    --cwd")} ${gray("DIR")}            рабочая директория (default: .)
  ${green("    --session")} ${gray("ID")}         продолжить сессию по ID
  ${green("    --model")} ${gray("NAME")}         модель (gpt-4o, claude-3-5-sonnet...)
  ${green("    --max-rounds")} ${gray("N")}       лимит tool-раундов (default: 30)
  ${green("-y, --yes")}             auto-approve file writes (headless/CI; also LUNAMI_YES=1)

${cyan("Вывод:")}
  ${green("    --json")}             структурированный JSON в stdout
  ${green("    --no-color")}         отключить ANSI-цвета и анимации
  ${green("-v, --verbose")}          показывать детали выполнения (tool calls)
  ${green("-q, --quiet")}            подавить финальный текст ответа
  ${green("    --debug")}            писать полный лог в ~/.lunami/debug.log

${cyan("Env:")}
  ${gray("LUNAMI_YES=1")} / ${gray("LUNAMI_AUTO_APPROVE_WRITES=1")}  skip write approval in AUTO mode
  Tab в TUI: PLAN → AUTO → YOLO · команда ${gray("/yolo")}

${cyan("Exit-коды:")}
  ${gray("0")}  успех
  ${gray("1")}  общая ошибка
  ${gray("2")}  неверные аргументы
  ${gray("3")}  превышен лимит раундов
  ${gray("4")}  ошибка API
  ${gray("130")}  прервано пользователем (SIGINT)
`);
}
function printVersion() {
    try {
        const pkg = getCliMetadata();
        console.log(`lunami ${pkg.version}`);
    }
    catch {
        console.log("lunami (version unknown)");
    }
}
async function startTUI() {
    const { render } = await import('ink');
    const { WelcomeScreen, shouldShowWelcome } = await import('./ui/WelcomeScreen.js');
    const { App } = await import('./ui/App.js');
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    }
    function Root() {
        const [showWelcome, setShowWelcome] = React.useState(shouldShowWelcome());
        if (showWelcome) {
            return _jsx(WelcomeScreen, { onComplete: () => setShowWelcome(false) });
        }
        return _jsx(App, {});
    }
    render(_jsx(Root, {}));
}
async function main() {
    let args;
    try {
        args = parseArgs(process.argv);
    }
    catch (error) {
        if (error instanceof ParseArgsError) {
            process.stderr.write(`ошибка: ${error.message}\n`);
            process.exit(2);
        }
        throw error;
    }
    const requestedMode = args.yolo ? 'yolo' : args.plan || args.dryRun ? 'plan' : 'auto';
    if (args.rest.length > 0) {
        process.stderr.write(`ошибка: неизвестный аргумент: ${args.rest.join(' ')}\n`);
        process.exit(2);
    }
    if (args.help) {
        printHelp();
        process.exit(0);
    }
    if (args.version) {
        printVersion();
        process.exit(0);
    }
    if (args.update) {
        const exitCode = installLatestVersion();
        process.exit(exitCode);
    }
    startBackgroundUpdateCheck();
    const isHeadless = args.prompt !== undefined ||
        args.run !== undefined ||
        (!process.stdin.isTTY && args.rest.length === 0);
    if (isHeadless) {
        const result = await runHeadless({
            prompt: args.prompt,
            runFile: args.run,
            cwd: args.cwd,
            maxRounds: args.maxRounds,
            json: args.json,
            noColor: args.noColor,
            verbose: args.verbose,
            quiet: args.quiet,
            debug: args.debug,
            model: args.model,
            sessionId: args.sessionId,
            mode: requestedMode,
            dryRun: args.dryRun,
            yes: args.yes,
        });
        process.exit(result.exitCode);
    }
    if (args.noColor)
        process.env.NO_COLOR = "1";
    if (args.debug)
        process.env.LUNAMI_DEBUG = "1";
    if (args.model)
        process.env.LLM_MODEL = args.model;
    if (args.sessionId)
        process.env.LUNAMI_SESSION = args.sessionId;
    if (args.cwd) {
        process.chdir(args.cwd);
        setWorkspaceRoot(process.cwd());
        await changeCwd(args.cwd);
    }
    setAgentMode(requestedMode);
    await startTUI();
}
main().catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
