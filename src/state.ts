import {homedir} from 'node:os';
import {dirname, isAbsolute, relative, resolve} from 'node:path';
import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';

// Текущая рабочая директория агента
let currentCwd = process.cwd();

// Корневая рабочая директория проекта (первоначальный CWD при старте CLI)
let workspaceRoot = process.cwd();

// Режим работы агента: 'plan' (только планирование) или 'auto' (выполнение)
let agentMode: AgentMode = 'auto';

// Ожидающее подтверждение опасное действие (например, git commit или опасная команда)
let pendingApproval: PendingApproval | null = null;

// Стек для отмены последних записей файлов (undo)
const undoStack: UndoSnapshot[] = [];

/**
 * Режим работы агента
 * 'plan' - только планирование, без выполнения инструментов
 * 'auto' - инструменты с подтверждением записи и опасных команд
 * 'yolo' - инструменты без подтверждений (на свой риск)
 */
export type AgentMode = 'plan' | 'auto' | 'yolo' | 'lunatic';

export function agentSkipsApprovals(mode: AgentMode): boolean {
  return mode === 'yolo';
}

export function shouldSkipWriteApproval(mode: AgentMode): boolean {
  return (
    agentSkipsApprovals(mode) ||
    mode === 'lunatic' ||
    process.env.LUNAMI_YES === '1' ||
    process.env.LUNAMI_AUTO_APPROVE_WRITES === '1'
  );
}

/**
 * Тип для действия, ожидающего подтверждения пользователя
 * Используется для опасных операций, требующих явного разрешения
 */
export type PendingApproval =
  | {
      id: string;
      type: 'execCommand';
      command: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'gitCommit';
      message: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'writeFile';
      path: string;
      content: string;
      diff: string[];
      isNew: boolean;
      linesAdded: number;
      linesRemoved: number;
      toolCallId: string;
      createdAt: string;
    };

/**
 * Входные данные для создания ожидающего подтверждения действия
 * Без id и createdAt, которые генерируются автоматически
 */
export type PendingApprovalInput =
  | {
      type: 'execCommand';
      command: string;
    }
  | {
      type: 'gitCommit';
      message: string;
    }
  | {
      type: 'writeFile';
      path: string;
      content: string;
      diff: string[];
      isNew: boolean;
      linesAdded: number;
      linesRemoved: number;
      toolCallId: string;
    };

/**
 * Снимок состояния файла для функции отмены (undo)
 * Сохраняет информацию о файле до его изменения
 */
export type UndoSnapshot = {
  path: string;              // Абсолютный путь к файлу
  displayPath: string;        // Относительный путь для отображения
  existed: boolean;           // Существовал ли файл до изменения
  previousContent: string | null; // Предыдущее содержимое файла (null если файл был новым)
};

/**
 * Возвращает текущую рабочую директорию агента
 * @returns Абсолютный путь к текущей рабочей директории
 */
export function getCwd(): string {
  return currentCwd;
}

/**
 * Возвращает корневую директорию проекта (CWD при запуске)
 * @returns Абсолютный путь к корневой директории
 */
export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

/**
 * Устанавливает корневую директорию проекта
 * @param path - Абсолютный путь к корневой директории
 */
export function setWorkspaceRoot(path: string): void {
  workspaceRoot = path;
}

/**
 * Изменяет текущую рабочую директорию агента
 * Проверяет, что путь существует и является директорией
 * 
 * @param target - Целевой путь (относительный или абсолютный)
 * @returns Новый абсолютный путь рабочей директории
 * @throws Error если путь не найден или не является директорией
 */
export async function changeCwd(target: string): Promise<string> {
  // Разрешаем путь относительно текущей директории или домашней папки
  const resolved = resolveTarget(target);

  let stats;

  try {
    // Проверяем существование пути
    stats = await stat(resolved);
  } catch {
    throw new Error(`Path not found: ${target}`);
  }

  // Проверяем, что это директория
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${target}`);
  }

  // Рабочая зона записи файлов следует за /cd (иначе writeFile ломается после смены папки)
  currentCwd = resolved;
  workspaceRoot = resolved;
  process.chdir(resolved);
  return currentCwd;
}

/**
 * Разрешает путь относительно cwd и проверяет, что он внутри workspace.
 */
export function resolveProjectPath(path: string): string {
  const root = resolve(getWorkspaceRoot());
  const absolutePath = isAbsolute(path) ? resolve(path) : resolve(getCwd(), path);

  if (!isPathInsideWorkspace(root, absolutePath)) {
    throw new PathOutsideWorkspaceError(path, root, getCwd());
  }

  return absolutePath;
}

export class PathOutsideWorkspaceError extends Error {
  constructor(
    public readonly inputPath: string,
    public readonly workspaceRoot: string,
    public readonly currentCwd: string
  ) {
    super(
      `Path outside workspace is not allowed: ${inputPath}\n` +
        `  workspace: ${workspaceRoot}\n` +
        `  cwd: ${currentCwd}\n` +
        `  Use /cd <folder> or start with: npm run dev -- --cwd <folder>`
    );
    this.name = 'PathOutsideWorkspaceError';
  }
}

function isPathInsideWorkspace(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Возвращает отображаемый путь текущей директории
 * Заменяет домашнюю директорию на '~' для краткости
 * 
 * @returns Отформатированный путь для отображения пользователю
 * 
 * @example
 * // Если cwd = '/home/user/projects'
 * getDisplayCwd() // вернет '~/projects'
 */
export function getDisplayCwd(): string {
  const home = homedir().replace(/\\/g, '/');
  const cwd = currentCwd.replace(/\\/g, '/');

  // Если текущая директория - это домашняя папка
  if (cwd === home) {
    return '~';
  }

  // Если текущая директория внутри домашней папки
  if (cwd.startsWith(home + '/')) {
    return '~/' + cwd.slice(home.length + 1);
  }

  // Иначе возвращаем полный путь
  return cwd;
}

/**
 * Возвращает текущий режим работы агента
 * @returns 'plan' или 'auto'
 */
export function getAgentMode(): AgentMode {
  return agentMode;
}

/**
 * Устанавливает режим работы агента
 * @param mode - Новый режим ('plan' или 'auto')
 * @returns Установленный режим
 */
export function setAgentMode(mode: AgentMode): AgentMode {
  agentMode = mode;
  return agentMode;
}

/**
 * Возвращает текущее ожидающее подтверждения действие
 * @returns Объект PendingApproval или null, если нет ожидающих действий
 */
export function getPendingApproval(): PendingApproval | null {
  return pendingApproval;
}

/**
 * Создает новое ожидающее подтверждения действие
 * Генерирует уникальный ID и временную метку
 * 
 * @param approval - Входные данные для действия (без id и createdAt)
 * @returns Созданный объект PendingApproval с id и временной меткой
 */
export function setPendingApproval(approval: PendingApprovalInput): PendingApproval {
  pendingApproval = {
    ...approval,
    id: `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString()
  } as PendingApproval;

  return pendingApproval;
}

/**
 * Очищает текущее ожидающее подтверждения действие
 * Используется после подтверждения или отмены действия
 */
export function clearPendingApproval(): void {
  pendingApproval = null;
}

/**
 * Добавляет снимок состояния файла в стек отмены
 * Ограничивает размер стека до 30 элементов
 * 
 * @param snapshot - Снимок состояния файла перед изменением
 */
export function pushUndoSnapshot(snapshot: UndoSnapshot): void {
  undoStack.push(snapshot);

  // Ограничиваем размер стека, удаляя самые старые элементы
  if (undoStack.length > 30) {
    undoStack.shift();
  }
}

/**
 * Извлекает последний снимок из стека отмены
 * @returns Последний UndoSnapshot или undefined, если стек пуст
 */
export function popUndoSnapshot(): UndoSnapshot | undefined {
  return undoStack.pop();
}

/**
 * Проверяет, есть ли доступные снимки для отмены
 * @returns true, если в стеке есть хотя бы один снимок
 */
export function hasUndoSnapshot(): boolean {
  return undoStack.length > 0;
}

/**
 * Возвращает путь к файлу контекста проекта
 * Контекст хранится в .lunami/project.md
 * 
 * @returns Абсолютный путь к файлу контекста
 */
export function getProjectContextPath(): string {
  return resolve(currentCwd, '.lunami', 'project.md');
}

/**
 * Читает контекст проекта из файла
 * Контекст включается в каждый запрос к LLM
 * 
 * @returns Содержимое файла контекста или пустую строку, если файл не существует
 */
export async function readProjectContext(): Promise<string> {
  try {
    return await readFile(getProjectContextPath(), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Записывает контекст проекта в файл
 * Создает директорию .lunami, если она не существует
 * 
 * @param content - Текст контекста для сохранения
 * @returns Путь к сохраненному файлу
 */
export async function writeProjectContext(content: string): Promise<string> {
  const path = getProjectContextPath();

  // Создаем директорию .lunami, если её нет
  await mkdir(dirname(path), {recursive: true});
  
  // Записываем контент с переводом строки в конце
  await writeFile(path, `${content.trim()}\n`, 'utf8');

  return path;
}

/**
 * Удаляет файл контекста проекта
 * Используется командой /context clear
 */
export async function clearProjectContext(): Promise<void> {
  await rm(getProjectContextPath(), {force: true});
}

/**
 * Добавляет текст к существующему контексту проекта
 * Если контекст уже существует, добавляет текст через двойной перевод строки
 * 
 * @param text - Текст для добавления к контексту
 * @returns Путь к обновленному файлу контекста
 */
export async function appendProjectContext(text: string): Promise<string> {
  const existing = (await readProjectContext()).trim();
  const combined = existing ? `${existing}\n\n${text.trim()}` : text.trim();

  return writeProjectContext(combined);
}

/**
 * Читает автоматический контекст из файла LUNAMI.md в корне проекта
 * Этот файл может быть создан пользователем для постоянного контекста
 * 
 * @returns Содержимое LUNAMI.md или пустую строку, если файл не существует
 */
export async function readAutoContext(): Promise<string> {
  try {
    return await readFile(resolve(currentCwd, 'LUNAMI.md'), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Возвращает полный контекст проекта, объединяя автоматический и ручной контекст
 * Этот контекст включается в системное сообщение для каждого запроса к LLM
 * 
 * @returns Объединенный контекст с метками источников
 * 
 * @example
 * // Если есть оба файла:
 * // [LUNAMI.md]
 * // Это React проект
 * //
 * // [Manual]
 * // Используем TypeScript strict mode
 */
export async function readProjectRules(): Promise<string> {
  const paths = [
    resolve(currentCwd, '.lunami', 'rules.md'),
    resolve(currentCwd, 'AGENTS.md')
  ];
  const parts: string[] = [];

  for (const path of paths) {
    try {
      const content = (await readFile(path, 'utf8')).trim();
      if (content) {
        const label = path.endsWith('AGENTS.md') ? 'AGENTS.md' : '.lunami/rules.md';
        parts.push(`[${label}]\n${content}`);
      }
    } catch {
      // missing file
    }
  }

  return parts.join('\n\n');
}

export async function getFullContext(): Promise<string> {
  const [auto, manual, rules] = await Promise.all([
    readAutoContext(),
    readProjectContext(),
    readProjectRules()
  ]);
  const autoTrimmed = auto.trim();
  const manualTrimmed = manual.trim();
  const rulesTrimmed = rules.trim();

  if (!autoTrimmed && !manualTrimmed && !rulesTrimmed) {
    return '';
  }

  const parts: string[] = [];

  if (rulesTrimmed) {
    parts.push(`[Project rules]\n${rulesTrimmed}`);
  }

  if (autoTrimmed) {
    parts.push(`[LUNAMI.md]\n${autoTrimmed}`);
  }

  if (manualTrimmed) {
    parts.push(`[Manual]\n${manualTrimmed}`);
  }

  return parts.join('\n\n');
}

/**
 * Оценивает количество токенов в тексте
 * Использует простую эвристику: ~4 символа = 1 токен
 * 
 * @param text - Текст для оценки
 * @returns Приблизительное количество токенов
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Проверяет, есть ли активный контекст проекта
 * @returns true, если есть хотя бы один непустой контекст
 */
export async function hasActiveContext(): Promise<boolean> {
  const full = await getFullContext();
  return full.trim().length > 0;
}

/**
 * Разрешает целевой путь относительно текущей директории или домашней папки
 * Обрабатывает специальные пути: '~' для домашней директории
 * 
 * @param target - Целевой путь (может быть относительным, абсолютным или начинаться с ~)
 * @returns Абсолютный разрешенный путь
 * 
 * @example
 * resolveTarget('~') // вернет '/home/user'
 * resolveTarget('~/projects') // вернет '/home/user/projects'
 * resolveTarget('./src') // вернет '/current/dir/src'
 */
function resolveTarget(target: string): string {
  // Если путь - это просто '~', возвращаем домашнюю директорию
  if (target === '~') {
    return homedir();
  }

  // Если путь начинается с '~/', заменяем на домашнюю директорию
  if (target.startsWith('~/') || target.startsWith('~\\')) {
    return resolve(homedir(), target.slice(2));
  }

  // Фикс для Windows: 'D:' -> 'D:\\'
  if (process.platform === 'win32' && /^[a-zA-Z]:$/.test(target)) {
    return resolve(currentCwd, target + '\\');
  }

  // Иначе разрешаем относительно текущей директории
  return resolve(currentCwd, target);
}
