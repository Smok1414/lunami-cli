// File: src/utils/terminal.ts
import { execSync } from 'node:child_process';
/**
 * Use ASCII-safe UI (no round borders, no splash animation).
 * Default: Unicode on interactive terminals (including Windows after UTF-8 setup).
 * Set LUNAMI_ASCII=1 for legacy consoles that show garbled box characters.
 */
export function prefersAsciiOutput() {
    if (process.env.LUNAMI_ASCII === '1') {
        return true;
    }
    if (process.env.LUNAMI_FORCE_UNICODE === '1') {
        return false;
    }
    // Non-TTY output (pipes, CI logs): keep plain text.
    if (!process.stdout.isTTY) {
        return true;
    }
    return false;
}
export function asciiFallback(unicodeText, asciiText) {
    return prefersAsciiOutput() ? asciiText : unicodeText;
}
export function prepareTerminalEncoding() {
    if (process.platform !== 'win32') {
        return;
    }
    try {
        execSync('chcp 65001', { stdio: 'ignore' });
    }
    catch {
        // Best effort only.
    }
    process.env.LANG ||= 'en_US.UTF-8';
    process.env.LC_ALL ||= 'en_US.UTF-8';
    if (typeof process.stdout.setDefaultEncoding === 'function') {
        process.stdout.setDefaultEncoding('utf8');
    }
    if (typeof process.stderr.setDefaultEncoding === 'function') {
        process.stderr.setDefaultEncoding('utf8');
    }
}
