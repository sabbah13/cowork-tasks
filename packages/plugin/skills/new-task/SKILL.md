---
description: Creates a new task on the Cowork Tasks board from a natural-language description. Use when the user says "add a task", "remind me to ...", "create a task for ...", "todo: ...".
---

# Create a new task

The user provided: $ARGUMENTS

## Steps

1. Parse the user's description into a `TaskDraft`:
   - **title** - short action-verb form (max 80 chars).
   - **description** - any context the user gave, ~50-300 chars. If they
     didn't give context, leave empty.
   - **priority** - critical / high / medium / low / none. Default `medium` if
     they used urgency language ("urgent", "asap", "today"); else `none`.
   - **due** - if the user mentioned a date or relative time, convert to ISO
     date.
   - **owner** - default to the user (resolve via `list_config` -> `owner`).
   - **source** - `{type: "manual"}`.
2. Call MCP `create_task` with the draft.
3. Confirm in chat: "Created: <title> (<column>, <priority>)".

## Constraints

- Don't fabricate detail the user didn't give.
- Don't ask follow-up questions for routine tasks - ship it. Ask only if the
  description is genuinely ambiguous (e.g., "add it" with no antecedent).
