import { z } from "zod"

export const configSchema = z.object({
  defaultQueue: z.string().optional(),
  branchKeyPattern: z.string().optional(),
  commentTemplate: z.string().optional(),
  transitionAliases: z.record(z.string()).optional(),
  defaultFields: z.array(z.string()).optional()
}).strict()

export type Config = z.infer<typeof configSchema>
