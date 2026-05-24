// File: src/core/agent/reflector.ts

import type { ToolResult } from '../../types/index.js';

export interface ReflectionResult {
  decision: 'retry' | 'adjust' | 'finish';
  reason: string;
  feedback?: string;
}

type ExecutedStep = {
  toolName: string;
  args: any;
  result: ToolResult;
};

export class Reflector {
  public reflectHeuristics(
    goal: string,
    steps: ExecutedStep[],
    currentPlan: string[]
  ): ReflectionResult | null {
    if (steps.length === 0) {
      return {
        decision: 'retry',
        reason: 'No tools have been executed yet.',
        feedback: 'Start with the safest tool call that gathers evidence or advances the first plan step.'
      };
    }

    const lastStep = steps[steps.length - 1]!;
    const repeatedFailure = this.detectRepeatedFailure(steps);

    if (!lastStep.result.success) {
      const errorMsg = lastStep.result.error || 'Unknown tool execution failure';
      return {
        decision: repeatedFailure ? 'adjust' : 'retry',
        reason: `Tool "${lastStep.toolName}" failed: ${errorMsg}`,
        feedback: repeatedFailure
          ? `The same tool failure repeated. Adjust the plan before continuing. Last failure: ${errorMsg}`
          : `Tool "${lastStep.toolName}" execution failed: "${errorMsg}". Fix the concrete bug, correct the parameters, or choose the appropriate recovery tool.`
      };
    }

    const parsedOutput = this.parseJsonObject(lastStep.result.output);

    if (parsedOutput && parsedOutput.needsApproval === true) {
      return {
        decision: 'finish',
        reason: `Action requires user approval${this.asString(parsedOutput.approvalId) ? ` (Approval ID: ${parsedOutput.approvalId})` : ''}.`
      };
    }

    if (parsedOutput && parsedOutput.ok === false) {
      const errorText = this.asString(parsedOutput.error) || this.asString(parsedOutput.stderr) || 'Tool returned ok:false.';
      return {
        decision: repeatedFailure ? 'adjust' : 'retry',
        reason: `Tool "${lastStep.toolName}" returned an unsuccessful structured output.`,
        feedback: repeatedFailure
          ? `The current approach is blocked by repeated invalid output. Adjust the plan. Last output: ${errorText}`
          : `Fix the issue reported by "${lastStep.toolName}": ${errorText}`
      };
    }

    if (this.isExecTool(lastStep.toolName) && parsedOutput) {
      const exitCode = typeof parsedOutput.exitCode === 'number' ? parsedOutput.exitCode : 0;
      if (exitCode !== 0) {
        const stderr = this.asString(parsedOutput.stderr);
        const stdout = this.asString(parsedOutput.stdout);
        const combined = `${stderr}\n${stdout}`.trim();
        const command = this.asString(parsedOutput.command) || '<unknown command>';
        const errorKind = this.classifyFailure(command, combined);

        return {
          decision: repeatedFailure ? 'adjust' : 'retry',
          reason: `${errorKind} failed with exit code ${exitCode}.`,
          feedback: repeatedFailure
            ? `The command "${command}" keeps failing. Adjust the plan before trying again.\n${combined}`
            : `Command "${command}" failed with exit code ${exitCode}. ${this.retryInstruction(errorKind)}\n${combined}`
        };
      }
    }

    const outputFailure = this.detectFailureText(lastStep.result.output);
    if (outputFailure) {
      return {
        decision: repeatedFailure ? 'adjust' : 'retry',
        reason: outputFailure,
        feedback: repeatedFailure
          ? `A similar failure appears to be repeating. Adjust the plan before continuing. ${outputFailure}`
          : `Inspect and fix the issue before continuing. ${outputFailure}`
      };
    }

    if (this.searchWasEmpty(lastStep.toolName, parsedOutput)) {
      return {
        decision: 'adjust',
        reason: 'Search completed but found no matching files.',
        feedback: 'The current search path or keywords did not find evidence. Adjust the plan with broader terms or inspect the project tree.'
      };
    }

    if (this.hasLikelyCompletionSignal(goal, steps, currentPlan)) {
      return {
        decision: 'finish',
        reason: 'Recent tool results contain no detected errors and match the current plan direction.'
      };
    }

    return null;
  }

  public async reflectSemantically(
    goal: string,
    steps: ExecutedStep[],
    currentPlan: string[],
    llmCall: (prompt: string) => Promise<string>,
    previousFeedback = ''
  ): Promise<ReflectionResult> {
    const heuristicResult = this.reflectHeuristics(goal, steps, currentPlan);
    if (heuristicResult) {
      return heuristicResult;
    }

    const formattedSteps = steps.length > 0
      ? steps
          .map(
            (s, idx) =>
              `Step ${idx + 1}: Tool "${s.toolName}" called with args: ${JSON.stringify(
                s.args
              )}\nOutput success: ${s.result.success}\nError: ${
                s.result.error || '<none>'
              }\nOutput preview: ${s.result.output.slice(0, 1000)}`
          )
          .join('\n\n')
      : 'No execution steps have completed.';

    const prompt = `You are the Reflector module of the LUNAMI CLI agent.
Your task is to deeply inspect the execution history and choose exactly one decision.

Goal to achieve:
"${goal}"

Current Plan:
${currentPlan.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Previous Reflection Feedback:
${previousFeedback || '<none>'}

Execution History:
${formattedSteps}

Detect:
1. Runtime errors, thrown exceptions, unhandled rejections, permission/path errors.
2. Compilation, typecheck, lint, or test failures.
3. Incomplete goals or outputs that do not satisfy the user's requested result.
4. Invalid tool outputs or blocked plans.

Decide:
- retry: use when the next step should fix a specific bug or rerun with corrected parameters.
- adjust: use when the plan is blocked, evidence is missing, or repeated retries are unlikely to work.
- finish: use only when the goal is fully met or the process is waiting for explicit user approval.

Respond in the following format:
DECISION: [retry / adjust / finish]
REASON: [Short explanation]
FEEDBACK: [Specific next instruction for retry or adjust, otherwise omit]`;

    try {
      const llmOutput = await llmCall(prompt);
      return this.parseLlmReflection(llmOutput);
    } catch (error) {
      return {
        decision: 'retry',
        reason: `Semantic reflection failed: ${error instanceof Error ? error.message : String(error)}.`,
        feedback: 'Retry reflection or continue with the safest smallest verification step.'
      };
    }
  }

  private parseLlmReflection(output: string): ReflectionResult {
    const decisionMatch = /DECISION:\s*(retry|adjust(?:\s+plan)?|finish)/i.exec(output);
    const reasonMatch = /REASON:\s*(.+)/i.exec(output);
    const feedbackMatch = /FEEDBACK:\s*([\s\S]+)/i.exec(output);

    const rawDecision = decisionMatch?.[1]?.toLowerCase().replace(/\s+plan$/, '');
    const decision = (rawDecision as 'retry' | 'adjust' | 'finish') || 'finish';
    const reason = reasonMatch?.[1]?.trim() || 'No explicit reason provided.';
    const feedback = feedbackMatch?.[1]?.trim();

    return {
      decision,
      reason,
      ...(feedback ? { feedback } : {})
    };
  }

  private isExecTool(toolName: string): boolean {
    return toolName === 'execCommand' || toolName === 'system.exec';
  }

  private parseJsonObject(output: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(output) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }

    return null;
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private classifyFailure(command: string, output: string): string {
    const combined = `${command}\n${output}`;

    if (/\b(tsc|typecheck|ts-node|tsx)\b|TS\d{4}|TypeScript/i.test(combined)) {
      return 'Compilation/typecheck';
    }

    if (/\b(jest|vitest|mocha|playwright|test)\b|FAIL\b|Tests?:\s+\d+\s+failed/i.test(combined)) {
      return 'Test';
    }

    if (/\b(eslint|lint)\b|LintError|Parsing error/i.test(combined)) {
      return 'Lint';
    }

    return 'Runtime command';
  }

  private retryInstruction(errorKind: string): string {
    if (errorKind === 'Compilation/typecheck') {
      return 'Fix the reported type or compilation error before retrying.';
    }

    if (errorKind === 'Test') {
      return 'Fix the failing assertion, fixture, or behavior before retrying tests.';
    }

    if (errorKind === 'Lint') {
      return 'Fix the lint/parser issue before retrying.';
    }

    return 'Fix the runtime failure before retrying.';
  }

  private detectFailureText(output: string): string | null {
    const patterns = [
      /\b(TypeError|ReferenceError|SyntaxError|RangeError|AggregateError):\s*[^\n]+/i,
      /\bUnhandledPromiseRejection\b[^\n]*/i,
      /\bERR_[A-Z0-9_]+\b[^\n]*/i,
      /\b(EACCES|ENOENT|EPERM|ECONNREFUSED|ETIMEDOUT)\b[^\n]*/i,
      /\b\d+\s+failed\b/i,
      /\bFAIL\b[^\n]*/i,
      /\bCompilation failed\b[^\n]*/i
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(output);
      if (match?.[0]) {
        return match[0].trim();
      }
    }

    return null;
  }

  private detectRepeatedFailure(steps: ExecutedStep[]): boolean {
    if (steps.length < 2) {
      return false;
    }

    const last = steps[steps.length - 1]!;
    const previous = steps[steps.length - 2]!;

    if (last.result.success || previous.result.success) {
      return false;
    }

    return last.toolName === previous.toolName && (last.result.error || '') === (previous.result.error || '');
  }

  private searchWasEmpty(toolName: string, parsedOutput: Record<string, unknown> | null): boolean {
    return toolName === 'search' && Array.isArray(parsedOutput?.matches) && parsedOutput.matches.length === 0;
  }

  private hasLikelyCompletionSignal(goal: string, steps: ExecutedStep[], currentPlan: string[]): boolean {
    const successfulSteps = steps.filter((step) => step.result.success);
    if (successfulSteps.length === 0) {
      return false;
    }

    const goalLooksLikeInspectionOnly = /\b(explain|inspect|read|show|list|find|search|status|diff)\b/i.test(goal);
    const lastTool = steps[steps.length - 1]!.toolName;

    if (goalLooksLikeInspectionOnly && ['readFile', 'file.read', 'search', 'tree', 'gitStatus', 'gitDiff'].includes(lastTool)) {
      return true;
    }

    const completedAction = successfulSteps.some((step) =>
      ['writeFile', 'file.write', 'execCommand', 'system.exec', 'generateProject', 'gitCommit'].includes(step.toolName)
    );

    return completedAction && currentPlan.length <= successfulSteps.length;
  }
}
