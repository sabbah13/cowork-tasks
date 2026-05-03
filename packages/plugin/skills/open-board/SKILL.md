---
name: Open board
description: Opens the Cowork Tasks live artifact kanban board inside Claude Cowork's Live Artifacts tab. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox.
---

# Open the Cowork Tasks board

Always reuse the same artifact id - never invent a new one.

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

   Look for `id == "cowork-tasks"`. Note any path field for one of the
   returned artifacts - it will look like
   `/Users/.../Documents/Claude/Artifacts/<some-id>/index.html`. The
   parent of `<some-id>` is the **artifactsDir**.

5. **Branch on existence**:

   - **Found in manifest** → update:

     ```
     cowork.update_artifact { "id": "cowork-tasks", "html_path": "<outputs>/cowork-tasks-board.html" }
     ```

   - **Not found** → create:

     ```
     cowork.create_artifact { "id": "cowork-tasks", "name": "Cowork Tasks", "html_path": "<outputs>/cowork-tasks-board.html" }
     ```

6. **If create failed with "folder already exists"** (Cowork's UI deletes
   manifest entries but leaves folders on disk - the plugin is supposed to
   own this id, so reclaim it):

   a. Derive `artifactsDir` from any path in step 4. Example: if
      list_artifacts returned `/Users/foo/Documents/Claude/Artifacts/some-id/index.html`,
      then artifactsDir = `/Users/foo/Documents/Claude/Artifacts`.

   b. Call:

      ```
      cowork-tasks:clear_artifact_folder {
        "artifactsDir": "<derived-dir>",
        "id": "cowork-tasks"
      }
      ```

      Returns `{existed, deleted, path}`. Safe: the tool refuses any id
      with path separators or any target outside artifactsDir.

   c. Retry the create call from step 5.

7. **Confirm** in one short sentence:

   > Board's open with N tasks loaded.

   If `check_version` reported `outdated: true`, append " (vX.Y.Z available
   - run `/plugin update cowork-tasks` to refresh)".

## Anti-patterns

- **Never** invent a new artifact id like `cowork-tasks-board`,
  `tasks-board-v2`, or anything date-stamped. Always `cowork-tasks`.
- **Never** ask the user to manually delete folders. The
  `clear_artifact_folder` tool exists for exactly that reason.
- **Never** call `prepare_board_artifact` without `outPath`.
- **Never** read the prepared HTML or pass it inline to create/update.

## Tool-call budget

| Path | Calls |
|---|---|
| Update existing | 4 (prepare, check_version, list_artifacts, update_artifact) |
| Fresh create | 4 (prepare, check_version, list_artifacts, create_artifact) |
| Stale-folder recovery | 6 (prepare, check_version, list_artifacts, create_artifact \[fails], clear_artifact_folder, create_artifact) |
