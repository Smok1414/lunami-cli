// File: src/core/agent/loop.ts
import { Planner } from './planner.js';
import { Executor } from './executor.js';
import { Reflector } from './reflector.js';
export class AgentLoop {
    planner;
    executor;
    reflector;
    constructor() {
        this.planner = new Planner();
        this.executor = new Executor();
        this.reflector = new Reflector();
    }
    async run(goal, context, maxSteps, llmCall, getToolCallsFromLlm, onStepUpdate) {
        const safeMaxSteps = Number.isFinite(maxSteps) ? Math.max(1, Math.floor(maxSteps)) : 1;
        let plan = await this.planner.generatePlan(goal, context, llmCall);
        const executionHistory = [];
        let currentFeedback = '';
        onStepUpdate?.({ stepIndex: 0, phase: 'PLAN', plan });
        for (let step = 0; step < safeMaxSteps; step++) {
            const promptForAct = this.buildActPrompt(goal, plan, executionHistory, currentFeedback);
            const toolCalls = await getToolCallsFromLlm(promptForAct);
            onStepUpdate?.({ stepIndex: step, phase: 'ACT', plan, toolCalls });
            if (toolCalls.length === 0) {
                const reflection = await this.reflector.reflectSemantically(goal, executionHistory, plan, llmCall, 'The ACT phase returned no tool calls.');
                onStepUpdate?.({ stepIndex: step, phase: 'REFLECT', plan, toolCalls, reflection });
                if (reflection.decision === 'finish') {
                    return { success: true, reason: reflection.reason };
                }
                if (reflection.decision === 'adjust') {
                    plan = await this.planner.generatePlan(goal, `${context}\nAdjustment feedback: ${reflection.feedback || reflection.reason}`, llmCall);
                }
                currentFeedback = reflection.feedback || reflection.reason;
                continue;
            }
            const stepResults = [];
            for (const toolCall of toolCalls) {
                const result = await this.executor.execute(toolCall);
                stepResults.push({
                    toolName: toolCall.name,
                    args: toolCall.arguments,
                    result
                });
                executionHistory.push({
                    toolName: toolCall.name,
                    args: toolCall.arguments,
                    result
                });
            }
            const reflection = await this.reflector.reflectSemantically(goal, executionHistory, plan, llmCall, currentFeedback);
            onStepUpdate?.({
                stepIndex: step,
                phase: 'REFLECT',
                plan,
                toolCalls,
                toolResults: stepResults,
                reflection
            });
            if (reflection.decision === 'finish') {
                return { success: true, reason: reflection.reason };
            }
            if (reflection.decision === 'adjust') {
                plan = await this.planner.generatePlan(goal, context + `\nAdjustment feedback: ${reflection.feedback || reflection.reason}`, llmCall);
                currentFeedback = reflection.feedback || '';
                onStepUpdate?.({ stepIndex: step + 1, phase: 'PLAN', plan });
                continue;
            }
            currentFeedback = reflection.feedback || '';
        }
        return {
            success: false,
            reason: `Exceeded maximum steps (${safeMaxSteps}) without completing the goal.`
        };
    }
    buildActPrompt(goal, plan, executionHistory, feedback) {
        const history = executionHistory.length > 0
            ? executionHistory
                .map((h, i) => `Step ${i + 1}: ${h.toolName} -> success: ${h.result.success}, output: ${h.result.output.slice(0, 500)}${h.result.error ? `, error: ${h.result.error}` : ''}`)
                .join('\n')
            : 'No tools executed yet.';
        return `Goal: "${goal}"
Current Plan:
${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Execution History:
${history}
${feedback ? `\nFeedback from previous reflection:\n${feedback}\n` : ''}
ACT phase:
Choose the next safest tool call(s) needed to advance the plan. If a previous step failed, fix that concrete bug before trying unrelated work.`;
    }
}
