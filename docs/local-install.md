# Run the plugin locally

Two ways to try your working copy: **Claude Code** (fastest loop) and the **Claude desktop app** (what users see). The plugin is `packages/plugin`; its bundled MCP server and artifact are build outputs committed next to it (`bundle/mcp-server.js`, `artifact/cowork-tasks.html`), so rebuild after changing source.

```bash
pnpm install
pnpm build          # rebuilds bundle/mcp-server.js and artifact/cowork-tasks.html
```

## Fast loop: Claude Code

```bash
claude plugin validate ./packages/plugin   # manifest, skills, agents, .mcp.json
claude plugin validate .                   # the marketplace file
claude --plugin-dir ./packages/plugin      # start a session with the working copy loaded
```

Skills appear as `/cowork-tasks:setup`, `/cowork-tasks:open-board`, and so on. `/mcp` shows whether the bundled server connected. After editing a skill or the agent, run `/reload-plugins`. After changing server source, run `pnpm build` and start a new session, because the MCP child process is cached for a session.

## Claude desktop app

```bash
pnpm pack-local
```

This produces `dist/cowork-tasks-local.zip` (the plugin folder wrapped in a single `cowork-tasks/` directory). Anthropic's upload accepts a `.zip` or `.plugin`; the archive may hold the folder or its contents as long as there is exactly one `.claude-plugin/plugin.json`. A top-level `bin/` directory would stop the app from installing the plugin at all, so the script never copies one.

1. Open the Claude desktop app.
2. Open **Customize** in the sidebar, then **Plugins**.
3. Choose **Add > Upload plugin** and select `dist/cowork-tasks-local.zip`.
4. The app warns about trust: the plugin starts `node bundle/mcp-server.js` and reads and writes `~/.cowork-tasks/`. Confirm.
5. Open the plugin and select its **Connectors** tab to add and connect sources (see below).

If the upload reports a validation failure, the usual causes are a zip that has other files beside the plugin folder, or a manifest nested more than one folder deep. Run `claude plugin validate ./packages/plugin` to see the exact message.

The bundled MCP server is a local one, so it loads in Cowork sessions that run on your computer and in Claude Code. Chat on the web or mobile ignores it.

## Open the board

In a conversation, run any of:

```
/cowork-tasks:open-board     # publishes the kanban board as an artifact
/cowork-tasks:new-task <description>
/cowork-tasks:triage-now
/cowork-tasks:coach          # what to start with, what's stuck, what to drop
/cowork-tasks:setup          # points you at the plugin's Connectors tab
/cowork-tasks:health         # which connectors are wired up
```

## Iterating

| You changed | Do this |
|---|---|
| A skill or the agent | Claude Code: `/reload-plugins`. Desktop app: re-upload the zip |
| The artifact UI (`packages/artifact`) | `pnpm build`, then run `/cowork-tasks:open-board` again to republish the board with the new HTML |
| The MCP server (`packages/mcp-server`, `packages/core`) | `pnpm build`, then start a new session |

The desktop app detects local edits to an installed plugin and warns before an update would overwrite them. If it doesn't pick up your changes, remove the plugin from **Customize > Plugins** and upload the new zip.

## Test without Claude

You can sanity-check the MCP server end to end without any Claude app:

```bash
pnpm smoke
```

This spawns `cowork-tasks-mcp`, runs `list_tasks` -> `create_task` -> `move_task` -> `get_task`, and prints `{ ok: true, ... }` on success.

## Connecting sources

Cowork Tasks does **not** run its own OAuth flows or store source tokens. It reads from the connectors you have connected in Claude. The plugin declares 26 of them in `packages/plugin/.mcp.json` (Gmail, Slack, Atlassian, Linear, Notion, Fathom, Fireflies, Granola, Intercom, HubSpot, PagerDuty, ...), which are listed on the plugin's **Connectors** tab. Installing the plugin does not add or sign you in to any of them.

To exercise triage end to end during local dev:

1. Install the local plugin (above).
2. On the plugin's **Connectors** tab, add and connect at least one source (Gmail or Slack is fastest).
3. In a conversation, run `/cowork-tasks:triage-now`.

Authentication, polling, rate limiting, and cursor management all live in the hosted connectors. Nothing you have to wire up locally.

## Where things live on disk

```
~/.cowork-tasks/
├─ tasks/                  # one *.task.json per task
├─ archived/               # soft-deleted tasks (restore_task brings them back)
├─ config.json             # columns, labels, owners, triage cadence
├─ processed.db            # SQLite, (connector, sourceHash) -> taskId dedup
├─ feedback.db             # SQLite, dismissed-task examples
├─ index.json              # coalesced snapshot for fast cold-start
├─ wal.log                 # write-ahead log for version recovery
└─ logs/cowork-tasks.log
```

Set `TASKS_DIR` to keep the `*.task.json` files somewhere else (for example inside a git repo). Anything in `~/.cowork-tasks/` can be safely deleted to reset state - the next plugin start rebuilds. Notably absent: no `credentials/`, no `cursors/`, no `triage-queue/` - those concerns live upstream in the hosted connectors.
