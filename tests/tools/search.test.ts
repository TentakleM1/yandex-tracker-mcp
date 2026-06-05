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
