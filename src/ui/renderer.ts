// File: src/ui/renderer.ts

import { render } from 'ink';
import React from 'react';
import { WelcomeScreen, shouldShowWelcome, splashBackgroundColor } from './components/welcomeScreen.js';
import { App } from './App.js';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

const [bgR, bgG, bgB] = hexToRgb(splashBackgroundColor);
const tuiBackground = `\x1b[48;2;${bgR};${bgG};${bgB}m`;
const resetStyle = '\x1b[0m';

export function renderTUI(): void {
  if (process.stdout.isTTY) {
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

function paintTerminalBackground(): void {
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
