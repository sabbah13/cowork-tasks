---
name: Open board
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

Three to four tool calls, in order. Always reuse the same artifact - never
create a new one with a fresh id, the user wants one stable board.

## Canonical identifiers

Use these exact strings every time:

| Field | Value |
|---|---|
| Artifact id | `cowork-tasks` |
| Artifact name | `Cowork Tasks` |
| Output filename | `cowork-tasks-board.html` |

## Steps

1. **Pick the session output path** (the writable directory Cowork exposes
   for generated files). Build the full path:

   ```
   <outputs>/cowork-tasks-board.html
   ```

2. **Write the HTML to disk** via the MCP server (one call):

   ```
   cowork-tasks:prepare_board_artifact { "outPath": "<outputs>/cowork-tasks-board.html" }
   ```

   Returns `{path, bytes, tasks, version, pluginVersion}`. The response
   does NOT include the html body when `outPath` is set - by design,
   because the file is large.

3. **Optional version check** (cheap, 6h cached):

   ```
   cowork-tasks:check_version { }
   ```

   If `outdated` is true, mention it in your final reply.

4. **Decide create vs update by listing artifacts first**:

   ```
   cowork.list_artifacts { }
   ```

   Look for an entry with `id == "cowork-tasks"`.

5. **Branch on existence**:

   - **If `cowork-tasks` exists in the list** → update it:

     ```
     cowork.update_artifact {
       "id": "cowork-tasks",
       "html_path": "<outputs>/cowork-tasks-board.html"
     }
     ```

   - **If it does NOT exist** → try to create it:

     ```
     cowork.create_artifact {
       "id": "cowork-tasks",
       "name": "Cowork Tasks",
       "html_path": "<outputs>/cowork-tasks-board.html"
     }
     ```

     - **If create fails with "folder already exists"** (stale folder
       from a previous run, manifest out of sync), immediately retry
       with `update_artifact` using the same `id: "cowork-tasks"`. Do
       NOT pick a different id - the user wants one stable artifact.

6. **Confirm** in one short sentence:

   > Board's open with N tasks loaded.

   If step 3 reported `outdated: true`, append " (v0.X.Y available -
   re-upload to update)".

## Anti-patterns

- **Never** invent a new artifact id like `cowork-tasks-board`,
  `tasks-board`, `tasks-board-v2`, or anything date-stamped. Always
  `cowork-tasks`. The user wants the same board to update in place.
- **Never** call `prepare_board_artifact` without `outPath` - the
  response will inline the entire HTML and overflow the tool budget.
- **Never** read the prepared HTML file with the Read tool - it's large.
- **Never** pass HTML as inline content to `create_artifact` or
  `update_artifact` - always use `html_path`.
- **Never** call `list_tasks` or `list_config` for this skill -
  `prepare_board_artifact` covers both internally.

## Expected tool-call budget

| Path | Tool calls |
|---|---|
| First time (artifact doesn't exist) | 4 (prepare, check_version, list_artifacts, create_artifact) |
| Subsequent opens | 4 (prepare, check_version, list_artifacts, update_artifact) |
| Stale-folder recovery | 5 (prepare, check_version, list_artifacts, create_artifact \[fails], update_artifact) |

If you find yourself making more than 5 tool calls or seeing a second
`create_artifact` with a different id, you went off-script - stop, read
this skill again, and use `cowork-tasks` as the id.
