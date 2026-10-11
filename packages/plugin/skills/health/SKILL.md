---
name: health
description: Reports Cowork Tasks health - which connectors are wired up, board task counts, and any errors. Use when the user asks about Cowork Tasks status or whether it is working.
---

# Cowork Tasks health

## Before you start: find the task tools

Cowork Tasks keeps its tasks in a small local server that ships inside this
plugin. Its tools (`list_tasks`, `list_config`, `create_task`,
`prepare_board_artifact` and the rest) are **not a connector**: never look for
them in the connector directory or ask the user to connect anything for them.

That server loads only in a **Cowork task that runs on the user's computer**
(Claude desktop app) and in **Claude Code**. A regular chat loads this plugin's
skills but ignores the server, so the tools are simply absent there. The app
also announces a freshly started server a few seconds after it connects, so a
task started right after installing the plugin or restarting the app can begin
without them.

1. If the task tools are not in your tool list, search for them before you
   conclude anything. Use the tool search tool with the query `cowork-tasks`,
   then `list_tasks`. Searching also waits for servers that are still starting.
   (In Claude Code they are named `mcp__plugin_cowork-tasks_cowork-tasks__<tool>`.)
2. If they are still not there, that is the result of this check, not a failure of it.
   Report "task store: not loaded in this session" with the likely reason (a
   regular chat, or a task started before the app announced the server), say
   what the user should do (a new Cowork task on their computer, or reopen the
   app and wait about 20 seconds), and still list the connectors you can see.

## Steps

1. Read the local task store via the MCP `list_tasks` tool with no
   `since` cursor. Note the `version` and the count by column. Also call
   `list_config` and note `lastTriageAt` (when triage last ran) and
   `onboardedAt` (when setup last finished); either may be empty.

2. Check which Cowork connectors are mounted in this session by listing
   available MCP tools. For each declared connector, report whether at
   least one tool is callable.

   The plugin declares these connectors in `.mcp.json`:

   - `gmail`, `google calendar`, `ms365`
   - `slack`
   - `atlassian`, `linear`, `asana`, `monday`, `clickup`, `github`
   - `notion`, `guru`
   - `fathom`, `fireflies`, `granola`, `gong`
   - `intercom`, `hubspot`, `close`
   - `pagerduty`, `datadog`
   - `box`, `egnyte`, `docusign`
   - `figma`, `canva`

3. Format as a short grouped table:

   ```
   Email/Calendar
     gmail              connected
     google calendar    connected
     ms365              not connected

   Chat
     slack              connected

   Issue trackers
     atlassian          connected
     linear             not connected
     ...

   Board: 23 active tasks (Inbox 5 / Todo 12 / In progress 4 / Blocked 1 / Done 1)
   Last triage: 2026-10-05 18:20 (or "never")
   Setup: finished 2026-10-05 (or "not run")
   MCP version: 47
   ```

4. If setup has not run (`onboardedAt` empty), or popular connectors (gmail,
   slack, atlassian) are missing, suggest `/cowork-tasks:setup`, which shows
   Connect buttons and pulls the first batch of tasks.

## Constraints

- Don't fabricate status. If a tool call fails or isn't available, just
  say "not connected" - never invent uptime or error rates.
- Group connectors by category to keep the table scannable.
