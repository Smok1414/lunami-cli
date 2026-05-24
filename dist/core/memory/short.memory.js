// File: src/core/memory/short.memory.ts
export class ShortMemory {
    history = [];
    uiMessages = [];
    promptHistory = [];
    tokenCount = 0;
    getHistory() {
        return this.history;
    }
    setHistory(history) {
        this.history = history;
    }
    addMessage(message) {
        this.history.push(message);
    }
    getUiMessages() {
        return this.uiMessages;
    }
    setUiMessages(messages) {
        this.uiMessages = messages;
    }
    addUiMessage(message) {
        this.uiMessages.push(message);
    }
    getPromptHistory() {
        return this.promptHistory;
    }
    setPromptHistory(prompts) {
        this.promptHistory = prompts;
    }
    addPrompt(prompt) {
        this.promptHistory.push(prompt);
    }
    getTokenCount() {
        return this.tokenCount;
    }
    setTokenCount(count) {
        this.tokenCount = count;
    }
    clear() {
        this.history = [];
        this.uiMessages = [];
        this.tokenCount = 0;
    }
}
