# LUNAMI CLI

[![CI](https://github.com/Smok1414/lunami-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Smok1414/lunami-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/lunami-cli.svg)](https://www.npmjs.com/package/lunami-cli)

**LUNAMI** is an agentic terminal UI for AI pair programming: read and write files, search the codebase, git, project scaffolding, MCP tools, and a headless mode for scripts and CI.

<!--
  Demo GIF placeholder. Drop a recording at docs/demo.gif (or similar) and the
  image below will render once committed. Recommended capture: 80x24 terminal,
  10–15s clip showing `lunami init` → ask a question → tool call → answer.
-->
![LUNAMI demo](docs/demo.gif)

> **About this project**  
> Built by [**Smok1414**](https://github.com/Smok1414) — a 14-year-old developer — with help from AI. A coding agent in your terminal, like a teammate while you build.  
> Issues and PRs welcome on [GitHub](https://github.com/Smok1414/lunami-cli).

## Features

- **TUI** powered by [Ink](https://github.com/vadimdemedes/ink): chat, `/` command palette, `?` help, 4 themes
- **Agent modes** (**Tab** to cycle): `PLAN` → `AUTO` → `YOLO`
  - **PLAN** — planning only, no tools
  - **AUTO** — tools with approval for writes and dangerous commands
  - **YOLO** — tools with no confirmations (use at your own risk)
- **Activity log** — “Thinking”, “Read N files”, step durations
- **Tools**: `readFile`, `writeFile` (diff + approve), `search`, `tree`, `execCommand`, `generateProject`, git, MCP
- **Context**: `@files` / `@folders`, `.lunami/rules.md`, `AGENTS.md`, `/context`
- **Headless**: `--prompt`, stdin, `--json`, `--plan`, `--yolo`, `-y`
- **i18n**: Russian and English UI (`/lang ru` | `/lang en`)

## 30-second setup

```bash
npm install -g lunami-cli
lunami init      # interactive wizard: provider → key → model → language
lunami           # start the TUI
```

The wizard writes `~/.lunami/.env` so every workspace inherits the same config.

To use a local model with no cloud key:

```bash
lunami init                       # pick "ollama" when asked
lunami models pull llama3.2       # downloads via the Ollama backend
lunami                            # ready
```

## Roadmap

- **`lunami run`** — start the agent against a bundled local model, no setup at all
- LM Studio / llama.cpp backends for `models pull`
- Web/server mode for remote use

Ideas and PRs welcome.

## One-line install

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Smok1414/lunami-cli/main/scripts/install.ps1 | iex
```

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/Smok1414/lunami-cli/main/scripts/install.sh | bash
```

This will:

1. Check Node.js 20+
2. Run `npm install -g` from your GitHub repo (builds the `lunami` command)
3. Create `~/.lunami/.env` from `.env.example` (API key or Ollama)
4. You type **`lunami`** in a new terminal — done

### Local model after install

```bash
# install Ollama from https://ollama.com
ollama pull llama3.2
```

Edit `~/.lunami/.env`:

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```

Then run `lunami` — the agent uses your downloaded model, no cloud API.

> **Coming soon:** `lunami models pull llama3.2` so you don't need Ollama separately.

## Install the `lunami` command (manual)

Type **`lunami`** in any terminal — same as `npm run dev`, but global.

**From this repo (recommended while developing):**

```bash
git clone https://github.com/Smok1414/lunami-cli.git
cd lunami-cli
npm install
cp .env.example .env
# edit .env — API key and model (or Ollama, see below)
npm run link:global
```

Then open a **new** terminal and run:

```bash
lunami
```

`npm run link:global` = `npm run build` + `npm link` (registers the `lunami` command on your PATH).

**From npm (recommended for users):**

```bash
npm install -g lunami-cli
lunami init
lunami
```

**Without global install:**

```bash
npm run build
npx lunami
```

> **Windows:** if `lunami` is not found, ensure `%AppData%\npm` is in your PATH (npm usually adds this). Restart the terminal after `npm link`.

## Quick start (without linking)

```bash
npm install
cp .env.example .env
npm run dev
```

## Run locally with Ollama (no cloud API)

1. Install [Ollama](https://ollama.com) and pull a model:

```bash
ollama pull llama3.2
```

2. In `.env`:

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```

3. Start LUNAMI:

```bash
npm run dev
```

The agent runs against your machine — same TUI, same tools.

## Usage

Interactive TUI:

```bash
npm run dev
```

Headless:

```bash
npm run dev -- --prompt "What does this code do?"
npm run dev -- --run task.md
npm run dev -- --prompt "Refactor auth layer" --plan
npm run dev -- --prompt "Fix the bug" --yolo
```

JSON output:

```bash
npm run dev -- --prompt "Write a function" --json
```

Build and test:

```bash
npm run build
npm run typecheck
npm test
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Tab** | Cycle PLAN → AUTO → YOLO |
| **Enter** | Send message / expand collapsed tool output (empty input) |
| **o** | Expand/collapse last tool output |
| **?** | Command help |
| **Ctrl+L** | Clear chat |
| **Ctrl+C** | Exit |

## Chat commands

| Command | Description |
|---------|-------------|
| `/plan` `/auto` `/yolo` | Agent mode |
| `/model` `/api` `/provider` | Model and API |
| `/cd` | Project working directory |
| `/context` | Project context |
| `/rules` | Rules from `.lunami/rules.md` and `AGENTS.md` |
| `/mcp` | MCP status; `/mcp reload` |
| `/session` | Sessions |
| `/theme` `/lang` | Theme and language |
| `/approve` `/deny` | Approve dangerous actions |
| `/tree` `/clear` `/export` `/undo` | Tree, clear, export, undo last write |

## MCP

Copy the example into your workspace:

```bash
mkdir -p .lunami
cp mcp.example.json .lunami/mcp.json
```

Global config: `~/.lunami/mcp.json`. In the TUI: `/mcp`, `/mcp reload`.

## Environment variables

See [`.env.example`](.env.example). Supports OpenAI-compatible APIs, Anthropic, and Ollama.

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | `openai` \| `anthropic` \| `ollama` |
| `LLM_MODEL` | Model name |
| `OPENAI_API_KEY` | Key for OpenAI / compatible APIs |
| `OPENAI_BASE_URL` | Optional proxy or local gateway |
| `OLLAMA_BASE_URL` | Ollama server (default `http://localhost:11434`) |
| `LUNAMI_YES=1` | In AUTO, skip **file write** approval (headless) |

Never commit `.env` — it is in `.gitignore`.

## stdin and Windows

```bash
cat task.txt | npm run dev
```

> **PowerShell + Cyrillic in pipes:** set  
> `$OutputEncoding = [System.Text.Encoding]::UTF8`  
> before `|`, or use `npm run dev -- --run task.txt`.

## Sessions and debug

- Sessions: `./.lunami/sessions/` in the project (`--session`)
- Debug log: `~/.lunami/debug.log` (`--debug`)

```bash
npm run dev -- --prompt "fix the bug" --verbose --quiet
```

## Safe modes (headless / CI)

- `--plan` / `--dry-run` — plan only, no tools
- `--yolo` — tools without confirmations
- `-y` / `LUNAMI_YES=1` — auto-approve **writes** in AUTO mode

## License

[MIT](LICENSE)
