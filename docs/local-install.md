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
/cowork-tasks:setup          # connect Gmail / Slack / Fathom
/cowork-tasks:health         # see connector status
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

## Connecting sources locally

Connectors look for credentials in two places:

1. **Process env**, e.g. `GMAIL_ACCESS_TOKEN`, `SLACK_USER_TOKEN`, `FATHOM_API_KEY`.
2. `~/.cowork-tasks/credentials/<connector-id>.json`, with shape `{"GMAIL_ACCESS_TOKEN": "ya29..."}`.

The plugin's `monitors.json` doesn't auto-launch monitors during local dev; if you want to see auto-ingestion locally, run a connector by hand:

```bash
GMAIL_ACCESS_TOKEN=ya29... node packages/plugin/bin/connectors/email-gmail.js
```

It will print `READY email-gmail` and start polling. New items show up in `~/.cowork-tasks/triage-queue/email-gmail/`. Run `node packages/plugin/bin/triage-runner.js --once` to drain them into actual tasks.

## Where things live on disk

```
~/.cowork-tasks/
+-- tasks/                  # one *.task.json per task
+-- config.json
+-- cursors/                # per-connector delta cursors
+-- triage-queue/           # raw items pending LLM triage
+-- credentials/            # encrypted source tokens
+-- processed.db            # SQLite, dedup log
+-- index.json              # coalesced snapshot for fast cold-start
+-- wal.log
+-- logs/cowork-tasks.log
```

Anything in there can be safely deleted to reset state - the next plugin start rebuilds.
