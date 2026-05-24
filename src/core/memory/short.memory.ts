// File: src/core/memory/short.memory.ts

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { StoredUiMessage } from './long.memory.js';

export class ShortMemory {
  private history: ChatCompletionMessageParam[] = [];
  private uiMessages: StoredUiMessage[] = [];
  private promptHistory: string[] = [];
  private tokenCount = 0;

  public getHistory(): ChatCompletionMessageParam[] {
    return this.history;
  }

  public setHistory(history: ChatCompletionMessageParam[]): void {
    this.history = history;
  }

  public addMessage(message: ChatCompletionMessageParam): void {
    this.history.push(message);
  }

  public getUiMessages(): StoredUiMessage[] {
    return this.uiMessages;
  }

  public setUiMessages(messages: StoredUiMessage[]): void {
    this.uiMessages = messages;
  }

  public addUiMessage(message: StoredUiMessage): void {
    this.uiMessages.push(message);
  }

  public getPromptHistory(): string[] {
    return this.promptHistory;
  }

  public setPromptHistory(prompts: string[]): void {
    this.promptHistory = prompts;
  }

  public addPrompt(prompt: string): void {
    this.promptHistory.push(prompt);
  }

  public getTokenCount(): number {
    return this.tokenCount;
  }

  public setTokenCount(count: number): void {
    this.tokenCount = count;
  }

  public clear(): void {
    this.history = [];
    this.uiMessages = [];
    this.tokenCount = 0;
  }
}
