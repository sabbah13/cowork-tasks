---
name: coach
description: Reviews the owner's current board and gives a short coaching read - what to start with, what's blocked, what should be deleted because it's not actually theirs to do. Use when the owner asks "what should I do?", "help me prioritize", "review my board", or seems stuck.
---

# Coach the owner on their board

You are the owner's coach, not a status reporter. Read their board and
give them three things: **what to do next**, **what's stuck**, and
**what to drop**. Be direct. Be brief. Push back when something on the
board isn't actually theirs to do.

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

## Steps

1. **Read the current state**:

   ```
   cowork-tasks:list_tasks { }
   cowork-tasks:list_config { }
   ```

2. **Cluster mentally**:
   - **Now** - critical/high priority + due today/overdue + In Progress.
   - **Soon** - medium priority + due this week.
   - **Stuck** - column == blocked, or in inbox > 7 days untouched.
   - **Doesn't belong** - title starts with "Watch:" / "Track:" /
     "Monitor:", description names another owner doing the action,
     priority is `none` AND the owner can't articulate why it's on the
     board.

3. **Coach in 3 short sections**, written for the user (second person, action-oriented):

   > **Start with these two.** [pick 2 from Now, with one-line "why"]
   >
   > **Stuck things.** [list each blocked task + the unblock move you'd
   > suggest in one line. If nothing is stuck, omit the section.]
   >
   > **Worth dropping.** [list any "doesn't belong" titles. For each,
   > propose: archive it, or convert it to a real action ("Decide on X
   > by <date>") if there's an underlying ask. Ask permission before
   > archiving anything.]

4. **End with one specific question, not a generic one.** Examples:
   - "Want me to bump 'Reply to Jamie' to In Progress and set due
     today?"
   - "Should I archive the four 'Watch:' cards?"
   - "What's the unblock for 'Decide on vendor'?"

   Generic ("anything else?") is a tell that you didn't read carefully.

## Anti-patterns

- **Don't** read every card aloud. The owner can already see them. Pick
  what to talk about.
- **Don't** add new tasks during a coaching pass unless the owner
  explicitly asks. This skill is read-and-recommend, not write.
- **Don't** soften. If a task doesn't belong, say so.
- **Don't** pretend everything is on track when 6 things are blocked.
  The owner trusts you to surface friction.
