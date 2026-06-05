import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { project, resolveFields } from "../tracker/fields.js"
import { RawIssue } from "../tracker/types.js"

const ROW = ["key", "summary", "status.display", "assignee.display"]

export const myIssues: ToolDef = {
  name: "my_issues",
  description: "List my open issues (assignee = me, unresolved).",
  inputSchema: z.object({ fields: z.array(z.string()).optional() }),
  write: false,
  handler: async (args, ctx) => {
    const rows = await ctx.client.request<RawIssue[]>(
      "POST", "/issues/_search", { query: "Assignee: me() AND Resolution: empty()" })
    const fields = resolveFields(args.fields, ctx.config.defaultFields, ROW)
    return textResult(JSON.stringify(rows.map(r => project(r, fields))))
  }
}
