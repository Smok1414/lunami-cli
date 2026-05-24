// File: src/app/chat/chat.service.ts

import { LongMemory, type MemoryState } from '../../core/memory/long.memory.js';
import { ShortMemory } from '../../core/memory/short.memory.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class ChatService {
  private longMemory: LongMemory;
  private shortMemory: ShortMemory;

  constructor() {
    this.longMemory = new LongMemory();
    this.shortMemory = new ShortMemory();
  }

  public async startSession(sessionName?: string): Promise<MemoryState> {
    const memory = await this.longMemory.loadMemory(undefined, sessionName);
    this.shortMemory.setHistory(memory.history);
    this.shortMemory.setUiMessages(memory.uiMessages);
    this.shortMemory.setPromptHistory(memory.promptHistory);
    this.shortMemory.setTokenCount(memory.tokenCount);
    return memory;
  }

  public async saveSession(modelLabel: string): Promise<void> {
    const activeSessionName = await this.longMemory.loadCurrentSessionName();
    const state: MemoryState = {
      version: 1,
      sessionName: activeSessionName,
      updatedAt: new Date().toISOString(),
      modelLabel,
      themeName: 'midnight',
      tokenCount: this.shortMemory.getTokenCount(),
      promptHistory: this.shortMemory.getPromptHistory(),
      history: this.shortMemory.getHistory(),
      uiMessages: this.shortMemory.getUiMessages()
    };
    await this.longMemory.saveMemory(state);
  }

  public getHistory(): ChatCompletionMessageParam[] {
    return this.shortMemory.getHistory();
  }

  public setHistory(history: ChatCompletionMessageParam[]): void {
    this.shortMemory.setHistory(history);
  }

  public addMessage(message: ChatCompletionMessageParam): void {
    this.shortMemory.addMessage(message);
  }

  public async clearHistory(sessionName?: string): Promise<void> {
    this.shortMemory.clear();
    await this.longMemory.clearMemory(sessionName);
  }
}
