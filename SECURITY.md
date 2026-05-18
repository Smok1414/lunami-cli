# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately via [GitHub Security Advisories](https://github.com/Smok1414/lunami-cli/security/advisories) or the [maintainer profile](https://github.com/Smok1414).

## Secrets and API keys

- Never commit `.env` with real API keys
- If a key was exposed, **rotate it immediately** at your provider
- Local models (Ollama) reduce cloud key risk but do not remove tool execution risk

## Agent modes

| Mode | Risk |
|------|------|
| **PLAN** | Low — no file edits or shell commands |
| **AUTO** | Medium — writes and dangerous commands need approval |
| **YOLO** | High — files and commands run **without confirmation** |

Use **YOLO** only in projects you trust. A 14-year-old built this with AI — treat powerful modes like power tools: useful, but respect them.

## Local models

Running models via Ollama keeps prompts on your machine, but LUNAMI can still read/write files and run shell commands when tools are enabled. Review what the agent does, especially in YOLO mode.
