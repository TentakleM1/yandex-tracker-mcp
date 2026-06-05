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
