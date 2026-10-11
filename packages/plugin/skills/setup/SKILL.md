---
name: setup
argument-hint: "[days of history to pull, default 14]"
description: Guided first-run setup for Cowork Tasks. Checks which sources are connected, shows Connect buttons for the ones that are missing, pulls the owner's first batch of action items from what is connected, and opens the board. Use on first run, when the user says set up, get started or connect my sources, and when triage reports a missing connector.
---

# Set up Cowork Tasks

Requested history (may be empty): $ARGUMENTS

You are the owner's coach and this is their first five minutes. By the end of
this one command the owner should have: (1) their sources connected, or a
Connect button for each missing one, (2) a first batch of **their own**
action items on the board, and (3) the board open. **Do the work. Do not just
explain where to click.**

Cowork Tasks does not run its own sign-in. It reads from connectors the owner
has connected in Claude, and a connector can only be connected by the owner
clicking Connect, so your job is to put that button in front of them and carry
on with whatever is already connected.

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
2. If they are still not there, **stop** and tell the user, in plain words, what you found.
   Say that the Cowork Tasks task store is not loaded in this session, so nothing
   was set up or written, and give the two fixes in this order: start a **new**
   Cowork task in the Claude desktop app (on their computer, not a regular
   chat) and run this command there; if it still has no tools, quit and reopen
   the app, wait about 20 seconds, then start a new task. Do not create tasks
   anywhere else and do not publish a board page. Do not tell them to "enable
   the plugin" unless you can see that it is disabled.

   You may offer once to do a one-off read of the connected sources in this
   chat as a stopgap, and say that nothing from it will be saved to a board.

## Steps

### 1. Read the state (do these together)

- `cowork-tasks:list_config { }` for `owner`, `onboardedAt` and `lastTriageAt`.
- `cowork-tasks:list_tasks { }` for how many tasks the board already has.
- Days of history for the first pass: a number in the requested history above
  ("30", "30d", "2 weeks"), otherwise **14**, at most 60.

If `onboardedAt` is already set this is a re-run: say "Re-checking your
sources" and do steps 2, 3 and 7 only (skip the backfill; `triage-now` will
pick up from `lastTriageAt` by itself if the owner asks for it).

### 2. See what is connected

Check each core category, using the connector registry tool
(`search_mcp_registry`) with the keywords below. Each result says whether it is
`connected` and carries a `directoryUuid`.

| Category | Keywords | Preferred connectors |
|---|---|---|
| Email | email, gmail, outlook | Gmail, Microsoft 365 |
| Calendar | calendar | Google Calendar, Microsoft 365 |
| Chat | slack, chat, teams | Slack, Microsoft 365 (Teams) |
| Issue trackers | issues, jira, linear, tasks | Atlassian, Linear, Asana, monday.com, ClickUp, GitHub |
| Meetings | meetings, transcripts, fathom | Fathom, Fireflies, Granola, Gong |

If the registry tool is not available in this session, fall back to the
connector tools you can see (the way `/cowork-tasks:health` does).

Do not list all 26 supported connectors unless the owner asks; the table is
what matters on day one. `CONNECTORS.md` has the full matrix.

### 3. Offer to connect what is missing

For every core category with **no connected source**, take the best preferred
connector from the registry results and collect its `directoryUuid`. Then call
`suggest_connectors` **once** with those UUIDs (at most 6) and generic
`keywords` such as "email", "calendar", "messages", "issues", "meetings" (nouns,
no brand names). That puts Connect buttons in the conversation.

Say one line: "Connect buttons are above. I'm not waiting for you, I'll start
with what's already connected."

- **Never block on the connections.** Carry on to step 4 immediately.
- **Never** ask the owner to paste a token or run an OAuth helper.
- If every core category already has a connected source, say so and skip the
  buttons.
- They can also add connectors under **Customize > Plugins > Cowork Tasks >
  Connectors**. Mention it once, only if you showed buttons.

### 4. Make sure tasks get an owner

If `owner` is empty, work out the owner's name and email from a connected
account (the email connector's profile, or Slack's current user) and save the
name:

```
cowork-tasks:update_config { patch: { owner: "<name>" } }
```

Confirm in one line ("I'm assuming you're Sam Rivera, sam@example.com. Tell me
if that's wrong."). Ask only if you cannot tell.

### 5. Do the first pass now

Start both of these straight away; they do not depend on each other. If this
session lets you run them in parallel (for example with subagents), do. If not,
open the board first, because that takes seconds and shows the owner something
immediately.

a. **The board.** Invoke the `cowork-tasks:open-board` skill (use the Skill tool
   if you have it, otherwise follow that skill's steps). The owner should see
   the real Cowork Tasks board, not a page you made.

b. **The triage.** Invoke the `cowork-tasks:triage-now` skill with the history
   window, for example `14d`. It handles the backfill, the owner-only filter and
   the extractor agent.

Once triage has finished, run `open-board` once more unless you know the board
is live (its footer says `mcp`, which the owner can see): a snapshot only holds
the tasks that existed when it was prepared, so the new ones appear only after
a republish. `open-board` checks what it published, so rely on its numbers.
Do not describe the board's contents from memory, and do not take tasks you saw
inside a saved copy of an old page for the owner's tasks.

### 6. Record that setup is done

After the first pass has completed:

```
cowork-tasks:update_config { patch: { onboardedAt: "<now, ISO 8601>" } }
```

### 7. Tell the owner what happened

Coach voice, short. Cover, in this order: what is connected, what is still
missing (the buttons are above), how many tasks you found and the two to start
with, the board link, and one next step.

> Found N things for you across Gmail, Calendar and Slack. I'd start with
> <title-1> and <title-2>. Your board is here: <link>. Next: `/cowork-tasks:coach`
> for a read on what to do first. Want me to run triage every morning?

Offer scheduling once. Do not set anything up unasked.

Use the numbers `open-board` checked. If it could not confirm that the board
shows the current tasks, or the board is a read-only snapshot, say so plainly
(with the snapshot time) instead of describing the board as up to date.

## Constraints

- **Do the work, not the tour.** One command should leave the owner with a
  populated board, not a to-do list of their own.
- **Never** ask the user to paste tokens or run a local OAuth helper.
- **Never** invent connector names. The connector registry is the source of
  truth for what exists.
- **Never** suggest writing a custom connector package, polling daemon, or
  local OAuth helper. Cowork Tasks reads from connectors that Claude already
  hosts, and that is the architecture, not a temporary state.
- If the owner wants a source this plugin does not read yet (for example
  YouTrack or Telegram), say so honestly: triage only queries the categories in
  step 2. A connector may exist for it in the registry (you can still offer to
  connect it), but adding it to triage is a one-line change to the plugin's
  `.mcp.json` plus the triage table, so they should ask for it on the project's
  issue tracker.
