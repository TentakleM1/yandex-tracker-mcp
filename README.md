# yandex-tracker-mcp

Unofficial MCP server for Yandex Tracker, built for Claude.

> **Disclaimer:** This project is not affiliated with, endorsed by, or sponsored by Anthropic or Yandex.
> "Yandex Tracker" is a trademark of Yandex LLC. "Claude" is a trademark of Anthropic, PBC.
> You use this server with your own Yandex Tracker account and OAuth token.

## Features

- Read issues, search by query, list your open issues, fetch comments and available transitions
- Create issues, post comments, and move issues through workflow statuses
- Configurable transition aliases so you can say "done" instead of a full status name
- Read-only mode (`TRACKER_READ_ONLY`) and queue allowlist (`TRACKER_LIMIT_QUEUES`) for access control
- Field projection keeps Claude's context small: only request the fields you need

## Tools

| Tool | Description | Write? |
|---|---|---|
| `get_issue` | Get one issue by key; pass `fields:["*"]` for the full payload | |
| `get_issue_url` | Build the web URL for an issue key (no API call) | |
| `search_issues` | Search using a Yandex Tracker Query Language string; returns compact rows | |
| `my_issues` | List my open issues (assignee = me, unresolved) | |
| `create_issue` | Create an issue; uses `defaultQueue` from config if `queue` is omitted | yes |
| `add_comment` | Add a comment; applies `commentTemplate` from config if set | yes |
| `list_comments` | List comments on an issue | |
| `list_transitions` | List available status transitions for an issue | |
| `move_status` | Move an issue to another status; `to` may be a transition id, status name, or config alias | yes |

## Install

No installation required. Run directly with:

```
npx -y yandex-tracker-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json` (usually `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": { "TRACKER_TOKEN": "your-token", "TRACKER_ORG_ID": "your-org-id" }
    }
  }
}
```

## Other MCP clients

The same `command` / `args` / `env` block works across MCP-compatible clients. Add it to the relevant config file:

- **Claude Code** — `~/.claude/claude_desktop_config.json` (or per-project `.claude/mcp.json`)
- **Cursor** — `.cursor/mcp.json` in your project root
- **VS Code** — `.vscode/mcp.json` in your project root
- **Windsurf** — `~/.codeium/windsurf/mcp_config.json`
- **Zed** — `~/.config/zed/settings.json` under the `"context_servers"` key

## Getting an OAuth token

1. Create a Yandex OAuth application or use the Tracker API directly:
   - Yandex 360 (tracker.yandex.ru): follow the auth guide at https://yandex.ru/dev/tracker/
   - Yandex Cloud (tracker.yandex.cloud): see https://yandex.cloud/docs/tracker/concepts/access
2. Request scopes that include Tracker read/write access.
3. Copy the resulting OAuth token into `TRACKER_TOKEN`.

**Finding your org id:**

- **Yandex 360** — your numeric organization id is shown in the Tracker settings or the Yandex 360 admin console. Set `TRACKER_ORG_ID` to that value. Leave `TRACKER_CLOUD_ORG` unset.
- **Yandex Cloud** — find the organization id in the Yandex Cloud console. Set `TRACKER_ORG_ID` to that value and set `TRACKER_CLOUD_ORG=1`. The server will switch to `X-Cloud-Org-ID` header and tracker.yandex.cloud URLs automatically.

Never commit your token to version control.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TRACKER_TOKEN` | yes | Yandex OAuth token with Tracker scope |
| `TRACKER_ORG_ID` | yes | Organization id (Yandex 360 or Yandex Cloud) |
| `TRACKER_CLOUD_ORG` | no | Set to `1` to use Yandex Cloud Organization (switches header and base URL) |
| `TRACKER_READ_ONLY` | no | Set to `true` to disable all write tools (create_issue, add_comment, move_status) |
| `TRACKER_LIMIT_QUEUES` | no | Comma-separated queue key allowlist, e.g. `ABC,DEF`; operations on other queues are refused |

## Project config (`.tracker-mcp.json`)

An optional per-project config file. The server searches for it by walking up from the current working directory. All keys are optional.

| Key | Type | Description |
|---|---|---|
| `defaultQueue` | string | Queue key used by `create_issue` when `queue` is not provided |
| `branchKeyPattern` | string | Regex with one capture group to extract an issue key from a branch name |
| `commentTemplate` | string | Template applied by `add_comment`; use `{{text}}` as the placeholder for the comment body |
| `transitionAliases` | object | Map of alias name to a regex string matched against transition names or target status names |
| `defaultFields` | string[] | Default field projection for read tools when no explicit `fields` argument is passed |

Example (`examples/workflow.tracker-mcp.json`):

```json
{
  "defaultQueue": "PROJ",
  "branchKeyPattern": "([A-Z]+-\\d+)",
  "commentTemplate": "{{text}}",
  "transitionAliases": {
    "progress": "in.?progress|работ",
    "review": "review|ревь",
    "done": "done|закр|готов|fixed"
  },
  "defaultFields": ["key", "summary", "status.display"]
}
```

### Field projection

Read tools accept an optional `fields: string[]` argument. Resolution order:

1. Explicit `fields` argument passed in the tool call
2. `defaultFields` from the project config
3. Built-in compact default (a small set of the most useful fields)

Dotted paths are supported, e.g. `"status.display"`, `"assignee.display"`.

Pass `fields: ["*"]` to get the full raw payload from the Yandex Tracker API. This is useful for exploring what fields are available, but will consume more context.

## Security

- Your OAuth token is read from the environment and sent only to the Yandex Tracker API. It is never logged or forwarded elsewhere.
- No tokens or credentials are stored in this repository.
- Use `TRACKER_READ_ONLY=true` to prevent any write operations.
- Use `TRACKER_LIMIT_QUEUES` to restrict the server to specific queues and reduce blast radius.

## License

MIT — see [LICENSE](LICENSE).
