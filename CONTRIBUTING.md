# Contributing

Спасибо за интерес к LUNAMI CLI.

## Разработка

```bash
npm install
cp .env.example .env
npm run dev
```

Перед PR:

```bash
npm run typecheck
npm run build
npm test
```

## Стиль

- TypeScript, ESM (`"type": "module"`)
- Сообщения UI — через `src/i18n.ts` (ru + en)
- Не коммитьте `.env`, `node_modules/`, `.lunami/`

## Pull requests

1. Опишите проблему или фичу
2. Добавьте тесты для логики в `src/__tests__/` где уместно
3. Убедитесь, что CI проходит
