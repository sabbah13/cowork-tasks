---
description: Opens the Cowork Tasks live artifact (kanban board) inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

When invoked, create a **live artifact** named "Cowork Tasks Board" using the
HTML at `${CLAUDE_PLUGIN_ROOT}/artifact/cowork-tasks.html`. The artifact is a
single inlined HTML file - read it as-is and pass it to the
`create_live_artifact` tool.

## Behavior

1. Read the file at `${CLAUDE_PLUGIN_ROOT}/artifact/cowork-tasks.html`.
2. Create a live artifact named `Cowork Tasks Board` with that HTML.
3. Tell the user the board is now open in the Live Artifacts tab.

The artifact connects automatically to the `cowork-tasks` MCP server via the
`window.claude.callTool` bridge - no extra wiring needed.

## Notes

- If the user already has the board open, just tell them to switch to the Live
  Artifacts tab.
- If a connector hasn't been configured, also offer `/cowork-tasks:setup`.
