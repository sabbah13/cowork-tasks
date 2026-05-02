---
name: Open board
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

Two MCP calls. That's it.

## Steps

1. **Get the prepared HTML** in one shot:

   ```
   cowork-tasks:prepare_board_artifact { }
   ```

   Returns `{html, tasks, version, pluginVersion}`. The HTML already has
   `window.__INITIAL_STATE__` and `window.__PLUGIN_VERSION__` injected
   before `</head>`. No need to read the template file or run a script.

2. **Optional version check** (cheap, 6h cache, free to call every open):

   ```
   cowork-tasks:check_version { }
   ```

   Returns `{current, latest, outdated, lastChecked, fromCache}`. If
   `outdated` is true, mention it to the user in your reply: "v0.X.Y is
   available - re-upload from your local cowork-tasks-local.zip".

3. **Create the artifact** with the HTML from step 1. Pass the `html`
   string inline as the artifact content. Name it "Cowork Tasks Board".
   Do not pass file paths under the plugin cache - Cowork rejects paths
   outside the session workspace.

4. **Confirm** to the user:

   > Board's open with N tasks loaded.

   If `prepare_board_artifact` returned a version mismatch in step 2, add
   "(v0.X.Y available - re-upload to update)".

## Anti-patterns

Don't:

- Call `list_artifacts` (the tool isn't related to creating one).
- Read `cowork-tasks.html` via the Read tool (it's 230 KB and the MCP server already does it server-side).
- Run bash/python to inject `__INITIAL_STATE__` (the MCP server does this in `prepare_board_artifact`).
- Call `list_tasks` and `list_config` separately for this skill (`prepare_board_artifact` covers both).

This skill should run with **2-3 tool calls total**, never 8+.
