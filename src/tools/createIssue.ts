import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawIssue } from "../tracker/types.js"

export const createIssue: ToolDef = {
  name: "create_issue",
  description: "Create an issue. Uses config.defaultQueue if queue is omitted.",
  inputSchema: z.object({
    summary: z.string(),
    queue: z.string().optional(),
    description: z.string().optional()
  }),
  write: true,
  handler: async (args, ctx) => {
    const queue = args.queue ?? ctx.config.defaultQueue
    if (!queue) return textResult("No queue: pass 'queue' or set defaultQueue in .tracker-mcp.json", true)
    const body: Record<string, unknown> = { summary: args.summary, queue }
    if (args.description) body.description = args.description
    const issue = await ctx.client.request<RawIssue>("POST", "/issues", body)
    return textResult(`Created ${issue.key}: ${issue.summary}`)
  }
}
