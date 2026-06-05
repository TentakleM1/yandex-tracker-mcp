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

test("non-JSON error body yields a clear message", async () => {
  const pool = agent.get("https://api.tracker.yandex.net")
  pool.intercept({ path: "/v2/issues/ABC-1", method: "GET" })
    .reply(502, "<html>Bad Gateway</html>", { headers: { "content-type": "text/html" } })
  const client = new TrackerClient({ token: "t", orgId: "o", cloudOrg: false })
  await expect(client.request("GET", "/issues/ABC-1")).rejects.toThrow(/502.*non-JSON response/)
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
