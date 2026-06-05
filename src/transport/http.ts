import { Server } from "@modelcontextprotocol/sdk/server/index.js"

export async function startHttp(_server: Server): Promise<void> {
  throw new Error("HTTP transport not implemented in v1")
}
