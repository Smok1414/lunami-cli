// File: src/cli/commands/chat.command.ts

import { ChatService } from '../../app/chat/chat.service.js';

export class ChatCommand {
  private readonly chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  public async clearSession(sessionName?: string): Promise<void> {
    await this.chatService.clearHistory(sessionName);
  }

  public async startSession(sessionName?: string): Promise<void> {
    await this.chatService.startSession(sessionName);
  }

  public async saveSession(modelLabel: string): Promise<void> {
    await this.chatService.saveSession(modelLabel);
  }
}
