// File: src/utils/helpers.ts
/**
 * Inserts or updates an environment variable line in the .env file contents.
 */
export function upsertEnvLine(content, key, value) {
    const pattern = new RegExp(`^${key}=.*\\n?`, 'gm');
    const trimmed = content.replace(pattern, '').trimEnd();
    return trimmed.length > 0 ? `${trimmed}\n${key}=${value}\n` : `${key}=${value}\n`;
}
