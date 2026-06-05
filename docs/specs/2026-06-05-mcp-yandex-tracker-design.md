# mcp-yandex-tracker — Design

Date: 2026-06-05
Status: approved for planning

## Purpose

A public, project-neutral MCP server that lets anyone drive Yandex Tracker from
Claude (or any MCP client): read issues, create them, comment, move statuses,
search. It is intentionally lightweight and adds an opinionated, configurable
workflow layer (key-from-branch, comment templates, transition aliases) that
thin API mirrors lack.

The server is built clean-room from the official Yandex Tracker REST API v2
documentation. It does not copy code from any existing project. There is no
hardcoded reference to any private project.

## Non-goals (v1)

- No hosting / shared multi-user server (HTTP transport is scaffolded but not implemented).
- No Redis / external infrastructure.
- No worklogs, attachments, checklists, queue management, IAM/service-account auth (possible v2).
- No built-in OAuth flow. Users supply their own token.

## Stack

- TypeScript, Node 18+.
- `@modelcontextprotocol/sdk` for the MCP server.
- `zod` for tool input validation and config schema.
- Native `fetch` for HTTP. No heavy HTTP client.
- Run via `npx mcp-yandex-tracker` (zero install).
- Tests: Vitest. Tracker client mocked; the real API is never called in CI.

## Architecture

Transport-agnostic core. Tools never touch the transport layer, so HTTP can be
added later without changing tool code.

```
src/
  index.ts            # entrypoint: load env + config, pick transport, start
  server.ts           # build MCP server, register all tools (transport-agnostic)
  transport/
    stdio.ts          # v1 transport
    http.ts           # scaffold only, throws "not implemented" in v1
  tracker/
    client.ts         # thin HTTPS client for Tracker API v2 (fetch)
    types.ts          # response types
    fields.ts         # field selection / projection helpers
  tools/              # one file per tool
    getIssue.ts  getIssueUrl.ts  searchIssues.ts  createIssue.ts
    addComment.ts  listComments.ts
    listTransitions.ts  moveStatus.ts  myIssues.ts
  config/
    schema.ts         # zod schema for .tracker-mcp.json
    load.ts           # find config from cwd upward, apply defaults
  guards.ts           # read-only mode + queue allowlist enforcement
```

## Authentication & secrets

- Read from environment only, at startup:
  - `TRACKER_TOKEN` — Yandex OAuth token (required).
  - `TRACKER_ORG_ID` — org id; sent as `X-Org-ID` (Yandex 360).
  - `TRACKER_CLOUD_ORG=1` — switch the org header to `X-Cloud-Org-ID` (Yandex Cloud).
- The token is never logged and never included in any tool output.
- The repo contains no tokens. `.env.example` holds empty placeholders; `.gitignore` excludes `.env`.
- README documents step-by-step how to obtain an OAuth token in Yandex.

## Safety guards (from env)

- `TRACKER_READ_ONLY=true` — write tools (`create_issue`, `add_comment`,
  `move_status`) are not registered. Read tools only.
- `TRACKER_LIMIT_QUEUES=ABC,DEF` — comma-separated allowlist. Any operation on
  an issue/queue outside the list is refused with a clear message.

Both guards are enforced in `guards.ts`, checked before any API call.

## Config file (user's repo)

`.tracker-mcp.json`, searched from cwd upward. All fields optional; absent file
means bare API behavior. Schema (zod):

```json
{
  "defaultQueue": "PROJ",
  "branchKeyPattern": "([A-Z]+-\\d+)",
  "commentTemplate": "{{text}}",
  "transitionAliases": {
    "review": "review|ревь",
    "done": "done|закр|готов|fixed"
  },
  "defaultFields": ["key", "summary", "status", "assignee"]
}
```

- `branchKeyPattern` — used by tools to resolve the current issue key from the
  active git branch when the caller does not pass an explicit key.
- `transitionAliases` — map a short alias to a regex matched against transition
  name/target, so `move_status` accepts `"review"` instead of a numeric id.
- `defaultFields` — default projection for read tools (see Selective fields).
- `examples/` ships ready-made config samples. The original private-project
  rules become one example, never a hardcoded default.

## Selective fields (context economy — highlighted feature)

Tracker issue payloads are large. Returning them whole wastes the model's
context window. So:

- Read tools (`get_issue`, `search_issues`, `my_issues`) accept an optional
  `fields: string[]` argument.
- Resolution order for the projection:
  1. explicit `fields` argument on the call,
  2. `defaultFields` from `.tracker-mcp.json`,
  3. built-in compact default: `["key","summary","status","assignee"]`
     (plus `description` for single-issue `get_issue`).
- `fields` supports dotted paths (e.g. `status.display`, `assignee.display`).
  `fields.ts` walks the raw JSON and emits a flat projected object.
- Escape hatch: `fields: ["*"]` returns the full raw payload.
- `search_issues` always projects each result row, so large result sets stay
  cheap regardless of issue size.

This keeps responses small by default while letting a caller pull more when needed.

## Tools (v1)

| Tool | Method | Notes |
|---|---|---|
| `get_issue` | GET /issues/{key} | projected; `key` optional if branch pattern resolves it |
| `get_issue_url` | — | builds the web URL for a key, no API call |
| `search_issues` | POST /issues/_search | accepts Yandex Query Language string or filter object; projected rows |
| `create_issue` | POST /issues | requires queue (arg or `defaultQueue`); write-guarded |
| `add_comment` | POST /issues/{key}/comments | applies `commentTemplate`; write-guarded |
| `list_comments` | GET /issues/{key}/comments | author + time + text |
| `list_transitions` | GET /issues/{key}/transitions | id, name, target |
| `move_status` | POST /issues/{key}/transitions/{id}/_execute | accepts alias/regex via `transitionAliases`; write-guarded |
| `my_issues` | POST /issues/_search | assignee = me, open; projected |

Every tool: zod input schema; Tracker API errors are caught and returned as text
(status code + message), never thrown as crashes.

## Error handling

- Network/API errors → tool returns `isError` text result with HTTP status and
  Tracker message body. No stack traces, no token echo.
- Missing required config (no token) → fail fast at startup with a clear message
  pointing at the README.
- Guard violations (read-only, queue not allowed) → explicit refusal text.

## Testing (TDD)

- Unit: config loader (search-up + defaults + schema validation), field
  projection (dotted paths, `*`, defaults order), transition alias matching,
  guard logic (read-only, queue allowlist).
- Tracker client mocked via undici mock / nock. CI never hits the real API.
- Each tool gets a test before implementation.

## Distribution & docs

- Published to npm as `mcp-yandex-tracker` (name claims no official status).
- README: what it is; **disclaimer "unofficial, not affiliated with Yandex"**;
  install; ready-to-paste MCP client config blocks for Claude Desktop, Claude
  Code, Cursor, VS Code, Windsurf, Zed; how to get an OAuth token; tool
  reference; `.tracker-mcp.json` example; env/guard reference.
- `examples/` with sample configs.

## Legal

- `LICENSE`: MIT, copyright in author's name.
- Built clean-room from official Tracker API docs; no third-party code copied,
  so no foreign license terms attach.
- No NDA; authored entirely by the author → ownership clean.
- README trademark disclaimer for "Yandex Tracker".

## Open items (decide before publish, not blocking implementation)

- Final npm package name.
- npm scope (scoped vs unscoped) and GitHub repo URL.
```
