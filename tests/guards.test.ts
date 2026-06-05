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
