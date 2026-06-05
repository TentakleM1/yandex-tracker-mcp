import { z } from "zod"
import { ToolDef, textResult } from "./types.js"
import { RawTransition } from "../tracker/types.js"

export const moveStatus: ToolDef = {
  name: "move_status",
  description: "Move an issue to another status. 'to' may be a transition id, a status name, or a config alias.",
  inputSchema: z.object({ key: z.string(), to: z.string() }),
  write: true,
  handler: async (args, ctx) => {
    const ts = await ctx.client.request<RawTransition[]>("GET", `/issues/${args.key}/transitions`)
    const alias = ctx.config.transitionAliases?.[args.to]
    const pattern = alias ?? args.to
    const re = new RegExp(pattern, "i")
    const match = ts.find(t =>
      t.id === args.to || re.test(`${t.display} ${t.to?.display ?? ""}`))
    if (!match) {
      const list = ts.map(t => `  ${t.id} -> ${t.to?.display ?? "?"}`).join("\n")
      return textResult(`No transition matching '${args.to}'. Available:\n${list}`, true)
    }
    const result = await ctx.client.request<{ to?: { display?: string } }[]>(
      "POST", `/issues/${args.key}/transitions/${match.id}/_execute`, {})
    const now = result?.[0]?.to?.display ?? match.to?.display ?? "?"
    return textResult(`Moved ${args.key} -> ${now}`)
  }
}
