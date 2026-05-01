# Task schema

Tasks are JSON files with the extension `.task.json`. They live under `~/.cowork-tasks/tasks/` by default, but can also live in any folder a user wants Cowork Tasks to scan.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Unique. Format suggestion: `<sourceType>_<slug>_<YYYYMMDD>`. |
| `title` | `string` | Action-verb form, max 200 chars. |
| `status` | `'active' \| 'archived' \| 'deleted'` |  |
| `column` | `string` | One of the configured columns (default: `inbox`, `todo`, `in-progress`, `blocked`, `done`). |
| `position` | `number` | Order within column, 0 = top. |
| `created` | ISO 8601 | Auto-set on create. |
| `updated` | ISO 8601 | Auto-bumped on every change. |
| `labels` | `string[]` | Names (not ids) for portability. |

## Recommended fields

| Field | Type | Notes |
|---|---|---|
| `description` | `string` | Rich context, 50-300 chars. |
| `owner` | `string` | Single canonical person. |
| `priority` | `'critical' \| 'high' \| 'medium' \| 'low' \| 'none'` |  |
| `due` | ISO 8601 |  |
| `source.type` | `'email' \| 'meeting' \| 'slack' \| 'jira' \| 'linear' \| ...` |  |
| `source.url` | `string` | Direct link with timestamp where applicable (e.g. Fathom `?t=`). |
| `source.author` | `string` | Sender / requester. |

## Example

```json
{
  "id": "email_review_q3_20260501",
  "title": "Review Q3 plan doc from Sarah",
  "description": "Sarah asked to review and comment by Friday. Doc is in Google Drive.",
  "status": "active",
  "column": "inbox",
  "position": 0,
  "owner": "Sam Rivera",
  "priority": "medium",
  "due": "2026-05-08",
  "labels": ["review", "Q3-plan"],
  "source": {
    "type": "email",
    "url": "https://mail.google.com/mail/u/0/#inbox/18a2c5e0d4f9b1",
    "author": "Jamie Lee"
  },
  "links": [],
  "checklist": [],
  "comments": [],
  "created": "2026-05-01T09:14:00Z",
  "updated": "2026-05-01T09:14:00Z"
}
```

## Why one file per task

- **Grep-friendly.** Search across years of tasks with `rg`.
- **Git-friendly.** Diffs are tiny and meaningful.
- **No DB to corrupt.** Disaster recovery = restore from git or backup.
- **Editable in any editor.** Power users tweak in Vim, plugins read the changes via file watcher within 300 ms.
