import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import { ToolContext, ToolDef, textResult } from "./tools/types.js"
import { Guards, queueAllowed } from "./guards.js"
import { getIssue } from "./tools/getIssue.js"
import { getIssueUrl } from "./tools/getIssueUrl.js"
import { searchIssues } from "./tools/searchIssues.js"
import { myIssues } from "./tools/myIssues.js"
import { createIssue } from "./tools/createIssue.js"
import { addComment } from "./tools/addComment.js"
import { listComments } from "./tools/listComments.js"
import { listTransitions } from "./tools/listTransitions.js"
import { moveStatus } from "./tools/moveStatus.js"

const ALL: ToolDef[] = [
  getIssue, getIssueUrl, searchIssues, myIssues,
  createIssue, addComment, listComments, listTransitions, moveStatus
]

export function selectTools(guards: Guards): ToolDef[] {
  return guards.readOnly ? ALL.filter(t => !t.write) : ALL
}

export function buildServer(ctx: ToolContext): Server {
  const tools = selectTools(ctx.guards)
  const byName = new Map(tools.map(t => [t.name, t]))
  const server = new Server({ name: "yandex-tracker-mcp", version: "0.1.0" }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: "openApi3" }) as object
    }))
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name)
    if (!tool) return textResult(`Unknown tool: ${req.params.name}`, true) as any
    const args = tool.inputSchema.parse(req.params.arguments ?? {})
    if (typeof args.key === "string" && !queueAllowed(ctx.guards, args.key)) {
      return textResult(`Queue not allowed for ${args.key}`, true) as any
    }
    try {
      return await tool.handler(args, ctx) as any
    } catch (e) {
      return textResult((e as Error).message, true) as any
    }
  })

  return server
}
