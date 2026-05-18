# LUNAMI CLI

[![CI](https://github.com/YOUR_USERNAME/lunami-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/lunami-cli/actions/workflows/ci.yml)

**LUNAMI** — agentic TUI для парного программирования с AI прямо в терминале: чтение и запись файлов, поиск по коду, git, scaffold проектов, MCP и headless-режим для CI.

## Возможности

- **TUI** на [Ink](https://github.com/vadimdemedes/ink): чат, палитра `/`, справка `?`, 4 темы
- **Режимы агента** (клавиша **Tab**): `PLAN` → `AUTO` → `YOLO`
  - **PLAN** — только план, без инструментов
  - **AUTO** — инструменты с подтверждением записи и опасных команд
  - **YOLO** — инструменты без подтверждений (на свой риск)
- **Лог активности** — «Думаю», «Прочитано N файлов», длительность шагов
- **Инструменты**: `readFile`, `writeFile` (diff + approve), `search`, `tree`, `execCommand`, `generateProject`, git, MCP
- **Контекст**: `@files` / `@folders`, `.lunami/rules.md`, `AGENTS.md`, `/context`
- **Headless**: `--prompt`, stdin, `--json`, `--plan`, `--yolo`, `-y`

## Быстрый старт

```bash
git clone https://github.com/YOUR_USERNAME/lunami-cli.git
cd lunami-cli
npm install
cp .env.example .env
# отредактируйте .env — API key и модель
npm run dev
```

## Запуск

Интерактивный TUI:

```bash
npm run dev
```

Headless (без интерфейса):

```bash
npm run dev -- --prompt "Что делает этот код?"
npm run dev -- --run task.md
npm run dev -- --prompt "Рефакторинг auth" --plan
npm run dev -- --prompt "Пофикси баг" --yolo
```

JSON для скриптов:

```bash
npm run dev -- --prompt "Напиши функцию" --json
```

Сборка и тесты:

```bash
npm run build
npm run typecheck
npm test
```

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| **Tab** | PLAN → AUTO → YOLO |
| **Enter** | отправить / развернуть длинный tool-вывод (пустое поле) |
| **o** | развернуть/свернуть последний tool-вывод |
| **?** | справка по командам |
| **Ctrl+L** | очистить чат |
| **Ctrl+C** | выход |

## Команды в чате

| Команда | Описание |
|---------|----------|
| `/plan` `/auto` `/yolo` | режим агента |
| `/model` `/api` `/provider` | модель и API |
| `/cd` | рабочая папка проекта |
| `/context` | контекст проекта |
| `/rules` | правила из `.lunami/rules.md` и `AGENTS.md` |
| `/mcp` | статус MCP; `/mcp reload` |
| `/session` | сессии |
| `/theme` `/lang` | тема и язык |
| `/approve` `/deny` | подтверждение опасных действий |
| `/tree` `/clear` `/export` `/undo` | дерево, очистка, экспорт, откат записи |

## MCP

Скопируйте пример в workspace:

```bash
mkdir -p .lunami
cp mcp.example.json .lunami/mcp.json
```

Глобальный конфиг: `~/.lunami/mcp.json`. В TUI: `/mcp`, `/mcp reload`.

## Переменные окружения

См. [`.env.example`](.env.example). Поддерживаются OpenAI-совместимые API, Anthropic, Ollama.

| Переменная | Назначение |
|------------|------------|
| `LLM_PROVIDER` | `openai` \| `anthropic` \| `ollama` |
| `LLM_MODEL` | имя модели |
| `OPENAI_API_KEY` | ключ (OpenAI / совместимые) |
| `OPENAI_BASE_URL` | опционально, для прокси |
| `LUNAMI_YES=1` | в AUTO пропускать подтверждение **записи** файлов (headless) |

**Не коммитьте `.env`** — он в `.gitignore`.

## stdin и Windows

```bash
cat task.txt | npm run dev
```

> **PowerShell и кириллица в pipe:** перед `|` выполните  
> `$OutputEncoding = [System.Text.Encoding]::UTF8`  
> или используйте `npm run dev -- --run task.txt`.

## Сессии и отладка

- Сессии: `./.lunami/sessions/` в текущем проекте (`--session`)
- Debug-лог: `~/.lunami/debug.log` (`--debug`)

```bash
npm run dev -- --prompt "пофикси баг" --verbose --quiet
```

## Safe modes (headless / CI)

- `--plan` / `--dry-run` — только план, без инструментов
- `--yolo` — инструменты без подтверждений
- `-y` / `LUNAMI_YES=1` — auto-approve **записи** в режиме AUTO

## Лицензия

[MIT](LICENSE)
