// File: src/app/chat/chat.service.ts
import { LongMemory } from '../../core/memory/long.memory.js';
import { ShortMemory } from '../../core/memory/short.memory.js';
export class ChatService {
    longMemory;
    shortMemory;
    constructor() {
        this.longMemory = new LongMemory();
        this.shortMemory = new ShortMemory();
    }
    async startSession(sessionName) {
        const memory = await this.longMemory.loadMemory(undefined, sessionName);
        this.shortMemory.setHistory(memory.history);
        this.shortMemory.setUiMessages(memory.uiMessages);
        this.shortMemory.setPromptHistory(memory.promptHistory);
        this.shortMemory.setTokenCount(memory.tokenCount);
        return memory;
    }
    async saveSession(modelLabel) {
        const activeSessionName = await this.longMemory.loadCurrentSessionName();
        const state = {
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
    getHistory() {
        return this.shortMemory.getHistory();
    }
    setHistory(history) {
        this.shortMemory.setHistory(history);
    }
    addMessage(message) {
        this.shortMemory.addMessage(message);
    }
    async clearHistory(sessionName) {
        this.shortMemory.clear();
        await this.longMemory.clearMemory(sessionName);
    }
}
