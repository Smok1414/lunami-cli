/**
 * Вставляет или обновляет строку переменной окружения в содержимом .env файла.
 * 
 * @param content - Текущее содержимое файла .env
 * @param key - Название переменной (например, 'LUNAMI_LANG')
 * @param value - Значение переменной
 * @returns Обновленное содержимое .env
 */
export function upsertEnvLine(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*\\n?`, 'gm');
  const trimmed = content.replace(pattern, '').trimEnd();

  return trimmed.length > 0
    ? `${trimmed}\n${key}=${value}\n`
    : `${key}=${value}\n`;
}
