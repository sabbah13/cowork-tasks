# Cowork Tasks

A kanban board for Claude that fills itself in with your own action items.
It reads email, meetings, Slack, and issue trackers through the connectors you
have connected, keeps only what you personally need to do, and shows the result
as a board you can drag cards across.

## Use it

| Command | What it does |
|---|---|
| `/cowork-tasks:setup` | Start here: shows Connect buttons for the sources you are missing, pulls your first batch of action items, and opens the board |
| `/cowork-tasks:triage-now` | Pulls action items since the last triage (the first run goes back 14 days) |
| `/cowork-tasks:open-board` | Opens the kanban board as an artifact |
| `/cowork-tasks:new-task <text>` | Captures an action item from the conversation |
| `/cowork-tasks:coach` | Tells you what to start with, what is stuck, and what to drop |
| `/cowork-tasks:health` | Shows which connectors are wired up and your board counts |

Installing the plugin does not add or sign you in to any connector. Open
**Customize > Plugins > Cowork Tasks > Connectors** and add the ones you want.

## Requirements

The board's task store is a local MCP server bundled with the plugin. It loads
in Claude Code and in sessions of the Claude desktop app that run on your
computer. Chat on the web or mobile ignores it, and the `task-extractor` agent
loads in Cowork and Claude Code only.

## Data

- Tasks are plain JSON files in `~/.cowork-tasks/tasks/` on your computer.
  Set `TASKS_DIR` to keep them somewhere else, such as inside a git repo.
- Text from the items Cowork Tasks reads (email subjects and snippets, chat
  messages, meeting action items) is processed by Claude in your own session.
  The plugin has no API keys and stores no connector credentials.
- The bundled server makes one outbound request: an occasional update check
  that downloads this plugin's `plugin.json` from `raw.githubusercontent.com`
  and caches the result. Nothing else leaves your machine.

Source and issues: https://github.com/sabbah13/cowork-tasks. MIT licensed.
