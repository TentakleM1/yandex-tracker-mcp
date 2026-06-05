import { expect, test } from "vitest"
import { project, resolveFields } from "../../src/tracker/fields.js"

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

test("resolveFields precedence: explicit > config > builtin", () => {
  expect(resolveFields(["a"], ["b"], ["c"])).toEqual(["a"])
  expect(resolveFields(undefined, ["b"], ["c"])).toEqual(["b"])
  expect(resolveFields(undefined, undefined, ["c"])).toEqual(["c"])
})
