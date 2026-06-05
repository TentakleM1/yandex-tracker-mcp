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
