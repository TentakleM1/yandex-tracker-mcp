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
