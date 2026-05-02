---
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

The board is a single inlined HTML file shipped with this plugin. Bake the
current task snapshot into the HTML at create time so the board is never
empty on first paint, even before any polling runs.

## Steps

1. Read the full contents of:
   ```
   ${CLAUDE_PLUGIN_ROOT}/artifact/cowork-tasks.html
   ```
   Use the **Read** tool. The file is ~220 KB; read it in full.

2. Fetch the current task state from the local MCP:
   ```
   cowork-tasks:list_tasks { }            -> {version, added: [...all active tasks]}
   cowork-tasks:list_config { }           -> {boards, labels, ...}
   ```

3. Inject the snapshot into the HTML so the artifact has data from the
   moment it's painted. Insert this `<script>` tag immediately before the
   closing `</head>`:

   ```html
   <script>
     window.__INITIAL_STATE__ = {
       version: <version-from-list_tasks>,
       tasks:   <added-array-from-list_tasks>,
       config:  <config-from-list_config>
     };
   </script>
   ```

   The artifact's React hook checks `window.__INITIAL_STATE__` first when
   it boots and uses that snapshot if present. Without this injection the
   artifact has no data path until polling succeeds, and Cowork live
   artifacts don't expose `window.claude.callTool` reliably yet.

4. Create a live artifact named **"Cowork Tasks Board"** with the
   modified HTML as its content. Pass the **content inline**. Do not
   pass file paths under the plugin cache - Cowork rejects paths outside
   the session workspace.

5. Confirm to the user:

   > Board's open in the Live Artifacts tab with N tasks loaded.
   > To enable live updates without going through chat, click
   > "Connect ~/.cowork-tasks" in the empty state and grant directory
   > access. Otherwise re-run /cowork-tasks:open-board to refresh.

## Notes

- The artifact's drag/drop and edits route through the File System Access
  API (after the user grants the folder), which writes back to
  `~/.cowork-tasks/tasks/*.task.json`. If the user hasn't granted folder
  access, drag/drop falls back to the MCP server (which works only when
  Cowork's chat-side MCP bridge reaches it).
- If `list_tasks` returns 0 tasks, still inject the empty state - the
  artifact will show its empty-board UI with a "Connect a source" CTA.
