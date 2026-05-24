// File: src/core/agent/agent.ts

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ReadTool } from '../../tools/file/read.tool.js';
import { WriteTool } from '../../tools/file/write.tool.js';
import { PatchTool } from '../../tools/file/patch.tool.js';
import { TreeTool } from '../../tools/file/tree.tool.js';
import { GenerateProjectTool } from '../../tools/file/generate.tool.js';
import { ExecTool } from '../../tools/system/exec.tool.js';
import { GitCommitTool, GitDiffTool, GitStatusTool } from '../../tools/system/git.tool.js';
import { SearchTool } from '../../tools/web/search.tool.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentLoop } from './loop.js';
import type { ITool } from '../tools/tool.interface.js';
import type { AgentRunOptions, AgentEvent, ToolResult } from '../../types/index.js';
import { streamComplete, type LLMResponse, systemPrompt, type LlmToolCall } from '../../llm.js';
import { getMcpManager } from '../../mcp/manager.js';
import { isMcpToolName } from '../../mcp/names.js';
import { getFullContext, getCwd, getAgentMode } from '../../state.js';
import { t } from '../../i18n.js';
import { compressConversationMessages } from '../../contextCompress.js';
import {
  bumpToolCount,
  createEmptyToolCounts,
  finishActivityStep,
  formatWorkLabel,
  type ActivityStep
} from '../../activity.js';

let toolsInitialized = false;
const outputGuardPrompt =
  'Output policy: project rules can guide implementation, but do not print internal PLAN/ACT/REFLECT scaffolding unless the user explicitly asks for that format. In AUTO or YOLO mode, prefer tool execution over asking clarifying questions for small create/build/fix tasks.';

export function normalizeMaxToolRounds(maxRounds?: number, fallback = 8): number {
  if (typeof maxRounds !== 'number' || !Number.isFinite(maxRounds)) {
    return fallback;
  }

  return Math.max(1, Math.floor(maxRounds));
}

export function initializeRegistry(): void {
  if (toolsInitialized) return;

  const registry = ToolRegistry.getInstance();

  // Register Phase 2 Native Tools
  registry.register(new ReadTool('readFile'));
  registry.register(new ReadTool('file.read'));
  registry.register(new WriteTool('writeFile'));
  registry.register(new WriteTool('file.write'));
  registry.register(new PatchTool('patchFile'));
  registry.register(new PatchTool('file.patch'));
  registry.register(new ExecTool('execCommand'));
  registry.register(new ExecTool('system.exec'));
  registry.register(new SearchTool());
  registry.register(new TreeTool());
  registry.register(new GenerateProjectTool());
  registry.register(new GitStatusTool());
  registry.register(new GitDiffTool());
  registry.register(new GitCommitTool());

  toolsInitialized = true;
}

export async function runAgent({
  input,
  mentionPreamble,
  history,
  sessionName,
  mode: requestedMode,
  maxRounds,
  skipWriteApproval = false,
  onEvent
}: AgentRunOptions): Promise<ChatCompletionMessageParam[]> {
  // Initialize native and legacy tools
  initializeRegistry();

  const mode = requestedMode ?? getAgentMode();

  // Register MCP tools dynamically
  if (mode !== 'plan') {
    try {
      const mcpTools = await getMcpManager().getLlmTools();
      for (const mcpTool of mcpTools) {
        ToolRegistry.getInstance().register({
          name: mcpTool.function.name,
          description: mcpTool.function.description || '',
          parameters: mcpTool.function.parameters || { type: 'object', properties: {} },
          execute: async (args: Record<string, any>): Promise<ToolResult> => {
            try {
              const result = await getMcpManager().callTool(mcpTool.function.name, args);
              return { success: true, output: result.content };
            } catch (error: any) {
              return { success: false, output: '', error: error.message || String(error) };
            }
          }
        });
      }
    } catch {
      // Ignore MCP loading issues
    }
  }

  const projectContext = (await getFullContext()).trim();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Current LUNAMI session: ${sessionName ?? 'default'}. Working directory: ${getCwd()}. Agent mode: ${mode}.` },
    ...(projectContext ? [{ role: 'system' as const, content: `Project context:\n${projectContext}` }] : []),
    { role: 'system', content: outputGuardPrompt },
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

  const maxToolRounds = normalizeMaxToolRounds(maxRounds);
  let toolChainIndex = 0;
  const toolChain: string[] = [];
  const activitySteps: ActivityStep[] = [];
  const registryLlmTools = ToolRegistry.getInstance().getLlmTools();

  const emitActivity = () => {
    onEvent({ type: 'activity', steps: activitySteps.map((step) => ({ ...step })) });
  };

  const createStreamId = () => `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const formatToolStart = (toolCall: LlmToolCall): string => {
    if (toolCall.name === 'readFile' || toolCall.name === 'writeFile' || toolCall.name === 'file.read' || toolCall.name === 'file.write') {
      const path = typeof toolCall.arguments.path === 'string' ? toolCall.arguments.path : '?';
      return `◇ tool: ${toolCall.name}(${path})`;
    }
    if (toolCall.name === 'search') {
      const pattern = typeof toolCall.arguments.pattern === 'string' ? toolCall.arguments.pattern : '?';
      return `◇ tool: search(${pattern})`;
    }
    if (toolCall.name === 'execCommand' || toolCall.name === 'system.exec') {
      const command = typeof toolCall.arguments.command === 'string' ? toolCall.arguments.command : '?';
      return `◇ tool: ${toolCall.name}(${command})`;
    }
    return `◇ tool: ${toolCall.name}`;
  };

  const stripSystemMessage = (msgs: ChatCompletionMessageParam[]) => msgs.filter((m) => m.role !== 'system');

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
          },
          intent: mode === 'plan' ? 'summary' : 'agent_loop'
        },
        registryLlmTools
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
        'file.read': t('agent_analyzing'),
        tree: t('agent_analyzing'),
        writeFile: t('agent_writing'),
        'file.write': t('agent_writing'),
        search: t('agent_searching'),
        execCommand: t('agent_checking'),
        'system.exec': t('agent_checking'),
        generateProject: t('agent_creating'),
        gitStatus: t('agent_git'),
        gitDiff: t('agent_git'),
        gitCommit: t('agent_git')
      };

      const actionLabel =
        toolActionLabels[toolCall.name] ??
        (isMcpToolName(toolCall.name) ? t('agent_mcp') : t('agent_thinking'));

      onEvent({
        type: 'status',
        status: 'TOOL',
        label: actionLabel,
        chain: { names: toolChain, activeIndex: toolChainIndex }
      });
      onEvent({ type: 'tool_start', name: toolCall.name, summary: formatToolStart(toolCall) });

      // Resolve from central ToolRegistry and execute
      const registeredTool = ToolRegistry.getInstance().get(toolCall.name);
      let success = false;
      let output = '';
      let error: string | undefined;

      if (registeredTool) {
        const res = await registeredTool.execute(toolCall.arguments, { toolCallId: toolCall.id });
        success = res.success;
        output = res.output;
        error = res.error;
      } else {
        error = `Tool "${toolCall.name}" not registered.`;
      }

      toolChainIndex++;
      bumpToolCount(toolCounts, toolCall.name);
      const workStep = activitySteps.find((step) => step.id === workId);

      if (workStep) {
        workStep.label = formatWorkLabel(toolCounts);
        emitActivity();
      }

      // Format legacy summary output compatible with Lunami 0.1.0 engine
      let summary = '';
      if (success) {
        try {
          const parsed = JSON.parse(output);
          if (parsed && typeof parsed === 'object') {
            if (toolCall.name === 'writeFile' || toolCall.name === 'file.write') {
              if (parsed.needsApproval) {
                const action = parsed.isNew ? 'create' : 'modify';
                summary = [
                  t('write_approval_pending', parsed.path, action),
                  t('write_approval_actions')
                ].join('\n');
              } else {
                const action = parsed.isNew ? 'created' : 'modified';
                const parts: string[] = [];
                if (parsed.linesAdded > 0) parts.push(`+${parsed.linesAdded}`);
                if (parsed.linesRemoved > 0) parts.push(`-${parsed.linesRemoved}`);
                const diffLabel = parts.length > 0 ? ` (${parts.join(' ')})` : '';
                summary = [`${parsed.path} ${action}${diffLabel}`, ...(parsed.diff || [])].join('\n');
              }
            } else if (toolCall.name === 'execCommand' || toolCall.name === 'system.exec') {
              if (parsed.needsApproval) {
                summary = `approval required: ${parsed.command}\nUse /approve to run or /deny to cancel.`;
              } else {
                summary = `command finished: ${parsed.exitCode}`;
              }
            } else if (toolCall.name === 'gitCommit' && parsed.needsApproval) {
              summary = `approval required: git commit -am "${parsed.message}"\nUse /approve to commit or /deny to cancel.`;
            } else {
              summary = parsed.summary || `${toolCall.name} complete`;
            }
          } else {
            summary = `${toolCall.name} complete`;
          }
        } catch {
          summary = `${toolCall.name} output ready`;
        }
      } else {
        summary = `error: ${error || 'Unknown error'}`;
      }

      onEvent({ type: 'tool', name: toolCall.name, summary });
      toolResults.push({
        id: toolCall.id,
        name: toolCall.name,
        content: success ? output : JSON.stringify({ ok: false, error }),
        summary
      });

      if (success) {
        try {
          const parsed = JSON.parse(output);
          if (parsed && typeof parsed === 'object' && parsed.needsApproval === true) {
            hasApprovalRequired = true;
            break;
          }
        } catch {}
      }
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
