// File: src/ui/renderer.ts
import { render } from 'ink';
import React from 'react';
import { WelcomeScreen, shouldShowWelcome } from './components/welcomeScreen.js';
import { App } from './App.js';
import { prefersAsciiOutput } from '../utils/terminal.js';
const tuiBackground = '\x1b[48;2;16;39;43m';
const resetStyle = '\x1b[0m';
export function renderTUI() {
    if (process.stdout.isTTY && !prefersAsciiOutput()) {
        if (process.env.NO_COLOR === undefined && process.env.LUNAMI_NO_COLOR !== '1') {
            process.stdout.write(tuiBackground);
            process.once('exit', () => {
                process.stdout.write(resetStyle);
            });
        }
        paintTerminalBackground();
    }
    function Root() {
        const [showWelcome, setShowWelcome] = React.useState(shouldShowWelcome());
        if (showWelcome) {
            return React.createElement(WelcomeScreen, { onComplete: () => setShowWelcome(false) });
        }
        return React.createElement(App);
    }
    render(React.createElement(Root));
}
function paintTerminalBackground() {
    const columns = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const line = ' '.repeat(Math.max(1, columns));
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    if (process.env.NO_COLOR !== undefined || process.env.LUNAMI_NO_COLOR === '1') {
        return;
    }
    for (let row = 0; row < rows; row += 1) {
        process.stdout.write(line);
        if (row < rows - 1) {
            process.stdout.write('\n');
        }
    }
    process.stdout.write('\x1b[H');
}
