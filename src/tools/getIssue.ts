import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const BUILTIN = ["key", "summary", "status.display", "assignee.display", "description"]

export const getIssue: ToolDef = {
  name: "get_issue",
  description: "Get a Yandex Tracker issue by key. Returns a compact projection; pass fields:['*'] for the full payload.",
  inputSchema: z.object({
    key: z.string().describe("Issue key, e.g. ABC-1"),
    fields: z.array(z.string()).optional().describe("Field paths to return; defaults to a compact set")
  }),
  write: false,
  handler: async (args, ctx) => {
    const raw = await ctx.client.request<RawIssue>("GET", `/issues/${args.key}`)
    const fields = resolveFields(args.fields, ctx.config.defaultFields, BUILTIN)
    return textResult(JSON.stringify(project(raw, fields)))
  }
}
