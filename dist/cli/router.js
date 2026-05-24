// File: src/cli/router.ts
import { ChatCommand } from './commands/chat.command.js';
import { AgentCommand } from './commands/agent.command.js';
import { ModelCommand } from './commands/model.command.js';
import { ConfigCommand } from './commands/config.command.js';
export class CliRouter {
    chatCmd;
    agentCmd;
    modelCmd;
    configCmd;
    constructor() {
        this.chatCmd = new ChatCommand();
        this.agentCmd = new AgentCommand();
        this.modelCmd = new ModelCommand();
        this.configCmd = new ConfigCommand();
    }
    async route(prompt) {
        const [command = ''] = prompt.slice(1).trim().split(/\s+/);
        if (command === 'clear') {
            await this.chatCmd.clearSession();
            return true;
        }
        if (command === 'plan') {
            this.agentCmd.setMode('plan');
            return true;
        }
        if (command === 'auto') {
            this.agentCmd.setMode('auto');
            return true;
        }
        if (command === 'yolo') {
            this.agentCmd.setMode('yolo');
            return true;
        }
        if (command === 'lunatic') {
            this.agentCmd.setMode('lunatic');
            return true;
        }
        return false;
    }
}
