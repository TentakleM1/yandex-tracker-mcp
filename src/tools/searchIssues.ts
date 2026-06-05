import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const ROW = ["key", "summary", "status.display", "assignee.display"]

export const searchIssues: ToolDef = {
  name: "search_issues",
  description: "Search issues with a Yandex Tracker Query Language string. Returns compact projected rows.",
  inputSchema: z.object({
    query: z.string().describe("Query Language string, e.g. 'Queue: ABC AND Status: Open'"),
    fields: z.array(z.string()).optional()
  }),
  write: false,
  handler: async (args, ctx) => {
    const rows = await ctx.client.request<RawIssue[]>("POST", "/issues/_search", { query: args.query })
    const fields = resolveFields(args.fields, ctx.config.defaultFields, ROW)
    return textResult(JSON.stringify(rows.map(r => project(r, fields))))
  }
}
