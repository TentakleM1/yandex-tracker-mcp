import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawTransition } from "../tracker/types.js"

export const listTransitions: ToolDef = {
  name: "list_transitions",
  description: "List available status transitions for an issue.",
  inputSchema: z.object({ key: z.string() }),
  write: false,
  handler: async (args, ctx) => {
    const ts = await ctx.client.request<RawTransition[]>("GET", `/issues/${args.key}/transitions`)
    const text = ts.map(t => `${t.id}\t${t.display}\t-> ${t.to?.display ?? "?"}`).join("\n")
    return textResult(text || "(no transitions)")
  }
}
