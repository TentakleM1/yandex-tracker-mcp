import { z } from "zod"
import { ToolDef, textResult } from "./types.js"

export const getIssueUrl: ToolDef = {
  name: "get_issue_url",
  description: "Build the web URL for an issue key. No API call.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => textResult(`${ctx.webBase}/${args.key}`)
}
