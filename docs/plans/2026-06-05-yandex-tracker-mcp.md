# yandex-tracker-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, project-neutral MCP server (TypeScript) that drives Yandex Tracker from any MCP client — read, search, create issues, comment, move status — with a configurable workflow layer and a context-saving field projection.

**Architecture:** Transport-agnostic core. A thin `TrackerClient` wraps the Tracker REST API v2 over `fetch`. Pure helpers (field projection, config loader, guards) are unit-tested in isolation. Each tool is a small module registered on an MCP server; only stdio transport ships in v1.

**Tech Stack:** TypeScript, Node 18+, `@modelcontextprotocol/sdk`, `zod`, native `fetch`, Vitest with `undici` `MockAgent` for HTTP mocking.

---

## File Structure

```
package.json            # deps, scripts, bin entry
tsconfig.json           # strict TS, NodeNext
vitest.config.ts        # node env
src/
  index.ts              # entrypoint: load env+config, start stdio transport
  server.ts             # buildServer(deps) -> registers tools per guards
  transport/stdio.ts    # connect server over stdio
  transport/http.ts     # scaffold, throws "not implemented"
  tracker/client.ts     # TrackerClient: request + typed helpers
  tracker/types.ts      # Issue/Comment/Transition response types
  tracker/fields.ts     # project(raw, fields) projection helper
  config/schema.ts      # zod schema + Config type
  config/load.ts        # find .tracker-mcp.json upward, apply defaults
  guards.ts             # Guards: readOnly + queue allowlist
  tools/getIssue.ts
  tools/getIssueUrl.ts
  tools/searchIssues.ts
  tools/myIssues.ts
  tools/createIssue.ts
  tools/addComment.ts
  tools/listComments.ts
  tools/listTransitions.ts
  tools/moveStatus.ts
tests/                  # mirrors src/, one *.test.ts per unit
examples/               # sample .tracker-mcp.json files
README.md  LICENSE  .env.example  .gitignore
```

**Shared contracts (defined in Task 2/3/4, used by all tools):**

```ts
// tracker/client.ts
export interface TrackerClientOptions { token: string; orgId: string; cloudOrg: boolean; baseUrl?: string }
export class TrackerClient {
  constructor(opts: TrackerClientOptions)
  request<T>(method: string, path: string, body?: unknown): Promise<T>
}

// config/schema.ts
export interface Config {
  defaultQueue?: string
  branchKeyPattern?: string
  commentTemplate?: string
  transitionAliases?: Record<string, string>
  defaultFields?: string[]
}

// guards.ts
export interface Guards { readOnly: boolean; allowedQueues: string[] | null }
export function queueAllowed(guards: Guards, key: string): boolean
```

---

## Task 0: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `src/index.ts` (stub)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "yandex-tracker-mcp",
  "version": "0.1.0",
  "description": "Unofficial MCP server for Yandex Tracker, built for Claude. Not affiliated with Anthropic or Yandex.",
  "license": "MIT",
  "type": "module",
  "bin": { "yandex-tracker-mcp": "dist/index.js" },
  "files": ["dist", "examples", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0",
    "undici": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
})
```

- [ ] **Step 4: Create `.env.example`**

```
TRACKER_TOKEN=
TRACKER_ORG_ID=
TRACKER_CLOUD_ORG=0
TRACKER_READ_ONLY=
TRACKER_LIMIT_QUEUES=
```

- [ ] **Step 5: Create `src/index.ts` stub**

```ts
async function main() {
  // wired up in Task 11
}
main()
```

- [ ] **Step 6: Install and verify**

Run: `cd /Users/fusion/Downloads/yandex-tracker-mcp && npm install && npx tsc --noEmit`
Expected: install succeeds, type-check passes with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold typescript mcp project"
```

---

## Task 1: Tracker client

**Files:**
- Create: `src/tracker/types.ts`, `src/tracker/client.ts`, `tests/tracker/client.test.ts`

- [ ] **Step 1: Create `src/tracker/types.ts`**

```ts
export interface TrackerError { statusCode: number; errorMessages?: string[]; errors?: Record<string, string> }
export interface RawIssue { key: string; summary: string; [k: string]: unknown }
export interface RawComment { id: number; text: string; createdBy?: { display?: string }; createdAt?: string }
export interface RawTransition { id: string; display: string; to?: { display?: string } }
```

- [ ] **Step 2: Write the failing test `tests/tracker/client.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { MockAgent, setGlobalDispatcher } from "undici"
import { TrackerClient } from "../../src/tracker/client.js"

let agent: MockAgent

beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})
afterEach(() => agent.close())

test("request sends auth + org headers and returns json", async () => {
  const pool = agent.get("https://api.tracker.yandex.net")
  pool.intercept({ path: "/v2/issues/ABC-1", method: "GET" })
    .reply(200, { key: "ABC-1", summary: "hi" }, { headers: { "content-type": "application/json" } })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await client.request<{ key: string }>("GET", "/issues/ABC-1")
  expect(res.key).toBe("ABC-1")
})

test("non-2xx throws Error with status and tracker message", async () => {
  const pool = agent.get("https://api.tracker.yandex.net")
  pool.intercept({ path: "/v2/issues/NOPE-1", method: "GET" })
    .reply(404, { statusCode: 404, errorMessages: ["Issue not found"] }, { headers: { "content-type": "application/json" } })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  await expect(client.request("GET", "/issues/NOPE-1")).rejects.toThrow(/404.*Issue not found/)
})

test("cloudOrg switches org header name", async () => {
  const pool = agent.get("https://api.tracker.yandex.net")
  pool.intercept({
    path: "/v2/issues/ABC-1", method: "GET",
    headers: { "x-cloud-org-id": "o" }
  }).reply(200, { key: "ABC-1", summary: "hi" })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: true })
  const res = await client.request<{ key: string }>("GET", "/issues/ABC-1")
  expect(res.key).toBe("ABC-1")
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/tracker/client.test.ts`
Expected: FAIL — cannot find module `client.js` / `TrackerClient` undefined.

- [ ] **Step 4: Implement `src/tracker/client.ts`**

```ts
export interface TrackerClientOptions {
  token: string
  orgId: string
  cloudOrg: boolean
  baseUrl?: string
}

export class TrackerClient {
  private base: string
  private headers: Record<string, string>

  constructor(opts: TrackerClientOptions) {
    this.base = (opts.baseUrl ?? "https://api.tracker.yandex.net") + "/v2"
    const orgHeader = opts.cloudOrg ? "X-Cloud-Org-ID" : "X-Org-ID"
    this.headers = {
      Authorization: `OAuth ${opts.token}`,
      [orgHeader]: opts.orgId,
      "Content-Type": "application/json"
    }
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) {
      const msg = data?.errorMessages?.join("; ") ?? data?.message ?? res.statusText
      throw new Error(`Tracker API ${res.status}: ${msg}`)
    }
    return data as T
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/tracker/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: tracker api client with auth and error mapping"
```

---

## Task 2: Field projection

**Files:**
- Create: `src/tracker/fields.ts`, `tests/tracker/fields.test.ts`

- [ ] **Step 1: Write the failing test `tests/tracker/fields.test.ts`**

```ts
import { expect, test } from "vitest"
import { project } from "../../src/tracker/fields.js"

const raw = {
  key: "ABC-1",
  summary: "Fix bug",
  status: { display: "Open", key: "open" },
  assignee: { display: "Ivan" },
  description: "long text"
}

test("projects top-level fields", () => {
  expect(project(raw, ["key", "summary"])).toEqual({ key: "ABC-1", summary: "Fix bug" })
})

test("projects dotted paths", () => {
  expect(project(raw, ["key", "status.display"]))
    .toEqual({ key: "ABC-1", "status.display": "Open" })
})

test("star returns full raw object", () => {
  expect(project(raw, ["*"])).toBe(raw)
})

test("missing path yields undefined value", () => {
  expect(project(raw, ["nope"])).toEqual({ nope: undefined })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tracker/fields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tracker/fields.ts`**

```ts
function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part]
    return undefined
  }, obj)
}

export function project<T extends object>(raw: T, fields: string[]): unknown {
  if (fields.includes("*")) return raw
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = pick(raw, f)
  return out
}

export function resolveFields(
  explicit: string[] | undefined,
  configDefault: string[] | undefined,
  builtIn: string[]
): string[] {
  return explicit ?? configDefault ?? builtIn
}
```

- [ ] **Step 4: Add a test for `resolveFields` precedence**

Append to `tests/tracker/fields.test.ts`:

```ts
import { resolveFields } from "../../src/tracker/fields.js"

test("resolveFields precedence: explicit > config > builtin", () => {
  expect(resolveFields(["a"], ["b"], ["c"])).toEqual(["a"])
  expect(resolveFields(undefined, ["b"], ["c"])).toEqual(["b"])
  expect(resolveFields(undefined, undefined, ["c"])).toEqual(["c"])
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tracker/fields.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: field projection helper for context economy"
```

---

## Task 3: Config schema and loader

**Files:**
- Create: `src/config/schema.ts`, `src/config/load.ts`, `tests/config/load.test.ts`

- [ ] **Step 1: Implement `src/config/schema.ts`**

```ts
import { z } from "zod"

export const configSchema = z.object({
  defaultQueue: z.string().optional(),
  branchKeyPattern: z.string().optional(),
  commentTemplate: z.string().optional(),
  transitionAliases: z.record(z.string()).optional(),
  defaultFields: z.array(z.string()).optional()
}).strict()

export type Config = z.infer<typeof configSchema>
```

- [ ] **Step 2: Write the failing test `tests/config/load.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../../src/config/load.js"

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tmcfg-")) })
afterEach(() => rmSync(root, { recursive: true, force: true }))

test("returns empty config when no file found", () => {
  expect(loadConfig(root)).toEqual({})
})

test("loads config from cwd", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ defaultQueue: "PROJ" }))
  expect(loadConfig(root)).toEqual({ defaultQueue: "PROJ" })
})

test("finds config in a parent directory", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ defaultQueue: "UP" }))
  const child = join(root, "a", "b")
  mkdirSync(child, { recursive: true })
  expect(loadConfig(child)).toEqual({ defaultQueue: "UP" })
})

test("throws on unknown keys", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ bogus: 1 }))
  expect(() => loadConfig(root)).toThrow()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/config/load.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/config/load.ts`**

```ts
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, parse } from "node:path"
import { Config, configSchema } from "./schema.js"

const FILE = ".tracker-mcp.json"

export function loadConfig(startDir: string = process.cwd()): Config {
  let dir = startDir
  const rootPath = parse(dir).root
  while (true) {
    const candidate = join(dir, FILE)
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, "utf8"))
      return configSchema.parse(parsed)
    }
    if (dir === rootPath) return {}
    dir = dirname(dir)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/config/load.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: config schema and upward file loader"
```

---

## Task 4: Guards (read-only + queue allowlist)

**Files:**
- Create: `src/guards.ts`, `tests/guards.test.ts`

- [ ] **Step 1: Write the failing test `tests/guards.test.ts`**

```ts
import { expect, test } from "vitest"
import { parseGuards, queueAllowed } from "../src/guards.js"

test("parseGuards reads env flags", () => {
  expect(parseGuards({ TRACKER_READ_ONLY: "true", TRACKER_LIMIT_QUEUES: "ABC, DEF" }))
    .toEqual({ readOnly: true, allowedQueues: ["ABC", "DEF"] })
})

test("parseGuards defaults", () => {
  expect(parseGuards({})).toEqual({ readOnly: false, allowedQueues: null })
})

test("queueAllowed: null allowlist permits all", () => {
  expect(queueAllowed({ readOnly: false, allowedQueues: null }, "ANY-7")).toBe(true)
})

test("queueAllowed: matches queue prefix of issue key", () => {
  const g = { readOnly: false, allowedQueues: ["ABC", "DEF"] }
  expect(queueAllowed(g, "ABC-7")).toBe(true)
  expect(queueAllowed(g, "XYZ-7")).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/guards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/guards.ts`**

```ts
export interface Guards { readOnly: boolean; allowedQueues: string[] | null }

export function parseGuards(env: Record<string, string | undefined>): Guards {
  const readOnly = env.TRACKER_READ_ONLY === "true"
  const raw = env.TRACKER_LIMIT_QUEUES?.trim()
  const allowedQueues = raw
    ? raw.split(",").map(q => q.trim()).filter(Boolean)
    : null
  return { readOnly, allowedQueues }
}

export function queueAllowed(guards: Guards, key: string): boolean {
  if (!guards.allowedQueues) return true
  const queue = key.split("-")[0]
  return guards.allowedQueues.includes(queue)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/guards.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: read-only and queue-allowlist guards"
```

---

## Task 5: Tool helper contract

Establishes the shape every tool module exports, so the server can register them uniformly. No API calls here — pure structure.

**Files:**
- Create: `src/tools/types.ts`, `tests/tools/types.test.ts`

- [ ] **Step 1: Write the failing test `tests/tools/types.test.ts`**

```ts
import { expect, test } from "vitest"
import { z } from "zod"
import type { ToolDef } from "../../src/tools/types.js"
import { textResult } from "../../src/tools/types.js"

test("textResult wraps a string into MCP content", () => {
  expect(textResult("hi")).toEqual({ content: [{ type: "text", text: "hi" }] })
})

test("ToolDef shape compiles", () => {
  const def: ToolDef = {
    name: "x",
    description: "d",
    inputSchema: z.object({}),
    write: false,
    handler: async () => textResult("ok")
  }
  expect(def.name).toBe("x")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tools/types.ts`**

```ts
import { z } from "zod"
import { TrackerClient } from "../tracker/client.js"
import { Config } from "../config/schema.js"
import { Guards } from "../guards.js"

export interface ToolContext {
  client: TrackerClient
  config: Config
  guards: Guards
  webBase: string
}

export interface ToolResult {
  content: { type: "text"; text: string }[]
  isError?: boolean
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: z.ZodTypeAny
  write: boolean
  handler: (args: any, ctx: ToolContext) => Promise<ToolResult>
}

export function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError } : {}) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shared tool definition contract"
```

---

## Task 6: get_issue and get_issue_url tools

**Files:**
- Create: `src/tools/getIssue.ts`, `src/tools/getIssueUrl.ts`, `tests/tools/getIssue.test.ts`

- [ ] **Step 1: Write the failing test `tests/tools/getIssue.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { MockAgent, setGlobalDispatcher } from "undici"
import { TrackerClient } from "../../src/tracker/client.js"
import { getIssue } from "../../src/tools/getIssue.js"
import { getIssueUrl } from "../../src/tools/getIssueUrl.js"

let agent: MockAgent
beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent) })
afterEach(() => agent.close())

const ctx = (client: TrackerClient) => ({
  client, config: {}, guards: { readOnly: false, allowedQueues: null },
  webBase: "https://tracker.yandex.ru"
})

test("get_issue returns projected fields by default", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1", method: "GET" })
    .reply(200, { key: "ABC-1", summary: "Fix", status: { display: "Open" }, assignee: { display: "Ivan" }, description: "d" })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await getIssue.handler({ key: "ABC-1" }, ctx(client))
  const obj = JSON.parse(res.content[0].text)
  expect(obj).toEqual({ key: "ABC-1", summary: "Fix", "status.display": "Open", "assignee.display": "Ivan", description: "d" })
})

test("get_issue_url builds url without api call", async () => {
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await getIssueUrl.handler({ key: "ABC-1" }, ctx(client))
  expect(res.content[0].text).toBe("https://tracker.yandex.ru/ABC-1")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/getIssue.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/getIssue.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const BUILTIN = ["key", "summary", "status.display", "assignee.display", "description"]

export const getIssue: ToolDef = {
  name: "get_issue",
  description: "Get a Yandex Tracker issue by key. Returns a compact projection; pass fields:['*'] for the full payload.",
  inputSchema: z.object({
    key: z.string().describe("Issue key, e.g. ABC-1"),
    fields: z.array(z.string()).optional().describe("Field paths to return; defaults to a compact set")
  }),
  write: false,
  handler: async (args, ctx) => {
    const raw = await ctx.client.request<RawIssue>("GET", `/issues/${args.key}`)
    const fields = resolveFields(args.fields, ctx.config.defaultFields, BUILTIN)
    return textResult(JSON.stringify(project(raw, fields)))
  }
}
```

- [ ] **Step 4: Implement `src/tools/getIssueUrl.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"

export const getIssueUrl: ToolDef = {
  name: "get_issue_url",
  description: "Build the web URL for an issue key. No API call.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => textResult(`${ctx.webBase}/${args.key}`)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tools/getIssue.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: get_issue and get_issue_url tools"
```

---

## Task 7: search_issues and my_issues tools

**Files:**
- Create: `src/tools/searchIssues.ts`, `src/tools/myIssues.ts`, `tests/tools/search.test.ts`

- [ ] **Step 1: Write the failing test `tests/tools/search.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { MockAgent, setGlobalDispatcher } from "undici"
import { TrackerClient } from "../../src/tracker/client.js"
import { searchIssues } from "../../src/tools/searchIssues.js"
import { myIssues } from "../../src/tools/myIssues.js"

let agent: MockAgent
beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent) })
afterEach(() => agent.close())

const ctx = (client: TrackerClient) => ({
  client, config: {}, guards: { readOnly: false, allowedQueues: null }, webBase: "https://tracker.yandex.ru"
})

test("search_issues sends query and projects rows", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({
    path: "/v2/issues/_search", method: "POST",
    body: JSON.stringify({ query: "Queue: ABC" })
  }).reply(200, [
    { key: "ABC-1", summary: "a", status: { display: "Open" }, assignee: { display: "I" } },
    { key: "ABC-2", summary: "b", status: { display: "Closed" }, assignee: { display: "P" } }
  ])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await searchIssues.handler({ query: "Queue: ABC" }, ctx(client))
  const rows = JSON.parse(res.content[0].text)
  expect(rows).toHaveLength(2)
  expect(rows[0]).toEqual({ key: "ABC-1", summary: "a", "status.display": "Open", "assignee.display": "I" })
})

test("my_issues searches assignee me and open", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({
    path: "/v2/issues/_search", method: "POST",
    body: JSON.stringify({ query: "Assignee: me() AND Resolution: empty()" })
  }).reply(200, [{ key: "ABC-9", summary: "mine", status: { display: "Open" }, assignee: { display: "Me" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await myIssues.handler({}, ctx(client))
  const rows = JSON.parse(res.content[0].text)
  expect(rows[0].key).toBe("ABC-9")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/search.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/searchIssues.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const ROW = ["key", "summary", "status.display", "assignee.display"]

export const searchIssues: ToolDef = {
  name: "search_issues",
  description: "Search issues with a Yandex Tracker Query Language string. Returns compact projected rows.",
  inputSchema: z.object({
    query: z.string().describe("Query Language string, e.g. 'Queue: ABC AND Status: Open'"),
    fields: z.array(z.string()).optional()
  }),
  write: false,
  handler: async (args, ctx) => {
    const rows = await ctx.client.request<RawIssue[]>("POST", "/issues/_search", { query: args.query })
    const fields = resolveFields(args.fields, ctx.config.defaultFields, ROW)
    return textResult(JSON.stringify(rows.map(r => project(r, fields))))
  }
}
```

- [ ] **Step 4: Implement `src/tools/myIssues.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const ROW = ["key", "summary", "status.display", "assignee.display"]

export const myIssues: ToolDef = {
  name: "my_issues",
  description: "List my open issues (assignee = me, unresolved).",
  inputSchema: z.object({ fields: z.array(z.string()).optional() }),
  write: false,
  handler: async (args, ctx) => {
    const rows = await ctx.client.request<RawIssue[]>(
      "POST", "/issues/_search", { query: "Assignee: me() AND Resolution: empty()" })
    const fields = resolveFields(args.fields, ctx.config.defaultFields, ROW)
    return textResult(JSON.stringify(rows.map(r => project(r, fields))))
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tools/search.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: search_issues and my_issues tools"
```

---

## Task 8: create_issue and add_comment (write tools + template)

**Files:**
- Create: `src/tools/createIssue.ts`, `src/tools/addComment.ts`, `tests/tools/write.test.ts`

- [ ] **Step 1: Write the failing test `tests/tools/write.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { MockAgent, setGlobalDispatcher } from "undici"
import { TrackerClient } from "../../src/tracker/client.js"
import { createIssue } from "../../src/tools/createIssue.js"
import { addComment } from "../../src/tools/addComment.js"

let agent: MockAgent
beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent) })
afterEach(() => agent.close())

const ctx = (client: TrackerClient, extra = {}) => ({
  client, config: {}, guards: { readOnly: false, allowedQueues: null },
  webBase: "https://tracker.yandex.ru", ...extra
})

test("create_issue uses defaultQueue when queue omitted", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({
    path: "/v2/issues", method: "POST",
    body: JSON.stringify({ summary: "New", queue: "PROJ" })
  }).reply(201, { key: "PROJ-5", summary: "New" })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await createIssue.handler({ summary: "New" }, ctx(client, { config: { defaultQueue: "PROJ" } }))
  expect(res.content[0].text).toContain("PROJ-5")
})

test("create_issue rejects when no queue available", async () => {
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await createIssue.handler({ summary: "New" }, ctx(client))
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toMatch(/queue/i)
})

test("add_comment applies commentTemplate", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({
    path: "/v2/issues/ABC-1/comments", method: "POST",
    body: JSON.stringify({ text: "[bot] hello" })
  }).reply(201, { id: 99, createdAt: "2026-06-05T10:00:00Z" })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await addComment.handler(
    { key: "ABC-1", text: "hello" },
    ctx(client, { config: { commentTemplate: "[bot] {{text}}" } })
  )
  expect(res.content[0].text).toContain("99")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/write.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/createIssue.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawIssue } from "../tracker/types.js"

export const createIssue: ToolDef = {
  name: "create_issue",
  description: "Create an issue. Uses config.defaultQueue if queue is omitted.",
  inputSchema: z.object({
    summary: z.string(),
    queue: z.string().optional(),
    description: z.string().optional()
  }),
  write: true,
  handler: async (args, ctx) => {
    const queue = args.queue ?? ctx.config.defaultQueue
    if (!queue) return textResult("No queue: pass 'queue' or set defaultQueue in .tracker-mcp.json", true)
    const body: Record<string, unknown> = { summary: args.summary, queue }
    if (args.description) body.description = args.description
    const issue = await ctx.client.request<RawIssue>("POST", "/issues", body)
    return textResult(`Created ${issue.key}: ${issue.summary}`)
  }
}
```

- [ ] **Step 4: Implement `src/tools/addComment.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawComment } from "../tracker/types.js"

export const addComment: ToolDef = {
  name: "add_comment",
  description: "Add a comment to an issue. Applies config.commentTemplate if set.",
  inputSchema: z.object({ key: z.string(), text: z.string() }),
  write: true,
  handler: async (args, ctx) => {
    const tmpl = ctx.config.commentTemplate
    const text = tmpl ? tmpl.replace("{{text}}", args.text) : args.text
    const c = await ctx.client.request<RawComment>("POST", `/issues/${args.key}/comments`, { text })
    return textResult(`Comment ${c.id} added at ${c.createdAt ?? "?"}`)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/tools/write.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: create_issue and add_comment write tools"
```

---

## Task 9: list_comments, list_transitions, move_status

**Files:**
- Create: `src/tools/listComments.ts`, `src/tools/listTransitions.ts`, `src/tools/moveStatus.ts`, `tests/tools/status.test.ts`

- [ ] **Step 1: Write the failing test `tests/tools/status.test.ts`**

```ts
import { afterEach, beforeEach, expect, test } from "vitest"
import { MockAgent, setGlobalDispatcher } from "undici"
import { TrackerClient } from "../../src/tracker/client.js"
import { listComments } from "../../src/tools/listComments.js"
import { listTransitions } from "../../src/tools/listTransitions.js"
import { moveStatus } from "../../src/tools/moveStatus.js"

let agent: MockAgent
beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent) })
afterEach(() => agent.close())

const ctx = (client: TrackerClient, extra = {}) => ({
  client, config: {}, guards: { readOnly: false, allowedQueues: null },
  webBase: "https://tracker.yandex.ru", ...extra
})

test("list_comments formats author, time, text", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1/comments", method: "GET" })
    .reply(200, [{ id: 1, text: "hi", createdBy: { display: "Ivan" }, createdAt: "2026-06-05T10:00:00Z" }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await listComments.handler({ key: "ABC-1" }, ctx(client))
  expect(res.content[0].text).toContain("Ivan")
  expect(res.content[0].text).toContain("hi")
})

test("list_transitions lists id, name, target", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1/transitions", method: "GET" })
    .reply(200, [{ id: "start_progress", display: "Start", to: { display: "In Progress" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await listTransitions.handler({ key: "ABC-1" }, ctx(client))
  expect(res.content[0].text).toContain("start_progress")
  expect(res.content[0].text).toContain("In Progress")
})

test("move_status resolves alias regex to a transition then executes", async () => {
  const pool = agent.get("https://api.tracker.yandex.net")
  pool.intercept({ path: "/v2/issues/ABC-1/transitions", method: "GET" })
    .reply(200, [{ id: "to_review", display: "Send to review", to: { display: "Review" } }])
  pool.intercept({ path: "/v2/issues/ABC-1/transitions/to_review/_execute", method: "POST" })
    .reply(200, [{ to: { display: "Review" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await moveStatus.handler(
    { key: "ABC-1", to: "review" },
    ctx(client, { config: { transitionAliases: { review: "review|ревь" } } })
  )
  expect(res.content[0].text).toContain("Review")
})

test("move_status errors with list when nothing matches", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1/transitions", method: "GET" })
    .reply(200, [{ id: "close", display: "Close", to: { display: "Closed" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await moveStatus.handler({ key: "ABC-1", to: "review" }, ctx(client))
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toContain("close")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/status.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tools/listComments.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawComment } from "../tracker/types.js"

export const listComments: ToolDef = {
  name: "list_comments",
  description: "List comments on an issue.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => {
    const cs = await ctx.client.request<RawComment[]>("GET", `/issues/${args.key}/comments`)
    const text = cs.map(c => `[${c.createdBy?.display ?? "?"} ${c.createdAt ?? "?"}]\n${c.text}`).join("\n\n")
    return textResult(text || "(no comments)")
  }
}
```

- [ ] **Step 4: Implement `src/tools/listTransitions.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawTransition } from "../tracker/types.js"

export const listTransitions: ToolDef = {
  name: "list_transitions",
  description: "List available status transitions for an issue.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => {
    const ts = await ctx.client.request<RawTransition[]>("GET", `/issues/${args.key}/transitions`)
    const text = ts.map(t => `${t.id}\t${t.display}\t-> ${t.to?.display ?? "?"}`).join("\n")
    return textResult(text || "(no transitions)")
  }
}
```

- [ ] **Step 5: Implement `src/tools/moveStatus.ts`**

```ts
import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawTransition } from "../tracker/types.js"

export const moveStatus: ToolDef = {
  name: "move_status",
  description: "Move an issue to another status. 'to' may be a transition id, a status name, or a config alias.",
  inputSchema: z.object({ key: z.string(), to: z.string() }),
  write: true,
  handler: async (args, ctx) => {
    const ts = await ctx.client.request<RawTransition[]>("GET", `/issues/${args.key}/transitions`)
    const alias = ctx.config.transitionAliases?.[args.to]
    const pattern = alias ?? args.to
    const re = new RegExp(pattern, "i")
    const match = ts.find(t =>
      t.id === args.to || re.test(`${t.display} ${t.to?.display ?? ""}`))
    if (!match) {
      const list = ts.map(t => `  ${t.id} -> ${t.to?.display ?? "?"}`).join("\n")
      return textResult(`No transition matching '${args.to}'. Available:\n${list}`, true)
    }
    const result = await ctx.client.request<{ to?: { display?: string } }[]>(
      "POST", `/issues/${args.key}/transitions/${match.id}/_execute`, {})
    const now = result?.[0]?.to?.display ?? match.to?.display ?? "?"
    return textResult(`Moved ${args.key} -> ${now}`)
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/tools/status.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: list_comments, list_transitions, move_status tools"
```

---

## Task 10: Server assembly with guard-aware registration

**Files:**
- Create: `src/server.ts`, `tests/server.test.ts`

- [ ] **Step 1: Write the failing test `tests/server.test.ts`**

```ts
import { expect, test } from "vitest"
import { selectTools } from "../src/server.js"

test("selectTools includes all tools when not read-only", () => {
  const names = selectTools({ readOnly: false, allowedQueues: null }).map(t => t.name)
  expect(names).toContain("get_issue")
  expect(names).toContain("create_issue")
  expect(names).toContain("move_status")
})

test("selectTools drops write tools in read-only mode", () => {
  const names = selectTools({ readOnly: true, allowedQueues: null }).map(t => t.name)
  expect(names).toContain("get_issue")
  expect(names).not.toContain("create_issue")
  expect(names).not.toContain("add_comment")
  expect(names).not.toContain("move_status")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server.ts`**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import { ToolContext, ToolDef, textResult } from "./tools/types.js"
import { Guards, queueAllowed } from "./guards.js"
import { getIssue } from "./tools/getIssue.js"
import { getIssueUrl } from "./tools/getIssueUrl.js"
import { searchIssues } from "./tools/searchIssues.js"
import { myIssues } from "./tools/myIssues.js"
import { createIssue } from "./tools/createIssue.js"
import { addComment } from "./tools/addComment.js"
import { listComments } from "./tools/listComments.js"
import { listTransitions } from "./tools/listTransitions.js"
import { moveStatus } from "./tools/moveStatus.js"

const ALL: ToolDef[] = [
  getIssue, getIssueUrl, searchIssues, myIssues,
  createIssue, addComment, listComments, listTransitions, moveStatus
]

export function selectTools(guards: Guards): ToolDef[] {
  return guards.readOnly ? ALL.filter(t => !t.write) : ALL
}

export function buildServer(ctx: ToolContext): Server {
  const tools = selectTools(ctx.guards)
  const byName = new Map(tools.map(t => [t.name, t]))
  const server = new Server({ name: "yandex-tracker-mcp", version: "0.1.0" }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: "openApi3" }) as object
    }))
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name)
    if (!tool) return textResult(`Unknown tool: ${req.params.name}`, true)
    const args = tool.inputSchema.parse(req.params.arguments ?? {})
    if (typeof args.key === "string" && !queueAllowed(ctx.guards, args.key)) {
      return textResult(`Queue not allowed for ${args.key}`, true)
    }
    try {
      return await tool.handler(args, ctx)
    } catch (e) {
      return textResult((e as Error).message, true)
    }
  })

  return server
}
```

- [ ] **Step 4: Add dependency `zod-to-json-schema`**

Run: `npm install zod-to-json-schema@^3.23.0`
Expected: added to dependencies.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: assemble server with guard-aware tool registration"
```

---

## Task 11: Entrypoint and stdio transport

**Files:**
- Create: `src/transport/stdio.ts`, `src/transport/http.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement `src/transport/stdio.ts`**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"

export async function startStdio(server: Server): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
```

- [ ] **Step 2: Implement `src/transport/http.ts` scaffold**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js"

export async function startHttp(_server: Server): Promise<void> {
  throw new Error("HTTP transport not implemented in v1")
}
```

- [ ] **Step 3: Implement `src/index.ts`**

```ts
import { TrackerClient } from "./tracker/client.js"
import { loadConfig } from "./config/load.js"
import { parseGuards } from "./guards.js"
import { buildServer } from "./server.js"
import { startStdio } from "./transport/stdio.js"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    process.stderr.write(`Missing ${name}. See README for setup.\n`)
    process.exit(1)
  }
  return v
}

async function main() {
  const token = requireEnv("TRACKER_TOKEN")
  const orgId = requireEnv("TRACKER_ORG_ID")
  const cloudOrg = process.env.TRACKER_CLOUD_ORG === "1"
  const client = new TrackerClient({ token, orgId, cloudOrg })
  const config = loadConfig()
  const guards = parseGuards(process.env)
  const webBase = cloudOrg ? "https://tracker.yandex.cloud" : "https://tracker.yandex.ru"
  const server = buildServer({ client, config, guards, webBase })
  await startStdio(server)
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${(e as Error).message}\n`)
  process.exit(1)
})
```

- [ ] **Step 4: Build and smoke-test startup failure path**

Run: `npm run build && node dist/index.js`
Expected: prints `Missing TRACKER_TOKEN. See README for setup.` and exits 1.

- [ ] **Step 5: Smoke-test the tool listing over stdio**

Run:
```bash
TRACKER_TOKEN=x TRACKER_ORG_ID=y node dist/index.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
EOF
```
Expected: a JSON-RPC response listing 9 tools (get_issue, get_issue_url, search_issues, my_issues, create_issue, add_comment, list_comments, list_transitions, move_status).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: stdio entrypoint and http scaffold"
```

---

## Task 12: Full test run, LICENSE, README, examples

**Files:**
- Create: `LICENSE`, `README.md`, `examples/basic.tracker-mcp.json`, `examples/workflow.tracker-mcp.json`

- [ ] **Step 1: Run the whole suite**

Run: `npx vitest run`
Expected: all tests across all files PASS.

- [ ] **Step 2: Create `LICENSE` (MIT)**

Put the standard MIT license text, copyright line: `Copyright (c) 2026 Dmitry`.

- [ ] **Step 3: Create `examples/basic.tracker-mcp.json`**

```json
{
  "defaultFields": ["key", "summary", "status.display", "assignee.display"]
}
```

- [ ] **Step 4: Create `examples/workflow.tracker-mcp.json`**

```json
{
  "defaultQueue": "PROJ",
  "branchKeyPattern": "([A-Z]+-\\d+)",
  "commentTemplate": "{{text}}",
  "transitionAliases": {
    "progress": "in.?progress|работ",
    "review": "review|ревь",
    "done": "done|закр|готов|fixed"
  },
  "defaultFields": ["key", "summary", "status.display"]
}
```

- [ ] **Step 5: Create `README.md`**

Sections, in order:
1. Title + one-line tagline: "Unofficial MCP server for Yandex Tracker, built for Claude."
2. Disclaimer block: "Not affiliated with Anthropic or Yandex. 'Yandex Tracker' and 'Claude' are trademarks of their respective owners."
3. What it does + tool list (table of the 9 tools).
4. Install: `npx yandex-tracker-mcp` and a ready-to-paste Claude Desktop config block:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": { "TRACKER_TOKEN": "your-token", "TRACKER_ORG_ID": "your-org" }
    }
  }
}
```

5. Config blocks for Claude Code, Cursor, VS Code, Windsurf, Zed (same command/args, client-specific file path noted).
6. "Getting an OAuth token" — link to Yandex OAuth docs and the exact steps.
7. Env reference: `TRACKER_TOKEN`, `TRACKER_ORG_ID`, `TRACKER_CLOUD_ORG`, `TRACKER_READ_ONLY`, `TRACKER_LIMIT_QUEUES`.
8. `.tracker-mcp.json` reference with the `examples/` files.
9. License: MIT.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: license, readme, example configs"
```

---

## Task 13: Push to GitHub

- [ ] **Step 1: Verify remote**

Run: `git remote -v`
Expected: origin -> `git@github.com:TentakleM1/yandex-tracker-mcp.git`.

- [ ] **Step 2: Push**

Run: `git push -u origin main` (confirm with the user first — first public push).
Expected: branch published.

---

## Self-Review

**Spec coverage:**
- TS/Node/SDK/zod/fetch/Vitest → Task 0, 1. ✓
- Transport-agnostic core + stdio + http scaffold → Task 10, 11. ✓
- Auth env + never logged + no tokens in repo → Task 1, 11, `.env.example` Task 0, `.gitignore` already present. ✓
- Guards (read-only, limit-queues) → Task 4, registration Task 10, key check Task 10. ✓
- Config file upward search + schema → Task 3. ✓
- Selective fields (explicit > config > builtin, dotted, `*`) → Task 2, used in Tasks 6/7. ✓
- All 9 v1 tools → Tasks 6, 7, 8, 9. ✓
- Error handling returns text, no crash → client throws (Task 1), server catches (Task 10), tool-level guard messages. ✓
- Tests mock the client, CI never hits real API → MockAgent + `disableNetConnect` in every tool test. ✓
- Distribution: npm name, README multi-client, examples → Task 0 (package.json), Task 12. ✓
- Legal: MIT LICENSE, disclaimers → Task 12. ✓

**Placeholder scan:** README content in Task 12 is described section-by-section with the concrete config block included; remaining prose (token steps, env table) is standard doc text, acceptable. No TBD/TODO in code steps.

**Type consistency:** `TrackerClient.request<T>(method, path, body?)` used identically everywhere. `ToolDef` { name, description, inputSchema, write, handler }, `ToolContext` { client, config, guards, webBase }, `textResult(text, isError?)`, `project(raw, fields)`, `resolveFields(explicit, configDefault, builtIn)`, `parseGuards(env)`, `queueAllowed(guards, key)` — all consistent across tasks.
```
