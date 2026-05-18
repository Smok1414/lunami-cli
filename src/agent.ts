import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { streamComplete, type LlmToolCall, systemPrompt, type LLMResponse } from './llm.js';
import { getAgentTools } from './agentTools.js';
import { getMcpManager } from './mcp/manager.js';
import { isMcpToolName } from './mcp/names.js';
import {
  agentSkipsApprovals,
  getAgentMode,
  getCwd,
  getFullContext,
  setPendingApproval,
  type AgentMode
} from './state.js';
import { readFile, writeFile, previewWrite } from './tools/fs.js';
import { execCommand } from './tools/exec.js';
import { generateProject, type GenerateProjectType } from './tools/generate.js';
import { gitCommit, gitDiff, gitStatus } from './tools/git.js';
import { listTree } from './tools/tree.js';
import { searchCode } from './tools/search.js';
import { compressConversationMessages } from './contextCompress.js';
import {
  bumpToolCount,
  createEmptyToolCounts,
  finishActivityStep,
  formatWorkLabel,
  type ActivityStep
} from './activity.js';
import { t } from './i18n.js';

export type AgentStatus = 'IDLE' | 'ACTIVE' | 'TOOL' | 'DONE' | 'ERROR';

export type AgentEvent =
  | {
    type: 'status';
    status: AgentStatus;
    label?: string;
    chain?: { names: string[]; activeIndex: number };
  }
  | {
    type: 'error';
    message: string;
  }
  | {
    type: 'assistant';
    content: string;
  }
  | {
    type: 'assistant_start';
    id: string;
  }
  | {
    type: 'assistant_delta';
    id: string;
    delta: string;
  }
  | {
    type: 'assistant_done';
    id: string;
  }
  | {
    type: 'tool_start';
    name: string;
    summary: string;
  }
  | {
    type: 'tool';
    name: string;
    summary: string;
  }
  | {
    type: 'progress';
    value: number;
  }
  | {
    type: 'tokens';
    total: number;
    prompt?: number;
    completion?: number;
  }
  | {
    type: 'activity';
    steps: ActivityStep[];
  };

export type AgentRunOptions = {
  input?: string;
  mentionPreamble?: string;
  history: ChatCompletionMessageParam[];
  sessionName?: string;
  mode?: AgentMode;
  skipWriteApproval?: boolean;
  onEvent: (event: AgentEvent) => void;
};

const maxToolRounds = 8;

export async function runAgent({
  input,
  mentionPreamble,
  history,
  sessionName,
  mode: requestedMode,
  skipWriteApproval = false,
  onEvent
}: AgentRunOptions): Promise<ChatCompletionMessageParam[]> {
  const mode = requestedMode ?? getAgentMode();
  const projectContext = (await getFullContext()).trim();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Current LUNAMI session: ${sessionName ?? 'default'}. Working directory: ${getCwd()}. Agent mode: ${mode}.` },
    ...(projectContext ? [{ role: 'system' as const, content: `Project context:\n${projectContext}` }] : []),
    ...(mentionPreamble ? [{ role: 'system' as const, content: mentionPreamble }] : []),
    ...(mode === 'plan'
      ? [{
        role: 'system' as const,
        content: 'PLAN MODE: do not call tools, do not edit files, do not run commands. Return a concise implementation plan and risks only.'
      }]
      : []),
    ...history,
    ...(input ? [{ role: 'user' as const, content: input }] : [])
  ];

  onEvent({ type: 'status', status: 'ACTIVE' });
  onEvent({ type: 'progress', value: 18 });

  let toolChainIndex = 0;
  const toolChain: string[] = [];
  const activitySteps: ActivityStep[] = [];
  const requestTools = await getAgentTools(mode);

  const emitActivity = () => {
    onEvent({ type: 'activity', steps: activitySteps.map((step) => ({ ...step })) });
  };

  for (let round = 0; round < maxToolRounds; round += 1) {
    const streamId = createStreamId();
    let streamedText = false;
    let deltaBuffer = '';
    let lastFlush = Date.now();
    const phaseId = mode === 'plan' ? `plan-${round}` : `thought-${round}`;
    const phaseLabel = mode === 'plan' ? t('activity_planning') : t('activity_thought');
    const phaseKind = mode === 'plan' ? 'planning' as const : 'thought' as const;
    const phaseStartedAt = Date.now();

    activitySteps.push({
      id: phaseId,
      kind: phaseKind,
      label: phaseLabel,
      status: 'active'
    });
    emitActivity();

    const flushBuffer = () => {
      if (deltaBuffer) {
        onEvent({ type: 'assistant_delta', id: streamId, delta: deltaBuffer });
        deltaBuffer = '';
      }
    };

    let response: LLMResponse;
    try {
      response = await streamComplete(
        messages,
        {
          onTextDelta: async (delta) => {
            if (!streamedText) {
              streamedText = true;
              onEvent({ type: 'assistant_start', id: streamId });
            }

            deltaBuffer += delta;

            if (Date.now() - lastFlush > 35) {
              flushBuffer();
              lastFlush = Date.now();
            }
          }
        },
        requestTools
      );
    } catch (error: any) {
      if (error?.status === 413 || error?.message?.includes('413') || error?.message?.includes('too large')) {
        const systemMessages = messages.filter((m) => m.role === 'system');
        const nonSystem = messages.filter((m) => m.role !== 'system');
        const compressed = compressConversationMessages(systemMessages, nonSystem);
        messages.length = 0;
        messages.push(...compressed.messages);
        onEvent({ type: 'error', message: t('agent_context_compressed') });
        continue;
      }
      throw error;
    }

    flushBuffer();

    messages.push(response.message);

    if (streamedText) {
      onEvent({ type: 'assistant_done', id: streamId });
    }

    if (typeof response.usage?.totalTokens === 'number') {
      onEvent({
        type: 'tokens',
        total: response.usage.totalTokens,
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens
      });
    }

    if (!streamedText && response.content.trim()) {
      onEvent({ type: 'assistant', content: response.content.trim() });
    }

    finishActivityStep(activitySteps, phaseId, phaseStartedAt);
    emitActivity();

    if (response.toolCalls.length === 0) {
      onEvent({ type: 'progress', value: 100 });
      onEvent({ type: 'status', status: 'DONE' });
      return stripSystemMessage(messages);
    }

    toolChain.push(...response.toolCalls.map((t) => t.name));

    onEvent({ type: 'status', status: 'TOOL' });
    onEvent({ type: 'progress', value: Math.min(85, 35 + round * 10) });

    const workId = `work-${round}`;
    const workStartedAt = Date.now();
    const toolCounts = createEmptyToolCounts();

    activitySteps.push({
      id: workId,
      kind: 'work',
      label: formatWorkLabel(toolCounts),
      status: 'active'
    });
    emitActivity();

    const toolResults: { id: string; name: string; content: string; summary: string }[] = [];
    let hasApprovalRequired = false;

    for (const toolCall of response.toolCalls) {
      const toolActionLabels: Record<string, string> = {
        readFile: t('agent_analyzing'),
        tree: t('agent_analyzing'),
        writeFile: t('agent_writing'),
        search: t('agent_searching'),
        execCommand: t('agent_checking'),
        generateProject: t('agent_creating'),
        gitStatus: t('agent_git'),
        gitDiff: t('agent_git'),
        gitCommit: t('agent_git')
      };

      const actionLabel = toolActionLabels[toolCall.name]
        ?? (isMcpToolName(toolCall.name) ? t('agent_mcp') : t('agent_thinking'));
      onEvent({
        type: 'status',
        status: 'TOOL',
        label: actionLabel,
        chain: { names: toolChain, activeIndex: toolChainIndex }
      });
      onEvent({ type: 'tool_start', name: toolCall.name, summary: formatToolStart(toolCall) });

      const result = await executeToolCall(toolCall, { mode, skipWriteApproval });
      toolChainIndex++;
      bumpToolCount(toolCounts, toolCall.name);
      const workStep = activitySteps.find((step) => step.id === workId);

      if (workStep) {
        workStep.label = formatWorkLabel(toolCounts);
        emitActivity();
      }

      onEvent({ type: 'tool', name: result.name, summary: result.summary });
      toolResults.push(result);

      try {
        const parsed = JSON.parse(result.content);
        if (parsed && typeof parsed === 'object' && parsed.needsApproval === true) {
          hasApprovalRequired = true;
          break;
        }
      } catch {}
    }

    finishActivityStep(activitySteps, workId, workStartedAt);
    const finishedWork = activitySteps.find((step) => step.id === workId);

    if (finishedWork) {
      finishedWork.label = formatWorkLabel(toolCounts);
    }

    emitActivity();

    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        tool_call_id: result.id,
        content: result.content
      });
    }

    if (hasApprovalRequired) {
      onEvent({ type: 'progress', value: 100 });
      onEvent({ type: 'status', status: 'DONE' });
      return stripSystemMessage(messages);
    }
  }

  onEvent({ type: 'error', message: t('agent_max_rounds') });
  onEvent({ type: 'status', status: 'ERROR' });
  return stripSystemMessage(messages);
}

function createStreamId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


async function executeToolCall(
  toolCall: LlmToolCall,
  options: { mode: AgentMode; skipWriteApproval: boolean }
): Promise<{
  id: string;
  name: string;
  content: string;
  summary: string;
}> {
  try {
    switch (toolCall.name) {
      case 'readFile': {
        const path = getStringArg(toolCall, 'path');
        const result = await readFile(path);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: result.content,
          summary: `${result.path} read`
        };
      }

      case 'writeFile': {
        const path = getStringArg(toolCall, 'path');
        const content = getStringArg(toolCall, 'content');

        if (options.mode === 'auto' && !options.skipWriteApproval) {
          const preview = await previewWrite(path, content);
          const approval = setPendingApproval({
            type: 'writeFile',
            path,
            content,
            diff: preview.diff,
            isNew: preview.isNew,
            linesAdded: preview.linesAdded,
            linesRemoved: preview.linesRemoved,
            toolCallId: toolCall.id
          });
          const action = preview.isNew ? 'create' : 'modify';

          return {
            id: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify({
              ok: false,
              needsApproval: true,
              approvalId: approval.id,
              path: preview.path,
              isNew: preview.isNew
            }),
            summary: [
              t('write_approval_pending', preview.path, action),
              ...preview.diff,
              t('write_approval_actions')
            ].join('\n')
          };
        }

        const result = await writeFile(path, content);
        const action = result.isNew ? 'created' : 'modified';
        const diff = formatLineDiff(result.linesAdded, result.linesRemoved, result.isNew);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: [`${result.path} ${action}${diff}`, ...result.diff].join('\n')
        };
      }

      case 'search': {
        const pattern = getStringArg(toolCall, 'pattern');
        const path = typeof toolCall.arguments.path === 'string' ? toolCall.arguments.path : '.';
        const result = await searchCode(pattern, path);
        const body = result.matches.length > 0 ? result.matches.join('\n') : '(no matches)';
        const truncatedNote = result.truncated ? `\n(${t('search_truncated')})` : '';

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify({ ...result, matches: result.matches }),
          summary: `${result.engine}: ${result.matches.length} match(es)\n${body}${truncatedNote}`
        };
      }

      case 'generateProject': {
        const name = getStringArg(toolCall, 'name');
        const type = getProjectTypeArg(toolCall, 'type');
        const result = await generateProject(name, type);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: `${result.root} scaffold created (${result.files.length} files)\n${result.runInstructions}`
        };
      }

      case 'execCommand': {
        const command = getStringArg(toolCall, 'command');

        if (isDangerousCommand(command) && !agentSkipsApprovals(options.mode)) {
          const approval = setPendingApproval({ type: 'execCommand', command });

          return {
            id: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify({ ok: false, needsApproval: true, approvalId: approval.id, command }),
            summary: `approval required: ${command}\nUse /approve to run or /deny to cancel.`
          };
        }

        const result = await execCommand(command);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: `command finished: ${result.exitCode}`
        };
      }

      case 'tree': {
        const depth = getNumberArg(toolCall, 'depth', 2);
        const result = await listTree(depth);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: result.tree
        };
      }

      case 'gitStatus': {
        const result = await gitStatus();

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: result.stdout.trim() || result.stderr.trim() || 'git status clean'
        };
      }

      case 'gitDiff': {
        const result = await gitDiff();

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(result),
          summary: result.stdout.trim() || result.stderr.trim() || 'no git diff'
        };
      }

      case 'gitCommit': {
        const message = getStringArg(toolCall, 'message');

        if (!agentSkipsApprovals(options.mode)) {
          const approval = setPendingApproval({ type: 'gitCommit', message });

          return {
            id: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify({ ok: false, needsApproval: true, approvalId: approval.id, message }),
            summary: `approval required: git commit -am "${message}"\nUse /approve to commit or /deny to cancel.`
          };
        }

        const commitResult = await gitCommit(message);

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify(commitResult),
          summary: commitResult.stdout.trim() || commitResult.stderr.trim() || `git commit: ${message}`
        };
      }

      default: {
        if (isMcpToolName(toolCall.name)) {
          if (options.mode === 'plan') {
            return {
              id: toolCall.id,
              name: toolCall.name,
              content: JSON.stringify({ ok: false, error: 'MCP tools are disabled in plan mode.' }),
              summary: 'error: MCP tools disabled in plan mode'
            };
          }

          const result = await getMcpManager().callTool(toolCall.name, toolCall.arguments);

          return {
            id: toolCall.id,
            name: toolCall.name,
            content: result.content,
            summary: result.summary
          };
        }

        return {
          id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify({ ok: false, error: `Unknown tool: ${toolCall.name}` }),
          summary: `error: unknown tool ${toolCall.name}`
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      id: toolCall.id,
      name: toolCall.name,
      content: JSON.stringify({ ok: false, error: message }),
      summary: `error: ${message}`
    };
  }
}

function getStringArg(toolCall: LlmToolCall, key: string): string {
  let value = toolCall.arguments[key];

  if (value === undefined && key === 'content' && toolCall.name === 'writeFile') {
    return '';
  }

  if (typeof value === 'object' && value !== null) {
    value = JSON.stringify(value);
  }

  if (typeof value !== 'string') {
    if (key === 'path' && toolCall.name === 'writeFile') {
      throw new Error(`Tool writeFile requires string argument "path". Ensure you provide "path" BEFORE "content" in your JSON, or it may be lost due to truncation.`);
    }
    throw new Error(`Tool ${toolCall.name} requires string argument "${key}".`);
  }

  return value;
}

function getProjectTypeArg(toolCall: LlmToolCall, key: string): GenerateProjectType {
  const value = getStringArg(toolCall, key);

  if (!['react', 'node', 'next', 'python'].includes(value)) {
    throw new Error(`Tool ${toolCall.name} requires project type "react", "node", "next", or "python".`);
  }

  return value as GenerateProjectType;
}

function getNumberArg(toolCall: LlmToolCall, key: string, fallback: number): number {
  const value = toolCall.arguments[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stripSystemMessage(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  return messages.filter((message) => message.role !== 'system');
}

function formatLineDiff(added: number, removed: number, isNew: boolean): string {
  if (isNew) {
    return added > 0 ? ` (+${added})` : '';
  }

  const parts: string[] = [];

  if (added > 0) {
    parts.push(`+${added}`);
  }

  if (removed > 0) {
    parts.push(`-${removed}`);
  }

  return parts.length > 0 ? ` (${parts.join(' ')})` : '';
}

function formatToolStart(toolCall: LlmToolCall): string {
  if (toolCall.name === 'readFile' || toolCall.name === 'writeFile') {
    const path = typeof toolCall.arguments.path === 'string' ? toolCall.arguments.path : '?';
    return `◇ tool: ${toolCall.name}(${path})`;
  }

  if (toolCall.name === 'search') {
    const pattern = typeof toolCall.arguments.pattern === 'string' ? toolCall.arguments.pattern : '?';
    return `◇ tool: search(${pattern})`;
  }

  if (toolCall.name === 'execCommand') {
    const command = typeof toolCall.arguments.command === 'string' ? toolCall.arguments.command : '?';
    return `◇ tool: execCommand(${command})`;
  }

  if (isMcpToolName(toolCall.name)) {
    return `◇ tool: ${toolCall.name}`;
  }

  return `◇ tool: ${toolCall.name}`;
}

function isDangerousCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();

  return [
    /\brm\s+(-[a-z]*r[a-z]*|-rf|-fr)\b/,
    /\bdel\s+(\/[fsq]\s*)+/,
    /\brmdir\s+(\/s|-[a-z]*r)/,
    /\brd\s+(\/s|-[a-z]*r)/, // Windows rd directory deletion
    /\bformat\s+[a-z]:/,
    /\bgit\s+reset\b/,
    /\bnpm\s+(install|i)\s+(-g|--global)\b/
  ].some((pattern) => pattern.test(normalized)) || (/\brd\b/.test(normalized) && /\b\/s\b/.test(normalized));
}
