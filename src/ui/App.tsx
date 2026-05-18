import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Box, useApp, useInput, useStdout} from 'ink';
import type {ChatCompletionMessageParam} from 'openai/resources/chat/completions';
import type {ActivityStep} from '../activity.js';
import {runAgent, type AgentEvent, type AgentStatus} from '../agent.js';
import {getMcpManager} from '../mcp/manager.js';
import {filterCommands} from '../commands.js';
import {changeApi, pingApiConnection, changeModel, getCurrentBaseUrl, getModelLabel, getProviderInfo} from '../llm.js';
import {
  changeCwd,
  clearPendingApproval,
  clearProjectContext,
  appendProjectContext,
  getAgentMode,
  getDisplayCwd,
  getFullContext,
  getPendingApproval,
  readProjectContext,
  readProjectRules,
  estimateTokens,
  hasActiveContext,
  setAgentMode,
  shouldSkipWriteApproval,
  writeProjectContext,
  type AgentMode
} from '../state.js';
import {execCommand} from '../tools/exec.js';
import {undoLastWrite, writeFile} from '../tools/fs.js';
import {resolveMentions} from '../mentions.js';
import {gitCommit} from '../tools/git.js';
import {listTree} from '../tools/tree.js';
import {
  clearMemory,
  createSession,
  createEmptyMemory,
  defaultSessionName,
  deleteSession,
  exportMemory,
  listSessions,
  loadMemory,
  loadCurrentSessionName,
  saveMemory,
  sessionExists,
  setCurrentSessionName,
  type MemoryState,
  type StoredUiMessage,
  type ThemeName
} from '../memory.js';
import {fallbackGroups, fetchDynamicGroups, flattenModelGroups, getTotalPickerEntries} from '../models.js';
import {ChatPanel, getPaletteHeight, isCollapsibleToolMessage, type UiMessage} from './ChatPanel.js';
import {estimateMessageLines} from './chatUtils.js';
import {nextThemeName} from './theme.js';
import {apiPresets} from './ApiPicker.js';
import { t, useLang, changeLang, getLang } from '../i18n.js';

export function App(): React.ReactElement {
  useLang();
  const {exit} = useApp();
  const {stdout} = useStdout();
  const modelFetchIdRef = React.useRef(0);
  const [input, setInput] = useState('');
  const [pastedText, setPastedText] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatCompletionMessageParam[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>('IDLE');
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [themeName, setThemeName] = useState<ThemeName>('midnight');
  const [memoryReady, setMemoryReady] = useState(false);
  const [sessionName, setSessionName] = useState('default');
  const [cwdLabel, setCwdLabel] = useState(getDisplayCwd());
  const [agentMode, setAgentModeState] = useState<AgentMode>(getAgentMode());
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  const [mpOpen, setMpOpen] = useState(false);
  const [mpGroups, setMpGroups] = useState(fallbackGroups);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpIndex, setMpIndex] = useState(0);
  const [mpCustom, setMpCustom] = useState(false);
  const [mpCustomInput, setMpCustomInput] = useState('');
  const [mpSearch, setMpSearch] = useState('');
  const [apOpen, setApOpen] = useState(false);
  const [apPhase, setApPhase] = useState<'select' | 'input'>('select');
  const [apIndex, setApIndex] = useState(0);
  const [apEndpoint, setApEndpoint] = useState('');
  const [apKey, setApKey] = useState('');
  const [apField, setApField] = useState<'endpoint' | 'key'>('endpoint');
  const [hasContext, setHasContext] = useState(false);
  const [toolLabel, setToolLabel] = useState('');
  const [toolChain, setToolChain] = useState<{names: string[]; activeIndex: number} | null>(null);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(() => new Set());
  const [progressRound, setProgressRound] = useState(0);
  const [progressTool, setProgressTool] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [writeApprovalOpen, setWriteApprovalOpen] = useState(false);

  const isBusy = status === 'ACTIVE' || status === 'TOOL';
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24
      });
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  useEffect(() => {
    void getMcpManager().ensureReady();
  }, []);

  const terminalWidth = dimensions.columns;
  const terminalHeight = dimensions.rows;
  const modelLabel = getModelLabel();

  const filteredPaletteCommands = useMemo(() => filterCommands(input), [input]);
  const paletteVisible = input.startsWith('/') && !input.includes(' ') && !paletteDismissed && !isRunning;
  const clampedPaletteIndex = Math.min(paletteIndex, Math.max(0, filteredPaletteCommands.length - 1));

  const filteredMpGroups = useMemo(() => {
    if (!mpSearch) return mpGroups;
    const lowerSearch = mpSearch.toLowerCase();
    return mpGroups.map(group => ({
      ...group,
      models: group.models.filter(m => m.toLowerCase().includes(lowerSearch))
    })).filter(group => group.models.length > 0);
  }, [mpGroups, mpSearch]);

  const mpFlatModels = useMemo(() => flattenModelGroups(filteredMpGroups), [filteredMpGroups]);
  const mpTotalEntries = useMemo(() => getTotalPickerEntries(filteredMpGroups), [filteredMpGroups]);

  useEffect(() => {
    setMpIndex((current) => Math.min(current, Math.max(0, mpTotalEntries - 1)));
  }, [mpTotalEntries]);

  const applyMemoryState = useCallback((memory: MemoryState) => {
    setSessionName(memory.sessionName);
    setHistory(memory.history);
    setMessages(memory.uiMessages.map(toUiMessage));
    setPromptHistory(memory.promptHistory);
    setTokenCount(memory.tokenCount);
    setThemeName(memory.themeName);
    setHistoryIndex(null);
    setProgress(0);
    setStatus('IDLE');
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const activeSessionName = await loadCurrentSessionName();
      const memory = await loadMemory(modelLabel, activeSessionName);

      if (cancelled) {
        return;
      }

      applyMemoryState(memory);
      setMemoryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyMemoryState, modelLabel]);

  const refreshContext = useCallback(async () => {
    setHasContext(await hasActiveContext());
  }, []);

  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (!memoryReady) {
      return;
    }

    const timer = setTimeout(() => {
      void saveMemory(createMemorySnapshot({
        modelLabel,
        sessionName,
        themeName,
        tokenCount,
        promptHistory,
        history,
        messages
      }));
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [history, memoryReady, messages, modelLabel, promptHistory, sessionName, themeName, tokenCount]);

  const handleEvent = useCallback((event: AgentEvent) => {
    if (event.type === 'activity') {
      setActivitySteps(event.steps);
      return;
    }

    if (event.type === 'status') {
      setStatus(event.status);
      setToolLabel(event.label ?? '');
      setToolChain(event.chain ?? null);
      if (event.status === 'DONE' || event.status === 'IDLE' || event.status === 'ERROR') {
        setToolChain(null);
        setActivitySteps([]);
      }
      return;
    }

    if (event.type === 'progress') {
      setProgress(event.value);
      return;
    }

    if (event.type === 'tokens') {
      setTokenCount(event.total);
      return;
    }

    if (event.type === 'assistant_start') {
      setStreamingMessageId(event.id);
      setMessages((current) => [
        ...current.filter((m) => !isThinkingPlaceholder(m)),
        createMessage('assistant', '', false, event.id)
      ]);
      return;
    }

    if (event.type === 'assistant_delta') {
      setMessages((current) =>
        current.map((message) =>
          message.id === event.id ? {...message, text: `${message.text}${event.delta}`} : message
        )
      );
      return;
    }

    if (event.type === 'assistant_done') {
      setStreamingMessageId(null);
      return;
    }

    if (event.type === 'error') {
      setMessages((current) => [...current, createMessage('error', event.message)]);
      return;
    }

    if (event.type === 'tool_start') {
      setProgressRound((r) => r + 1);
      setProgressTool(event.name);
      setMessages((current) => [...current, createMessage('tool', event.summary)]);
      return;
    }

    if (event.type === 'assistant') {
      setMessages((current) => [...current, createMessage('assistant', event.content)]);
      return;
    }

    setMessages((current) => [...current, createMessage('tool', event.summary, true)]);
  }, []);

  const clearScreen = useCallback(() => {
    stdout.write('\x1b[2J\x1b[3J\x1b[H');
  }, [stdout]);

  const resetSession = useCallback(async () => {
    clearScreen();
    setHistory([]);
    setMessages([]);
    setPromptHistory([]);
    setHistoryIndex(null);
    setProgress(0);
    setTokenCount(0);
    setStatus('IDLE');
    setActivitySteps([]);
    setPaletteDismissed(false);
    setPaletteIndex(0);
    await clearMemory(sessionName);
  }, [clearScreen, sessionName]);

  const saveCurrentSession = useCallback(async (): Promise<void> => {
    if (!memoryReady) {
      return;
    }

    await saveMemory(createMemorySnapshot({
      modelLabel,
      sessionName,
      themeName,
      tokenCount,
      promptHistory,
      history,
      messages
    }));
  }, [history, memoryReady, messages, modelLabel, promptHistory, sessionName, themeName, tokenCount]);

  const runSessionCommand = useCallback(async (prompt: string): Promise<void> => {
    const [, action = '', rawName = ''] = prompt.slice(1).trim().split(/\s+/);

    if (action === 'new') {
      const nextSessionName = requireSessionName(rawName);

      await saveCurrentSession();
      setMemoryReady(false);

      const memory = await createSession(nextSessionName, modelLabel);

      applyMemoryState(memory);
      setMessages((current) => [...current, createMessage('tool', `${t('session_created')} ${nextSessionName}`)]);
      setMemoryReady(true);
      return;
    }

    if (action === 'list') {
      const sessions = [...new Set([...(await listSessions()), sessionName])].sort((left, right) => left.localeCompare(right));
      const summary = sessions.map((name) => (name === sessionName ? `[${name}]` : name)).join(', ');

      setMessages((current) => [...current, createMessage('tool', `${t('sessions_list')} ${summary}`)]);
      setStatus('IDLE');
      return;
    }

    if (action === 'switch') {
      const nextSessionName = requireSessionName(rawName);

      if (!(await sessionExists(nextSessionName)) && nextSessionName !== defaultSessionName) {
        throw new Error(t('err_session_not_found', nextSessionName));
      }

      await saveCurrentSession();
      setMemoryReady(false);
      await setCurrentSessionName(nextSessionName);

      const memory = await loadMemory(modelLabel, nextSessionName);

      applyMemoryState(memory);
      setMessages((current) => [...current, createMessage('tool', `${t('session_switched')} ${nextSessionName}`)]);
      setMemoryReady(true);
      return;
    }

    if (action === 'delete') {
      const targetSessionName = requireSessionName(rawName);

      const targetExists = await sessionExists(targetSessionName);

      if (!targetExists && targetSessionName !== sessionName) {
        throw new Error(t('err_session_not_found', targetSessionName));
      }

      if (targetSessionName !== sessionName) {
        await deleteSession(targetSessionName);
        setMessages((current) => [...current, createMessage('tool', `${t('session_deleted')} ${targetSessionName}`)]);
        setStatus('IDLE');
        return;
      }

      setMemoryReady(false);
      await deleteSession(targetSessionName);

      const remainingSessions = (await listSessions()).filter((name) => name !== targetSessionName);
      const nextSessionName = remainingSessions[0] ?? defaultSessionName;
      const memory = (await sessionExists(nextSessionName))
        ? await loadMemory(modelLabel, nextSessionName)
        : await createSession(nextSessionName, modelLabel);

      await setCurrentSessionName(nextSessionName);
      applyMemoryState(memory);
      setMessages((current) => [
        ...current,
        createMessage('tool', t('session_deleted_switched', targetSessionName, nextSessionName))
      ]);
      setMemoryReady(true);
      return;
    }

    throw new Error(t('usage_session'));
  }, [applyMemoryState, modelLabel, saveCurrentSession, sessionName]);

  const syncWriteApprovalUi = useCallback(() => {
    const pending = getPendingApproval();
    setWriteApprovalOpen(pending?.type === 'writeFile');
  }, []);

  const resolveWriteApproval = useCallback(async (approve: boolean): Promise<void> => {
    const approval = getPendingApproval();

    if (!approval || approval.type !== 'writeFile') {
      setWriteApprovalOpen(false);
      return;
    }

    let toolCallResultStr: string;
    let finalMessageStr: string;

    if (approve) {
      const result = await writeFile(approval.path, approval.content);
      toolCallResultStr = JSON.stringify(result);
      finalMessageStr = `${t('write_approval_done')} ${result.path}`;
    } else {
      toolCallResultStr = JSON.stringify({ ok: false, error: 'User denied write' });
      finalMessageStr = t('write_approval_denied');
    }

    clearPendingApproval();
    setWriteApprovalOpen(false);
    setMessages((current) => [...current, createMessage('tool', finalMessageStr)]);

    const nextHistory = patchApprovalToolMessages(history, toolCallResultStr, approval.toolCallId);
    setHistory(nextHistory);

    if (approve) {
      setIsRunning(true);
      setProgress(10);
      try {
        const finalHistory = await runAgent({
          history: nextHistory,
          sessionName,
          onEvent: handleEvent
        });
        setHistory(finalHistory);
        syncWriteApprovalUi();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((current) => [...current, createMessage('error', message)]);
        setStatus('ERROR');
      } finally {
        setIsRunning(false);
      }
    } else {
      setStatus('IDLE');
    }
  }, [handleEvent, history, sessionName, syncWriteApprovalUi]);

  const runSlashCommand = useCallback(async (prompt: string): Promise<void> => {
    const [command = ''] = prompt.slice(1).trim().split(/\s+/);

    if (command === 'clear') {
      void resetSession();
      return;
    }

    if (command === 'theme') {
      const nextTheme = nextThemeName(themeName);
      setThemeName(nextTheme);
      setMessages((current) => [...current, createMessage('tool', `${t('theme_changed')} ${nextTheme}`)]);
      setStatus('IDLE');
      return;
    }

    if (command === 'plan') {
      setAgentMode('plan');
      setAgentModeState('plan');
      setMessages((current) => [...current, createMessage('tool', t('mode_plan'))]);
      setStatus('IDLE');
      return;
    }

    if (command === 'auto') {
      setAgentMode('auto');
      setAgentModeState('auto');
      setMessages((current) => [...current, createMessage('tool', t('mode_auto'))]);
      setStatus('IDLE');
      return;
    }

    if (command === 'yolo') {
      setAgentMode('yolo');
      setAgentModeState('yolo');
      setMessages((current) => [...current, createMessage('tool', t('mode_yolo'))]);
      setStatus('IDLE');
      return;
    }

    if (command === 'approve') {
      const approval = getPendingApproval();

      if (!approval) {
        setMessages((current) => [...current, createMessage('tool', t('no_approval'))]);
        setStatus('IDLE');
        return;
      }

      if (approval.type === 'writeFile') {
        await resolveWriteApproval(true);
        return;
      }

      let result: { ok: boolean; exitCode: number; stdout?: string; stderr?: string };
      let toolCallResultStr: string;
      let finalMessageStr: string;

      if (approval.type === 'execCommand') {
        result = await execCommand(approval.command);
        toolCallResultStr = JSON.stringify(result);
        finalMessageStr = `${t('cmd_finished')} ${result.exitCode}\n${trimToolOutput(result.stdout || result.stderr || '')}`;
      } else {
        result = await gitCommit(approval.message);
        toolCallResultStr = JSON.stringify(result);
        finalMessageStr = `${t('git_finished')} ${result.exitCode}\n${trimToolOutput(result.stdout || result.stderr || '')}`;
      }

      clearPendingApproval();
      setMessages((current) => [...current, createMessage('tool', finalMessageStr)]);
      setStatus(result.ok ? 'DONE' : 'ERROR');

      const nextHistory = patchApprovalToolMessages(history, toolCallResultStr);

      setHistory(nextHistory);

      if (result.ok) {
        setIsRunning(true);
        setProgress(10);
        try {
          const finalHistory = await runAgent({
            history: nextHistory,
            sessionName,
            onEvent: handleEvent
          });
          setHistory(finalHistory);
          syncWriteApprovalUi();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setMessages((current) => [...current, createMessage('error', message)]);
          setStatus('ERROR');
        } finally {
          setIsRunning(false);
        }
      }
      return;
    }

    if (command === 'deny') {
      const approval = getPendingApproval();

      if (approval?.type === 'writeFile') {
        await resolveWriteApproval(false);
        return;
      }

      clearPendingApproval();
      setWriteApprovalOpen(false);
      setMessages((current) => [...current, createMessage('tool', approval ? t('approval_denied') : t('no_approval'))]);
      setStatus('IDLE');

      if (approval) {
        setHistory(patchApprovalToolMessages(history, JSON.stringify({ ok: false, error: 'User denied approval' })));
      }
      return;
    }

    if (command === 'rules') {
      const rules = (await readProjectRules()).trim();

      if (!rules) {
        setMessages((current) => [...current, createMessage('tool', t('rules_empty'))]);
      } else {
        setMessages((current) => [
          ...current,
          createMessage('tool', `─────────────────────────\n${rules}\n─────────────────────────`)
        ]);
      }

      setStatus('IDLE');
      return;
    }

    if (command === 'undo') {
      const result = await undoLastWrite();
      setMessages((current) => [...current, createMessage('tool', `${t('undo_msg')} ${result.path} ${result.action}`)]);
      setStatus('DONE');
      return;
    }

    if (command === 'tree') {
      const result = await listTree(2);
      setMessages((current) => [...current, createMessage('tool', result.tree)]);
      setStatus('IDLE');
      return;
    }

    if (command === 'context') {
      const rest = prompt.slice(1).trim().split(/\s+/).slice(1);
      const action = (rest[0] ?? '').toLowerCase();
      const contextBody = rest.slice(1).join(' ').trim();

      if (!action) {
        const full = (await getFullContext()).trim();

        if (!full) {
          setMessages((current) => [...current, createMessage('tool', t('context_empty'))]);
        } else {
          const tokens = estimateTokens(full);
          setMessages((current) => [
            ...current,
            createMessage('tool', `─────────────────────────\n${full}\n─────────────────────────\n~${tokens} ${t('context_info')}`)
          ]);
        }

        setStatus('IDLE');
        return;
      }

      if (action === 'set') {
        if (!contextBody) {
          setMessages((current) => [...current, createMessage('error', t('usage_context'))]);
          setStatus('ERROR');
          return;
        }

        const path = await writeProjectContext(contextBody);
        await refreshContext();
        setMessages((current) => [...current, createMessage('tool', `${t('context_set')} ${path}`)]);
        setStatus('IDLE');
        return;
      }

      if (action === 'add') {
        if (!contextBody) {
          setMessages((current) => [...current, createMessage('error', t('usage_context'))]);
          setStatus('ERROR');
          return;
        }

        const path = await appendProjectContext(contextBody);
        await refreshContext();
        setMessages((current) => [...current, createMessage('tool', `${t('context_appended')} ${path}`)]);
        setStatus('IDLE');
        return;
      }

      if (action === 'clear') {
        await clearProjectContext();
        await refreshContext();
        setMessages((current) => [...current, createMessage('tool', t('context_cleared'))]);
        setStatus('IDLE');
        return;
      }

      setMessages((current) => [...current, createMessage('error', t('usage_context'))]);
      setStatus('ERROR');
      return;
    }

    if (command === 'export') {
      const result = await exportMemory(createMemorySnapshot({
        modelLabel,
        sessionName,
        themeName,
        tokenCount,
        promptHistory,
        history,
        messages
      }));

      setMessages((current) => [...current, createMessage('tool', `${t('exported')} ${result.path}`)]);
      setStatus('IDLE');
      return;
    }

    if (command === 'session') {
      await runSessionCommand(prompt);
      return;
    }

    if (command === 'provider') {
      const providerInfo = getProviderInfo();
      const baseUrl = providerInfo.baseUrl ? ` · ${providerInfo.baseUrl}` : '';

      setMessages((current) => [
        ...current,
        createMessage('tool', t('provider_info', providerInfo.provider, providerInfo.model) + baseUrl)
      ]);
      setStatus('IDLE');
      return;
    }

    if (command === 'cd') {
      const target = prompt.slice(1).trim().split(/\s+/).slice(1).join(' ').trim();

      if (!target) {
        setMessages((current) => [...current, createMessage('tool', `${t('cwd_msg')} ${getDisplayCwd()}`)]);
        setStatus('IDLE');
        return;
      }

      await changeCwd(target);
      const newLabel = getDisplayCwd();
      setCwdLabel(newLabel);
      setMessages((current) => [
        ...current,
        createMessage('tool', `${t('cwd_msg')} ${newLabel}\n${t('cwd_workspace_hint')}`)
      ]);
      setStatus('IDLE');
      return;
    }

    if (command === 'model') {
      setMpOpen(true);
      setMpIndex(1);
      setMpCustom(false);
      setMpSearch('');
      setMpCustomInput('');
      setMpGroups(fallbackGroups);
      setMpLoading(true);
      setStatus('IDLE');

      const requestId = modelFetchIdRef.current + 1;
      modelFetchIdRef.current = requestId;

      void fetchDynamicGroups().then((groups) => {
        if (modelFetchIdRef.current !== requestId) {
          return;
        }

        if (groups) {
          setMpGroups(groups);
        }

        setMpLoading(false);
      });
      return;
    }

    if (command === 'api') {
      setApOpen(true);
      setApPhase('select');
      setApIndex(0);
      setApEndpoint(getCurrentBaseUrl());
      setApKey(process.env.OPENAI_API_KEY ?? '');
      setApField('endpoint');
      setStatus('IDLE');
      return;
    }

    if (command === 'lang') {
      const rest = prompt.slice(1).trim().split(/\s+/).slice(1);
      const targetLang = rest[0];
      if (targetLang === 'en' || targetLang === 'ru') {
        await changeLang(targetLang as 'en' | 'ru');
        setStatus('IDLE');
      } else {
        setMessages((current) => [...current, createMessage('error', t('usage_lang'))]);
        setStatus('ERROR');
      }
      return;
    }

    if (command === 'mcp') {
      const rest = prompt.slice(1).trim().split(/\s+/).slice(1);
      const action = (rest[0] ?? '').toLowerCase();
      const report = action === 'reload'
        ? await getMcpManager().reload()
        : await getMcpManager().getStatusReport();

      setMessages((current) => [
        ...current,
        createMessage(
          'tool',
          action === 'reload' ? `${t('mcp_reloaded')}\n${report}` : report,
          false,
          undefined,
          false
        )
      ]);
      setStatus('IDLE');
      return;
    }

    setMessages((current) => [...current, createMessage('error', t('unknown_cmd', command))]);
    setStatus('ERROR');
  }, [clearScreen, handleEvent, history, messages, modelLabel, promptHistory, resolveWriteApproval, runSessionCommand, sessionName, themeName, tokenCount]);

  const submit = useCallback(async () => {
    const combinedInput = pastedText ? `${pastedText}\n${input}` : input;
    const prompt = combinedInput.trim();

    if (!prompt || isRunning) {
      return;
    }

    setInput('');
    setPastedText(null);
    setHistoryIndex(null);
    setPromptHistory((current) => [...current, prompt]);

    if (prompt.startsWith('/')) {
      try {
        await runSlashCommand(prompt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((current) => [...current, createMessage('error', message)]);
        setStatus('ERROR');
      }

      return;
    }

    setIsRunning(true);
    setProgress(10);
    setProgressRound(0);
    setProgressTool('');
    const mentionResult = await resolveMentions(prompt);
    const agentInput = mentionResult.strippedPrompt || prompt;
    const userText = mentionResult.errors.length > 0
      ? `${prompt}\n\n${mentionResult.errors.map((e) => `⚠ ${e}`).join('\n')}`
      : prompt;

    setMessages((current) => [
      ...current,
      createMessage('user', userText),
      createMessage('tool', t('agent_thinking_tui'), true)
    ]);

    try {
      const nextHistory = await runAgent({
        input: agentInput,
        mentionPreamble: mentionResult.preamble || undefined,
        history,
        sessionName,
        skipWriteApproval: shouldSkipWriteApproval(agentMode),
        onEvent: handleEvent
      });

      setHistory(nextHistory);
      syncWriteApprovalUi();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages((current) => [...current, createMessage('error', message)]);
      setStatus('ERROR');
    } finally {
      setIsRunning(false);
    }
  }, [agentMode, handleEvent, history, input, isRunning, pastedText, runSlashCommand, sessionName, syncWriteApprovalUi]);

  useInput((character, key) => {
    if (key.ctrl && character === 'c') {
      exit();
      return;
    }

    if (character === '?' && !mpOpen && !apOpen && !isRunning) {
      setHelpOpen((open) => !open);
      return;
    }

    if (writeApprovalOpen) {
      if (key.return && !input.trim() && !pastedText && toggleLastCollapsibleTool()) {
        return;
      }

      const lower = character.toLowerCase();
      if (lower === 'y') {
        void resolveWriteApproval(true);
      } else if (lower === 'n') {
        void resolveWriteApproval(false);
      } else if (lower === 'e') {
        setMessages((current) => [...current, createMessage('tool', t('write_approval_edit_deferred'))]);
      }
      return;
    }

    if (helpOpen) {
      if (key.escape || character === '?') {
        setHelpOpen(false);
      }
      return;
    }

    if (character === 'o' && !mpOpen && !apOpen && !isRunning && !input) {
      toggleLastCollapsibleTool();
      return;
    }

    // --- Model Picker mode ---
    if (mpOpen) {

      if (key.escape) {
        if (mpCustom) {
          setMpCustom(false);
        } else {
          setMpOpen(false);
          modelFetchIdRef.current += 1;
        }
        return;
      }

      if (key.upArrow) {
        if (!mpCustom) {
          setMpIndex((c) => Math.max(0, c - 1));
        }
        return;
      }

      if (key.downArrow) {
        if (!mpCustom) {
          setMpIndex((c) => Math.min(mpTotalEntries - 1, c + 1));
        }
        return;
      }

      if (key.return) {
        if (mpCustom) {
          const model = mpCustomInput.trim();
          if (model) {
            setMpOpen(false);
            void (async () => {
              await changeModel(model);
              setMessages((cur) => [...cur, createMessage('tool', t('model_changed', model))]);
            })();
          }
        } else if (mpIndex === 0) {
          setMpCustom(true);
          setMpCustomInput(mpSearch);
        } else {
          const model = mpFlatModels[mpIndex - 1] ?? '';
          setMpOpen(false);
          void (async () => {
            await changeModel(model);
            setMessages((cur) => [...cur, createMessage('tool', t('model_changed', model))]);
          })();
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (mpCustom) {
          setMpCustomInput((c) => c.slice(0, -1));
        } else {
          setMpSearch((c) => c.slice(0, -1));
          setMpIndex(1);
        }
        return;
      }

      if (character && !key.ctrl && !key.meta) {
        if (mpCustom) {
          setMpCustomInput((c) => c + character);
        } else {
          setMpSearch((c) => c + character);
          setMpIndex(1);
        }
        return;
      }

      return;
    }

    // --- API Picker mode ---
    if (apOpen) {

      if (key.escape) {
        if (apPhase === 'input') {
          setApPhase('select');
        } else {
          setApOpen(false);
        }
        return;
      }

      if (apPhase === 'select') {
        if (key.upArrow) {
          setApIndex((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow) {
          setApIndex((c) => Math.min(apiPresets.length - 1, c + 1));
          return;
        }
        if (key.return) {
          const preset = apiPresets[apIndex];
          if (preset) {
            setApEndpoint(preset.url || '');
            if (!preset.needsCustomUrl && preset.url) {
              setApEndpoint(preset.url);
            }
            setApPhase('input');
            setApField('endpoint');
          }
          return;
        }
      }

      if (apPhase === 'input') {
        if (key.tab) {
          setApField((c) => (c === 'endpoint' ? 'key' : 'endpoint'));
          return;
        }
        if (key.return) {
          const endpoint = apEndpoint.trim();
          if (endpoint) {
            setApOpen(false);
            void (async () => {
              const short = endpoint.replace(/^https?:\/\//, '').split('/')[0] || '';
              setMessages((cur) => [...cur, createMessage('tool', t('api_checking_connection', short))]);
              
              const res = await pingApiConnection(endpoint, apKey.trim());
              
              if (res.ok) {
                await changeApi(endpoint, apKey.trim());
                setMessages((cur) => [
                  ...cur,
                  createMessage('tool', t('api_connect_success', res.providerName || 'Unknown', String(res.ms))),
                  createMessage('tool', t('api_changed', short))
                ]);
              } else {
                await changeApi(endpoint, apKey.trim());
                setMessages((cur) => [
                  ...cur,
                  createMessage('error', t('api_connect_failed', short, res.error || 'Connection failed')),
                  createMessage('tool', t('api_changed', short))
                ]);
              }
            })();
          }
          return;
        }
        if (key.backspace || key.delete) {
          if (apField === 'endpoint') {
            setApEndpoint((c) => c.slice(0, -1));
          } else {
            setApKey((c) => c.slice(0, -1));
          }
          return;
        }
        if (character && !key.ctrl && !key.meta) {
          if (apField === 'endpoint') {
            setApEndpoint((c) => c + character);
          } else {
            setApKey((c) => c + character);
          }
          return;
        }
      }

      return;
    }

    // --- Normal mode ---
    if (key.escape) {
      if (paletteVisible) {
        setPaletteDismissed(true);
      } else {
        exit();
      }
      return;
    }

    if (key.ctrl && character === 'l') {
      void resetSession();
      return;
    }

    if (key.tab && !mpOpen && !apOpen && !helpOpen && !isRunning) {
      toggleAgentMode();
      return;
    }

    if (isRunning || writeApprovalOpen) {
      return;
    }

    if (key.return) {
      if (paletteVisible && filteredPaletteCommands.length > 0) {
        const selected = filteredPaletteCommands[clampedPaletteIndex];
        if (selected && selected.name === input) {
          void submit();
        } else if (selected) {
          setInput(selected.name);
          setPaletteDismissed(true);
        }
      } else if (!input.trim() && !pastedText && toggleLastCollapsibleTool()) {
        // пустой Enter — развернуть/свернуть последний длинный вывод инструмента
      } else {
        void submit();
      }
      return;
    }

    if (key.upArrow) {
      if (paletteVisible) {
        setPaletteIndex((current) => Math.max(0, current - 1));
      } else {
        if (promptHistory.length === 0) {
          return;
        }
        const nextIndex = historyIndex === null ? promptHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        const nextPrompt = promptHistory[nextIndex] ?? '';
        if (nextPrompt.length > 150 || nextPrompt.includes('\n')) {
          setPastedText(nextPrompt);
          setInput('');
        } else {
          setPastedText(null);
          setInput(nextPrompt);
        }
      }
      return;
    }

    if (key.downArrow) {
      if (paletteVisible) {
        setPaletteIndex((current) => Math.min(filteredPaletteCommands.length - 1, current + 1));
      } else {
        if (promptHistory.length === 0 || historyIndex === null) {
          return;
        }
        const nextIndex = historyIndex + 1;
        if (nextIndex >= promptHistory.length) {
          setHistoryIndex(null);
          setPastedText(null);
          setInput('');
        } else {
          setHistoryIndex(nextIndex);
          const nextPrompt = promptHistory[nextIndex] ?? '';
          if (nextPrompt.length > 150 || nextPrompt.includes('\n')) {
            setPastedText(nextPrompt);
            setInput('');
          } else {
            setPastedText(null);
            setInput(nextPrompt);
          }
        }
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (input.length === 0 && pastedText !== null) {
        setPastedText(null);
      } else {
        setInput((current) => current.slice(0, -1));
      }
      setPaletteIndex(0);
      setPaletteDismissed(false);
      return;
    }

    if (character && !key.ctrl && !key.meta) {
      setHistoryIndex(null);
      if (character.length > 50 || character.includes('\n') || character.includes('\r')) {
        setPastedText(character);
      } else {
        setInput((current) => current + character);
      }
      setPaletteIndex(0);
      setPaletteDismissed(false);
    }
  });

  const pendingWriteApproval = getPendingApproval();
  const writeApproval =
    writeApprovalOpen && pendingWriteApproval?.type === 'writeFile' ? pendingWriteApproval : null;

  const paletteHeight = paletteVisible ? getPaletteHeight(filteredPaletteCommands.length) : 0;

  const {visibleMessages, hiddenMessageCount} = useMemo(() => {
    const chromeLines = 16 + (isBusy ? 3 : 0) + paletteHeight;
    const availableLines = Math.max(4, terminalHeight - chromeLines);
    const textWidth = Math.max(24, terminalWidth - 20);

    let totalLines = 0;
    let startIndex = messages.length;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]!;
      const lines = estimateMessageLines(msg.text, textWidth) + (msg.kind === 'user' || msg.kind === 'error' ? 2 : 1);
      if (totalLines + lines > availableLines && startIndex < messages.length) {
        break;
      }
      totalLines += lines;
      startIndex = i;
    }

    return {
      visibleMessages: messages.slice(startIndex),
      hiddenMessageCount: startIndex
    };
  }, [messages, terminalHeight, terminalWidth, isBusy, paletteHeight]);

  const toggleToolExpand = useCallback((id: string) => {
    setExpandedToolIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAgentMode = useCallback(() => {
    const next: AgentMode = agentMode === 'plan' ? 'auto' : agentMode === 'auto' ? 'yolo' : 'plan';
    setAgentMode(next);
    setAgentModeState(next);
    const modeMessage = next === 'plan' ? t('mode_plan') : next === 'yolo' ? t('mode_yolo') : t('mode_auto');
    setMessages((current) => [...current, createMessage('tool', modeMessage)]);
    setStatus('IDLE');
  }, [agentMode]);

  const toggleLastCollapsibleTool = useCallback((): boolean => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message && isCollapsibleToolMessage(message)) {
        toggleToolExpand(message.id);
        return true;
      }
    }

    return false;
  }, [messages, toggleToolExpand]);

  return (
    <Box width={terminalWidth} height={terminalHeight}>
      <ChatPanel
        input={input}
        pastedText={pastedText}
        messages={visibleMessages}
        hiddenMessageCount={hiddenMessageCount}
        progress={progress}
        progressRound={progressRound}
        progressTool={progressTool}
        isBusy={isBusy}
        status={status}
        tokenCount={tokenCount}
        modelLabel={modelLabel}
        sessionName={sessionName}
        cwdLabel={cwdLabel}
        agentMode={agentMode}
        themeName={themeName}
        panelWidth={terminalWidth}
        panelHeight={terminalHeight}
        paletteCommands={filteredPaletteCommands}
        paletteIndex={clampedPaletteIndex}
        paletteVisible={paletteVisible}
        paletteQuery={input}
        helpOpen={helpOpen}
        writeApproval={writeApproval}
        expandedToolIds={expandedToolIds}
        streamingMessageId={streamingMessageId}
        onToggleToolExpand={toggleToolExpand}
        modelPickerOpen={mpOpen}
        modelPickerGroups={filteredMpGroups}
        modelPickerSearch={mpSearch}
        modelPickerLoading={mpLoading}
        modelPickerIndex={mpIndex}
        modelPickerCustomMode={mpCustom}
        modelPickerCustomInput={mpCustomInput}
        apiPickerOpen={apOpen}
        apiPickerPhase={apPhase}
        apiPickerIndex={apIndex}
        apiPickerEndpoint={apEndpoint}
        apiPickerKey={apKey}
        apiPickerField={apField}
        apiCurrentEndpoint={getCurrentBaseUrl()}
        hasContext={hasContext}
        toolLabel={toolLabel}
        toolChain={toolChain}
        activitySteps={activitySteps}
      />
    </Box>
  );
}

function createMessage(
  kind: UiMessage['kind'],
  text: string,
  animate = false,
  id?: string,
  collapsible?: boolean
): UiMessage {
  return {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    text,
    animate,
    ...(collapsible === false ? {collapsible: false} : {}),
    timestamp: new Intl.DateTimeFormat(getLang() === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date())
  };
}

function toUiMessage(message: StoredUiMessage): UiMessage {
  return {
    ...message
  };
}

function trimHistorySafely(history: ChatCompletionMessageParam[], maxCount: number): ChatCompletionMessageParam[] {
  if (history.length <= maxCount) {
    return history;
  }

  let startIndex = history.length - maxCount;

  while (startIndex < history.length && history[startIndex]?.role !== 'user') {
    startIndex += 1;
  }

  if (startIndex === history.length) {
    return history.slice(-maxCount);
  }

  return history.slice(startIndex);
}

function createMemorySnapshot(input: {
  modelLabel: string;
  sessionName: string;
  themeName: ThemeName;
  tokenCount: number;
  promptHistory: string[];
  history: ChatCompletionMessageParam[];
  messages: UiMessage[];
}): MemoryState {
  return {
    ...createEmptyMemory(input.modelLabel, input.sessionName),
    sessionName: input.sessionName,
    modelLabel: input.modelLabel,
    themeName: input.themeName,
    tokenCount: input.tokenCount,
    promptHistory: input.promptHistory.slice(-50),
    history: trimHistorySafely(input.history, 30),
    uiMessages: input.messages.slice(-80).map(({id, kind, text, timestamp}) => ({
      id,
      kind,
      text,
      timestamp
    }))
  };
}

function requireSessionName(name: string): string {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error(t('err_session_required'));
  }

  return trimmedName;
}

function isThinkingPlaceholder(message: UiMessage): boolean {
  if (message.kind !== 'tool') {
    return false;
  }

  const text = message.text.toLowerCase();
  return (
    text.includes('thinking') ||
    text.includes('думаю') ||
    text.startsWith('◇') && text.length < 40
  );
}

function patchApprovalToolMessages(
  history: ChatCompletionMessageParam[],
  toolCallResultStr: string,
  toolCallId?: string
): ChatCompletionMessageParam[] {
  return history.map((msg) => {
    if (msg.role !== 'tool' || typeof msg.content !== 'string') {
      return msg;
    }

    if (toolCallId && msg.tool_call_id === toolCallId) {
      return {...msg, content: toolCallResultStr};
    }

    if (msg.content.includes('"needsApproval":true')) {
      return {...msg, content: toolCallResultStr};
    }

    return msg;
  });
}

function trimToolOutput(output: string): string {
  const trimmed = output.trim();

  if (!trimmed) {
    return '(no output)';
  }

  if (trimmed.length <= 900) {
    return trimmed;
  }

  return `${trimmed.slice(0, 900)}\n...`;
}
