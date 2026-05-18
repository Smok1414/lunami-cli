# Contributing

Thanks for checking out LUNAMI CLI.

This project was started by a **14-year-old developer** with **AI-assisted** coding. We're learning in public — constructive feedback, bug reports, and small PRs are especially appreciated.

## Development setup

```bash
npm install
cp .env.example .env
npm run link:global   # optional: `lunami` command globally
lunami              # or: npm run dev
```

Before opening a PR:

```bash
npm run typecheck
npm run build
npm test
```

## Guidelines

- TypeScript, ESM (`"type": "module"`)
- User-facing strings go through `src/i18n.ts` (English + Russian)
- Do not commit `.env`, `node_modules/`, or `.lunami/`

## Ideas we care about

- Better **local model** UX (Ollama today; `lunami models pull` / `lunami run` tomorrow)
- Safer defaults in **AUTO** vs **YOLO**
- Terminal rendering fixes on Windows
- Docs and examples for beginners

## Pull requests

1. Describe the problem or feature
2. Add tests in `src/__tests__/` when you change logic
3. Make sure CI passes

Keep PRs focused — small changes are easier to review.
