// File: src/cli/commands/chat.command.ts
import { ChatService } from '../../app/chat/chat.service.js';
export class ChatCommand {
    chatService;
    constructor() {
        this.chatService = new ChatService();
    }
    async clearSession(sessionName) {
        await this.chatService.clearHistory(sessionName);
    }
    async startSession(sessionName) {
        await this.chatService.startSession(sessionName);
    }
    async saveSession(modelLabel) {
        await this.chatService.saveSession(modelLabel);
    }
}
