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
