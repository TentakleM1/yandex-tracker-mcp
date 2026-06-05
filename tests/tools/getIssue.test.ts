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
