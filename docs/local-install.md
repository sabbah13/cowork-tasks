# Install the plugin locally for testing in Claude Cowork

Cowork accepts a zipped plugin folder as a manual upload. Until `@cowork-tasks/mcp-server` is published to npm, the `.mcp.json` shipped in the plugin needs to point at your locally-built MCP server.

`scripts/pack-local.mjs` does both - it builds, rewrites `.mcp.json` to spawn the local MCP server bin, and zips the result.

## One-time

```bash
pnpm install
pnpm pack-local
```

This produces:

```
dist/cowork-tasks-local.zip   # ~88 KB, contents wrapped in a cowork-tasks/ folder
```

Two Cowork-specific quirks the script handles for you:

- The upload dialog rejects `.plugin`-named files - extension must be `.zip` ([anthropics/claude-code#28337](https://github.com/anthropics/claude-code/issues/28337)).
- The zip must contain a single top-level folder matching the plugin id, not flat files. We stage everything under `cowork-tasks/`.

## Install in Cowork

1. Open the **Claude Desktop** app.
2. Switch to the **Cowork** tab.
3. Click **Customize** in the left sidebar - then **Plugins**.
4. Under **Personal plugins**, click **+** -> **Upload local plugin** and select `dist/cowork-tasks-local.zip`.
5. Cowork warns you about trust - the plugin spawns `node <repo>/packages/mcp-server/dist/cli.js` and reads `~/.cowork-tasks/`. Click **Upload**.
6. Tasks land in `~/.cowork-tasks/`.

If you see **Plugin validation failed** in the top-right, the most likely causes are:
- The zip was unzipped and re-zipped without preserving the `cowork-tasks/` top-level folder.
- The file was renamed `.plugin` (Cowork only accepts `.zip`).
- The MCP server CLI has been deleted / moved (re-run `pnpm pack-local`).

## Open the board

In Cowork chat, run any of:

```
/cowork-tasks:open-board     # creates the live artifact dashboard
/cowork-tasks:new-task <description>
/cowork-tasks:triage-now
/cowork-tasks:setup          # points you at Customize -> Connectors
/cowork-tasks:health         # which Cowork connectors are wired up
```

## Iterating on the plugin

After editing source:

```bash
pnpm pack-local              # rebuilds + repacks
```

In Cowork: **Customize -> Plugins -> the plugin row -> uninstall**, then re-upload the new zip. There is no in-place reload yet (Anthropic hasn't documented one).

If you only changed the **artifact HTML** (UI), close and re-open the live artifact - it re-reads on each open.

If you only changed the **MCP server**, restart Cowork (it caches the MCP child process for the session).

## Test without Cowork

You can sanity-check the MCP server end to end without Cowork at all:

```bash
pnpm smoke
```

This spawns `cowork-tasks-mcp`, runs `list_tasks` -> `create_task` -> `move_task` -> `get_task`, and prints `{ ok: true, ... }` on success.

## Connecting sources

Cowork Tasks does **not** run its own OAuth flows or store source tokens. It reads from whatever Cowork-hosted MCP connectors you've authorized in **Customize -> Connectors**. The plugin pre-declares 25+ of them in `packages/plugin/.mcp.json` (Gmail, Slack, Atlassian, Linear, Notion, Fathom, Fireflies, Granola, Intercom, HubSpot, PagerDuty, ...) so they appear in the panel ready to enable.

To exercise triage end to end during local dev:

1. Install the local zip (above).
2. Open **Customize -> Connectors** in Cowork and authorize at least one source (Gmail or Slack is fastest).
3. In Cowork chat, run `/cowork-tasks:triage-now`.

Authentication, polling, rate limiting, and cursor management all live in the Cowork-hosted MCP servers. Nothing you have to wire up locally.

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

Anything in there can be safely deleted to reset state - the next plugin start rebuilds. Notably absent: no `credentials/`, no `cursors/`, no `triage-queue/` - those concerns live upstream in Cowork's hosted connectors.
