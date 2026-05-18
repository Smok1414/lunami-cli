# LUNAMI CLI

[![CI](https://github.com/YOUR_USERNAME/lunami-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/lunami-cli/actions/workflows/ci.yml)

**LUNAMI** is an agentic terminal UI for AI pair programming: read and write files, search the codebase, git, project scaffolding, MCP tools, and a headless mode for scripts and CI.

> **About this project**  
> Built by a **14-year-old developer** with help from **AI** (coding assistants). The goal is simple: a coding agent that lives in your terminal — like having a teammate you can talk to while you build stuff.  
> It's early (`v0.1.0`), but it already works. Feedback and PRs are welcome.

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

## Roadmap: run a model through LUNAMI

Today you can already point LUNAMI at a **local model via [Ollama](https://ollama.com)** (see below).

What I want next:

- **`lunami models pull <name>`** — download a model in one command
- **`lunami run`** — start the agent with a bundled or local model, no cloud API key
- A simple setup wizard in the TUI: pick provider → pick model → go

If you know Ollama, LM Studio, or llama.cpp — ideas and PRs for a smooth “download & run” flow are very welcome.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/lunami-cli.git
cd lunami-cli
npm install
cp .env.example .env
# edit .env — API key and model (or use Ollama, see below)
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
