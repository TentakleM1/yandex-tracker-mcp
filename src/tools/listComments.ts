import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawComment } from "../tracker/types.js"

export const listComments: ToolDef = {
  name: "list_comments",
  description: "List comments on an issue.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => {
    const cs = await ctx.client.request<RawComment[]>("GET", `/issues/${args.key}/comments`)
    const text = cs.map(c => `[${c.createdBy?.display ?? "?"} ${c.createdAt ?? "?"}]\n${c.text}`).join("\n\n")
    return textResult(text || "(no comments)")
  }
}
