// File: src/core/agent/planner.ts

export class Planner {
  public async generatePlan(
    goal: string,
    context: string,
    llmCall: (prompt: string) => Promise<string>
  ): Promise<string[]> {
    const prompt = `You are LUNAMI CLI's Planner. Given the user's goal and context, create a list of logical steps to achieve it.
Keep the plan concise. Provide each step on a new line starting with a bullet point (-).

User Goal:
"${goal}"

Project Context:
${context}

Outline the implementation steps:`;

    try {
      const output = await llmCall(prompt);
      const steps = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
        .map((line) => line.replace(/^[-*\s\d.]+\s*/, ''));

      if (steps.length > 0) {
        return steps;
      }
    } catch {
      // Ignore error and fall back
    }

    return [`Analyze the project structure and achieve: ${goal}`];
  }
}
