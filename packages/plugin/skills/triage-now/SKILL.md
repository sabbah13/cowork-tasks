---
name: Triage now
description: Scans the user's connected Cowork sources (email, calendar, chat, issue trackers, meeting recorders, CRM, incidents, files, design tools) for new items and creates Cowork Tasks for the ones that need follow-up. Use when the user wants to refresh their board or asks to process their inbox.
---

# Run triage now

This is the heart of Cowork Tasks. Walk the user's connected Cowork
sources, decide what should become a task, write the results to the local
`cowork-tasks` MCP. **Use the user's existing Cowork connectors.** Do
NOT ask them to set up OAuth or paste API keys - if a connector shows in
**Customize -> Connectors**, the matching MCP server is already mounted
in this session. See `CONNECTORS.md` for the full source matrix.

## Steps

### 1. Establish the lookback window

Default: last 24 hours on first run, last 2 hours on subsequent runs. If
the user gives an explicit window ("triage today", "since yesterday"),
honor it.

### 2. Pull recent items per category

Run only the queries for connectors the user has actually authorized. If a
connector tool is unavailable, skip it silently rather than erroring.

| Category | Connectors | What to fetch |
|---|---|---|
| Email | gmail, ms365 | Threads since cursor where user is To/Cc, prefer unread; skip newsletters |
| Calendar | google calendar, ms365 | Events the user accepted that ended in the window, plus upcoming events with prep notes |
| Chat | slack, ms365 (Teams) | DMs and `@me` mentions since cursor |
| Issue trackers | atlassian, linear, asana, monday, clickup, github | Items where assignee == me, updated since cursor; status changes to blocked |
| Knowledge | notion, guru | Pages mentioning user as reviewer / commenter |
| Meeting recorders | fathom, fireflies, granola, gong | Recordings ended since cursor; attributed action items |
| Customer support | intercom | Conversations newly assigned to user |
| CRM | hubspot, close | Tasks/reminders due, stale opportunities |
| Incidents | pagerduty, datadog | Active incidents user is on-call for, monitors firing on user's services |
| Files | box, egnyte, ms365 (OneDrive) | Shares pending review by user |
| Signatures | docusign | Envelopes pending signature |
| Design | figma, canva | Review/comment requests addressed to user |

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

Hand the surviving items to the `task-extractor` agent in a single call.
The agent returns `{results: [{queueId, action, task?, reason?}]}`.

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

### 7. Tell the user what happened

Short summary:

> Triaged N items from <connectors used>: created K tasks, skipped M.

If a connector wasn't connected, mention it briefly:

> Skipped Linear, Granola, Datadog (not connected).
> Run /cowork-tasks:setup to add them.

If nothing was queued:

> Nothing to triage - your board is up to date.

## Constraints

- **Never** prompt for OAuth or paste tokens - that's Cowork's Connectors
  panel job.
- **Never** create more than ~50 tasks in one run; if the queue is huge,
  warn the user and offer to narrow the window.
- New tasks always land in the `inbox` column. Don't auto-promote.
