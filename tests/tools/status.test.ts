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

test("move_status returns a friendly error on an invalid pattern", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1/transitions", method: "GET" })
    .reply(200, [{ id: "close", display: "Close", to: { display: "Closed" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await moveStatus.handler({ key: "ABC-1", to: "[" }, ctx(client))
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toMatch(/invalid transition pattern/i)
})

test("move_status errors with list when nothing matches", async () => {
  agent.get("https://api.tracker.yandex.net").intercept({ path: "/v2/issues/ABC-1/transitions", method: "GET" })
    .reply(200, [{ id: "close", display: "Close", to: { display: "Closed" } }])
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  const res = await moveStatus.handler({ key: "ABC-1", to: "review" }, ctx(client))
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toContain("close")
})
