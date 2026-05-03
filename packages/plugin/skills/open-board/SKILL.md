---
name: Open board
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

Always reuse the same artifact id. The flow has no failed steps in any path.

## Canonical identifiers

| Field | Value |
|---|---|
| Artifact id | `cowork-tasks` |
| Artifact name | `Cowork Tasks` |
| Output filename | `cowork-tasks-board.html` |

## Steps

1. **Pick the session output path** (the writable directory Cowork exposes
   for generated files). Build:

   ```
   <outputs>/cowork-tasks-board.html
   ```

2. **Write the HTML** (one MCP call):

   ```
   cowork-tasks:prepare_board_artifact { "outPath": "<outputs>/cowork-tasks-board.html" }
   ```

   Returns `{path, bytes, tasks, version, pluginVersion}`. The HTML is on
   disk; the response does NOT include the body.

3. **Optional version check** (cached):

   ```
   cowork-tasks:check_version { }
   ```

4. **List artifacts**:

   ```
   cowork.list_artifacts { }
   ```

   Look for `id == "cowork-tasks"`.

   If the list is non-empty, derive `artifactsDir` from any returned path:
   it's the parent directory of the per-artifact folder. For example,
   `/Users/foo/Documents/Claude/Artifacts/some-id/index.html` →
   `artifactsDir = /Users/foo/Documents/Claude/Artifacts`.

5. **Branch on existence**:

   ### A. `cowork-tasks` IS in the manifest

   Update directly:

   ```
   cowork.update_artifact {
     "id": "cowork-tasks",
     "html_path": "<outputs>/cowork-tasks-board.html"
   }
   ```

   Done. Total: 4 tool calls.

   ### B. `cowork-tasks` is NOT in the manifest

   Cowork's UI deletes manifest entries but leaves folders on disk.
   **Proactively** clear any stale folder before create. The tool
   no-ops cleanly when nothing exists:

   ```
   cowork-tasks:clear_artifact_folder {
     "artifactsDir": "<derived-dir>",
     "id": "cowork-tasks"
   }
   ```

   Returns `{existed, deleted, path}`. Either result is fine - no error.

   Then create:

   ```
   cowork.create_artifact {
     "id": "cowork-tasks",
     "name": "Cowork Tasks",
     "html_path": "<outputs>/cowork-tasks-board.html"
   }
   ```

   Done. Total: 5 tool calls, all successful.

6. **Confirm** in one short sentence:

   > Board's open with N tasks loaded.

   If `check_version` reported `outdated: true`, append " (vX.Y.Z available
   - run `/plugin update cowork-tasks` to refresh)".

## Anti-patterns

- **Never** invent a new artifact id like `cowork-tasks-board`,
  `tasks-board-v2`, or anything date-stamped. Always `cowork-tasks`.
- **Never** call `create_artifact` without first calling
  `clear_artifact_folder` when the id is not in the manifest. That
  produces a guaranteed "folder already exists" error if the user has
  ever opened the board before.
- **Never** ask the user to delete folders in Finder. The
  `clear_artifact_folder` tool exists for exactly that reason.
- **Never** call `prepare_board_artifact` without `outPath`.
- **Never** read the prepared HTML or pass it inline to create/update.

## Tool-call budget (always exact, no failed steps)

| Path | Calls | Sequence |
|---|---|---|
| Update existing | 4 | prepare, check_version, list_artifacts, update_artifact |
| Fresh create | 5 | prepare, check_version, list_artifacts, **clear_artifact_folder**, create_artifact |
