import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawComment } from "../tracker/types.js"

export const addComment: ToolDef = {
  name: "add_comment",
  description: "Add a comment to an issue. Applies config.commentTemplate if set.",
  inputSchema: z.object({ key: z.string(), text: z.string() }),
  write: true,
  handler: async (args, ctx) => {
    const tmpl = ctx.config.commentTemplate
    const text = tmpl ? tmpl.replace("{{text}}", args.text) : args.text
    const c = await ctx.client.request<RawComment>("POST", `/issues/${args.key}/comments`, { text })
    return textResult(`Comment ${c.id} added at ${c.createdAt ?? "?"}`)
  }
}
