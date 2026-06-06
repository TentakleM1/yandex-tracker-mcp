# Архитектура / Architecture

Карта проекта: что где лежит и как устроен поток запроса. Для людей и для ИИ-агентов, работающих с репозиторием.

## Поток запроса

```
MCP-клиент (Claude Desktop / Code / Cursor ...)
   │  JSON-RPC по stdio
   ▼
src/transport/stdio.ts        транспорт
   ▼
src/server.ts                 ядро MCP
   ├─ ListTools  → отдаёт схемы инструментов (zod → JSON Schema)
   └─ CallTool   → guards → tool.handler → результат / ошибка
        │
        ▼
src/tools/<tool>.ts           логика инструмента
        │
        ▼
src/tracker/client.ts         HTTP-клиент к Yandex API
        │  fetch + OAuth + X-Org-ID / X-Cloud-Org-ID
        ▼
Yandex Tracker API (api.tracker.yandex.net/v2)
```

## Дерево модулей

```
src/
├── index.ts          ВХОД (bin). Читает env, собирает client+config+guards+webBase,
│                       вызывает buildServer(), стартует stdio-транспорт.
│
├── server.ts         ЯДРО MCP.
│                       selectTools(guards) — при readOnly убирает write-инструменты
│                       ListTools  — name + description + inputSchema (zodToJsonSchema)
│                       CallTool   — общий queue-guard по args.key → handler → ошибки в textResult
│
├── guards.ts         ДОСТУП.
│                       parseGuards(env) → { readOnly, allowedQueues }
│                       queueAllowed(guards, key) — очередь = key.split("-")[0]
│
├── config/
│   ├── load.ts       Поиск .tracker-mcp.json вверх по дереву каталогов от cwd.
│   └── schema.ts     zod-схема (strict): defaultQueue, commentTemplate,
│                       transitionAliases, defaultFields.
│
├── tracker/
│   ├── client.ts     TrackerClient.request(method, path, body). Базовый URL + заголовки.
│   │                   Парсит ошибки API (errorMessages / message / statusText).
│   ├── fields.ts     project(raw, fields) — проекция полей (точечные пути, "*" = всё)
│   │                   resolveFields(explicit, configDefault, builtIn) — приоритет полей
│   └── types.ts      RawIssue, RawTransition, RawComment ...
│
├── tools/            9 инструментов, каждый = ToolDef { name, description, inputSchema, write, handler }
│   ├── types.ts          ToolDef, ToolContext, ToolResult, textResult()
│   ├── getIssue.ts       read   get_issue
│   ├── getIssueUrl.ts    read   get_issue_url   (без запроса к API)
│   ├── searchIssues.ts   read   search_issues   (POST /issues/_search)
│   ├── myIssues.ts       read   my_issues       (query: Assignee: me() AND Resolution: empty())
│   ├── listComments.ts   read   list_comments
│   ├── listTransitions.ts read  list_transitions
│   ├── createIssue.ts    write  create_issue    (+ собственная queue-проверка)
│   ├── addComment.ts     write  add_comment     (применяет commentTemplate)
│   └── moveStatus.ts     write  move_status     (id / имя статуса / алиас → regex)
│
└── transport/
    ├── stdio.ts      Рабочий транспорт (используется в index.ts).
    └── http.ts       ЗАГЛУШКА — кидает "HTTP transport not implemented in v1".
```

## Ключевые контракты

**ToolDef** ([src/tools/types.ts](../src/tools/types.ts)) — единый интерфейс инструмента:

```ts
interface ToolDef {
  name: string
  description: string          // читает MCP-клиент (ИИ) по протоколу — держать сжато, по-английски
  inputSchema: z.ZodTypeAny    // zod → JSON Schema на лету в server.ts
  write: boolean               // true → отфильтровывается при TRACKER_READ_ONLY
  handler: (args, ctx: ToolContext) => Promise<ToolResult>
}
```

**ToolContext** — передаётся в каждый handler: `{ client, config, guards, webBase }`.

## Где что менять

| Задача | Файл(ы) |
|---|---|
| Добавить инструмент | новый `src/tools/<x>.ts` + регистрация в массиве `ALL` в [src/server.ts](../src/server.ts) |
| Новая env-переменная | [src/index.ts](../src/index.ts) (чтение) + README (доки) |
| Новый ключ конфига | [src/config/schema.ts](../src/config/schema.ts) + README |
| Логика доступа | [src/guards.ts](../src/guards.ts) |
| Заголовки/базовый URL API | [src/tracker/client.ts](../src/tracker/client.ts) |
| Проекция полей | [src/tracker/fields.ts](../src/tracker/fields.ts) |

## Контроль доступа (guards)

Две независимые защиты, обе из env через `parseGuards`:

1. **`readOnly`** (`TRACKER_READ_ONLY=true`) — `selectTools` в [server.ts](../src/server.ts) убирает все инструменты с `write: true`. Они не появляются в ListTools вообще.
2. **`allowedQueues`** (`TRACKER_LIMIT_QUEUES=ABC,DEF`) — `queueAllowed` проверяет очередь:
   - в [server.ts](../src/server.ts) — общий guard по `args.key` для всех инструментов с ключом задачи;
   - в [createIssue.ts](../src/tools/createIssue.ts) — отдельная проверка по `queue`, т.к. у создания нет `key`.

> ⚠️ Логика очереди размазана по двум местам. При добавлении нового write-инструмента, работающего с очередью без `key`, не забудьте про проверку `queueAllowed`.

## Тесты

`tests/` зеркалит `src/`. Запуск: `npm test` (vitest). HTTP-вызовы мокаются через `undici`.
