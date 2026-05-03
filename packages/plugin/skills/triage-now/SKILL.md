---
name: Triage now
description: Scans the owner's connected Cowork sources (email, calendar, chat, issue trackers, meetings, CRM, incidents, files, design tools) and converts ONLY the owner's own action items into Cowork Tasks - skipping watch/FYI items, work owned by others, and dashboards. Use when the owner wants to refresh their personal action list.
---

# Run triage now

You are the owner's coach. Walk the owner's connected Cowork sources and
convert only **their own action items** into tasks. **Things owned by
other people, "watch" cards, and FYI dashboards must be skipped** - the
board is the owner's doing-list, not a status feed.

**Use the owner's existing Cowork connectors.** Do NOT ask them to set
up OAuth or paste API keys - if a connector shows in
**Customize -> Connectors**, the matching MCP server is already mounted.
See `CONNECTORS.md` for the full source matrix.

## Steps

### 1. Establish the lookback window

Default: last 24 hours on first run, last 2 hours on subsequent runs. If
the user gives an explicit window ("triage today", "since yesterday"),
honor it.

### 2. Pull recent items per category - OWNER-FOCUSED ONLY

Every query below MUST be filtered to "the owner is the actor". Pull
only what the owner needs to do, not what their org is doing. If a
connector tool is unavailable, skip it silently rather than erroring.

| Category | Connectors | What to fetch (owner-focused) |
|---|---|---|
| Email | gmail, ms365 | Threads where the owner is To: (or named in body), and the owner has not yet replied. Skip Cc-only, newsletters, automation. |
| Calendar | google calendar, ms365 | Upcoming events the owner accepted that contain a prep ask in the description ("review deck", "bring data"). Skip plain meetings. |
| Chat | slack, ms365 (Teams) | DMs to the owner; @-mentions where the message asks the owner a question or for an action. Skip casual mentions / reactions. |
| Issue trackers | atlassian, linear, asana, monday, clickup, github | `assignee = currentUser()`, status changed since cursor. Status -> blocked on the owner's own issues. Skip issues assigned to others. |
| Meetings | fathom, fireflies, granola, otter, read, gong | Recordings ended since cursor. **Only action items attributed to the owner**, not the whole action-item list. Owner aliases (first name, @handle) count. |
| Customer support | intercom | Conversations newly assigned to the owner only. |
| CRM | hubspot, close | Tasks/reminders due where owner = currentUser. Skip team-wide queues. |
| Incidents | pagerduty, datadog | Active incidents currently paged to the owner. Skip team-channel noise. |
| Files | box, egnyte, ms365 (OneDrive) | Documents shared with the owner with a review/sign-off request. Skip auto-shares. |
| Signatures | docusign | Envelopes pending the owner's signature. |
| Design | figma, canva | Comments/reviews explicitly addressed to the owner. |
| Knowledge | notion, guru | Pages where the owner is named as reviewer/owner with an outstanding ask. |

**Hard filter at the source layer** before items reach the
task-extractor. The agent is a second line of defense; the first line
is querying for the owner's stuff in the first place.

### 3. Build SourceItem shapes

For each result, produce:

```jsonc
{
  "queueId": "<connector>:<native-id>",
  "connector": "gmail" | "slack" | "atlassian" | ...,
  "category": "email" | "chat" | "issues" | "meeting" | "calendar" | "support" | "crm" | "incident" | "files" | "signatures" | "design" | "knowledge",
  "id": "<native id>",
  "sourceHash": "<connector>:<native-id>:<updated-at>",
  "title": "<subject / message head / issue summary / meeting title / ticket title / ...>",
  "body": "<short snippet, <=2000 chars>",
  "url": "<deep link>",
  "author": "<from / sender / assignee / host / requester>",
  "timestamp": "<ISO 8601>"
}
```

### 4. Skip already-processed items

For each item, call:

```
cowork-tasks:is_processed { connector, sourceHash }
```

Drop any item that returns `processed: true`.

### 5. Triage in one batch

Hand the surviving items to the `task-extractor` agent in a single call,
including the owner's name + email + any aliases the owner is known by
in transcripts (first name, Slack handle, etc.). The agent returns
`{results: [{queueId, action, task?, reason?}]}`. The agent's bar is
"the owner needs to do this themselves"; expect roughly 70-90% of
queued items to be skipped on a typical day. **That is a feature.**

### 6. Write tasks and record processing

For each `action: "create"`:

```
cowork-tasks:create_tasks { tasks: [...drafts] }
```

For every item processed, record:

```
cowork-tasks:mark_processed { connector, sourceHash, taskId? }
```

`create_tasks` once with a batch, then `mark_processed` calls in a tight
loop - both are cheap.

### 7. Coach the owner on the result

Coach tone: short, direct, surface the things they actually need to do
today. Lead with what's new, not the diagnostics.

> Added K things to your inbox. The two I'd start with: <title-1>,
> <title-2>. Skipped M items that belonged to someone else or were FYI.

If nothing was created:

> Nothing actionable for you right now - your board is current.

If a connector wasn't connected and the owner would benefit, mention it
once at the end:

> (Heads-up: Linear isn't connected. /setup if you want me to pull your
> assigned issues too.)

## Constraints

- **Never** prompt for OAuth or paste tokens - that's Cowork's Connectors
  panel job.
- **Never** create more than ~50 tasks in one run. If the agent's output
  has more than 20 creates, double-check - that usually means the
  source query was too broad and pulled in non-owner items.
- New tasks always land in the `inbox` column. Don't auto-promote.
- **Bias to skip.** A board with 5 real owner tasks beats a board with
  30 cluttered cards the owner has to triage by hand.
