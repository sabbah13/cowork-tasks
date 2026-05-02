---
name: Open board
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

Three tool calls, in order.

## Steps

1. **Pick a writable output path** for this session. Use whatever Cowork
   exposes as the session output / workspace directory (the same place
   you'd write any other generated file). Call it `<outputs>/cowork-tasks-board.html`.

2. **Prepare the board HTML on disk** (one MCP call):

   ```
   cowork-tasks:prepare_board_artifact { "outPath": "<outputs>/cowork-tasks-board.html" }
   ```

   Returns `{path, bytes, tasks, version, pluginVersion}`. Critically,
   the response does **not** include the HTML body when `outPath` is
   provided - the file is ~600 KB and would overflow Cowork's tool-result
   budget. The HTML is written to disk; you point `create_artifact` at the
   path.

3. **Optional version check** (cheap, 6h cached, free to call every open):

   ```
   cowork-tasks:check_version { }
   ```

   Returns `{current, latest, outdated, lastChecked, fromCache}`. If
   `outdated` is true, mention it: "v0.X.Y is available - re-upload your
   local cowork-tasks-local.zip".

4. **Create the artifact from the file** using `html_path` (NOT inline
   content):

   ```
   cowork.create_artifact {
     "name": "Cowork Tasks Board",
     "html_path": "<outputs>/cowork-tasks-board.html"
   }
   ```

   Do **not** read the file's contents into your context and pass them as
   inline `html` - the file is large and inlining will overflow the
   tool-call budget on the way back too. `html_path` lets Cowork load it
   directly.

5. **Confirm** to the user:

   > Board's open with N tasks loaded.

   If step 3 reported `outdated: true`, append "(v0.X.Y available -
   re-upload to update)".

## Anti-patterns

- **Don't** call `prepare_board_artifact` without `outPath` - the
  response will include the full HTML and overflow tool budget.
- **Don't** read the prepared HTML file with the Read tool - it's large.
- **Don't** pass the HTML as inline content to `create_artifact` - use
  `html_path`.
- **Don't** call `list_artifacts`, `list_tasks`, or `list_config` for
  this skill - `prepare_board_artifact` covers everything.
- **Don't** run bash/python to inject state into the template - the MCP
  server does that in `prepare_board_artifact`.

This skill should run in **3 tool calls total** (prepare + check_version
+ create_artifact), never more.
