---
name: open-board
description: Opens the Cowork Tasks kanban board as an artifact. Publishes the plugin's own pre-built board page (never a page you write yourself), live against the user's task store, and reuses the same artifact every time. Use when the user asks to open, show, or check their board, kanban, tasks, or inbox, and as the last step of setup.
---

# Open the Cowork Tasks board

The board is a finished page that ships with this plugin: columns, drag and
drop, side panel, checklists, the plugin's design. The `prepare_board_artifact`
tool stamps the current tasks into it and writes it to a file. Your job is to
**publish that file exactly as it is**.

## The rule that matters

- **Never write, rewrite, "improve" or summarize the board page.** Do not
  generate your own HTML, a table, a chart, or a "snapshot" of the tasks and
  publish that instead. A hand-made page has none of the board's design or
  behavior, and it cannot save changes. The prepared file *is* the board.
- If you cannot publish the prepared file, **say so and say why**. Do not
  substitute something else.
- Do not read the prepared file into the conversation or paste it into a tool
  call: it is about 600 KB. Pass its **path** to the artifact tool.

## Canonical identifiers

| Field | Value |
|---|---|
| Artifact title | `Cowork Tasks` |
| Output filename | `cowork-tasks-board.html` |
| Legacy artifact id (old path only) | `cowork-tasks` |

## Steps

1. **Pick the output path**: the writable outputs folder of this session.

   ```
   <outputs>/cowork-tasks-board.html
   ```

2. **Work out `hostServer`.** Find a tool of this plugin's task server in your
   tool list. Its name looks like
   `mcp__plugin_cowork-tasks_cowork-tasks__list_tasks`. The server segment is the
   part between `mcp__` and the next `__`, here `plugin_cowork-tasks_cowork-tasks`.
   Then `hostServer` is `host:` plus that segment:

   ```
   host:plugin_cowork-tasks_cowork-tasks
   ```

   Use whatever segment your tool names actually have; do not copy the example
   if yours differs. If you cannot find any tool of this server, skip
   `hostServer` (the board will then be a read-only snapshot).

3. **Prepare the board file** (one call):

   ```
   cowork-tasks:prepare_board_artifact {
     "outPath": "<outputs>/cowork-tasks-board.html",
     "hostServer": "host:<segment>"
   }
   ```

   Returns `{path, bytes, tasks, version, pluginVersion}`. The page is on disk;
   the response does not include it. If it returns
   `error_code: "INVALID_HOST_SERVER"`, call it again without `hostServer`.

4. **Publish it with the artifact tool** (the tool in this session that
   publishes a local HTML file as an artifact and takes a file path, a title,
   a description and optional `capabilities`).

   a. **Reuse the artifact.** List the user's artifacts. If one titled
      `Cowork Tasks` exists, update it in place (pass its URL) so the link and
      its history stay the same. If none exists, create a new one. The tool may
      insist that you read an existing artifact before updating it: do that
      with a short question as the prompt ("confirm this is the Cowork Tasks
      board"), not to look at its HTML. An artifact with a different title (for
      example "Cowork Tasks Board" from an earlier hand-made attempt) is not
      this one: leave it alone and tell the user it can be deleted.

   b. **Inputs**: the prepared file's path, a one-line description such as
      "Your Cowork Tasks kanban board", icon `kanban` (the title, `Cowork Tasks`,
      comes from the page's own `<title>`; leave it as it is), and these
      `capabilities`, which let the board read and write tasks through
      the task server (replace `<HOST_SERVER>` with the segment from step 2):

      ```json
      {
        "capabilities": {
          "mcp": {
            "servers": [
              {
                "server": "host:<HOST_SERVER>",
                "tools": [
                  "list_tasks",
                  "get_task",
                  "create_task",
                  "update_task",
                  "move_task",
                  "archive_task",
                  "delete_task",
                  "restore_task",
                  "list_config",
                  "update_config"
                ]
              }
            ]
          }
        }
      }
      ```

      The tools are listed by their plain names. The first time the board
      opens, the user is asked once to allow it to use the Cowork Tasks server;
      after that, edits are saved to their task store. An artifact with this
      grant stays private to its owner, which is expected.

   c. **If publishing is refused because of the capabilities** (for example the
      host server is not available in this session), publish the **same file
      once more without `capabilities`**. The board then opens as a read-only
      snapshot. Tell the user in one sentence that it is read-only and why.

   d. **If the file cannot be published at all**, tell the user what the tool
      said. Do not build a different page.

5. **Confirm** in one or two short sentences, with the link:

   > Board's open with N tasks: <link>.

   Add how to tell it is live: the footer shows `mcp` when the board is
   connected to the task store, and `snapshot` when it is read-only. If you had
   to publish without `capabilities`, say that it is a snapshot.

6. **Optional version check** (cached): `cowork-tasks:check_version { }`. If it
   reports `outdated: true`, append " (vX.Y.Z available - update Cowork Tasks
   from Customize > Plugins, or run `claude plugin update cowork-tasks` in
   Claude Code)".

## Legacy path (live artifacts, before 2026-08-19)

Anthropic made live artifacts a legacy format on 2026-08-19, and on current
builds the `cowork.*` artifact tools below are usually not present. Use this
path **only** if the session has no artifact tool as described in step 4 but
does have `cowork.list_artifacts`, `cowork.create_artifact` and
`cowork.update_artifact`. Steps 1 to 3 stay the same (you may skip
`hostServer`).

1. List artifacts: `cowork.list_artifacts { }` and look for `id == "cowork-tasks"`.
   If the list is non-empty, derive `artifactsDir` from any returned path: it
   is the parent directory of the per-artifact folder, for example
   `/Users/foo/Documents/Claude/Artifacts/some-id/index.html` gives
   `artifactsDir = /Users/foo/Documents/Claude/Artifacts`.

2. **`cowork-tasks` is in the list: update it directly.** Always pass the same
   `mcp_tools` allowlist, in case Cowork clears it on update:

   ```
   cowork.update_artifact {
     "id": "cowork-tasks",
     "html_path": "<outputs>/cowork-tasks-board.html",
     "mcp_tools": [
       "mcp__cowork-tasks__list_tasks",
       "mcp__cowork-tasks__get_task",
       "mcp__cowork-tasks__create_task",
       "mcp__cowork-tasks__update_task",
       "mcp__cowork-tasks__move_task",
       "mcp__cowork-tasks__archive_task",
       "mcp__cowork-tasks__delete_task",
       "mcp__cowork-tasks__restore_task",
       "mcp__cowork-tasks__list_config",
       "mcp__cowork-tasks__update_config"
     ]
   }
   ```

3. **`cowork-tasks` is not in the list: clear any stale folder, then create.**
   Cowork's UI deletes manifest entries but leaves folders on disk, which blocks
   `create_artifact`. The clear tool does nothing when there is nothing to clear:

   ```
   cowork-tasks:clear_artifact_folder {
     "artifactsDir": "<derived-dir>",
     "id": "cowork-tasks"
   }
   ```

   Then create. `mcp_tools` is the allowlist of tools the board may call at
   runtime; without it every read and write fails silently:

   ```
   cowork.create_artifact {
     "id": "cowork-tasks",
     "name": "Cowork Tasks",
     "html_path": "<outputs>/cowork-tasks-board.html",
     "mcp_tools": [
       "mcp__cowork-tasks__list_tasks",
       "mcp__cowork-tasks__get_task",
       "mcp__cowork-tasks__create_task",
       "mcp__cowork-tasks__update_task",
       "mcp__cowork-tasks__move_task",
       "mcp__cowork-tasks__archive_task",
       "mcp__cowork-tasks__delete_task",
       "mcp__cowork-tasks__restore_task",
       "mcp__cowork-tasks__list_config",
       "mcp__cowork-tasks__update_config"
     ]
   }
   ```

## Anti-patterns

- **Never** author your own board page, or publish a summary of the tasks, in
  place of the prepared file.
- **Never** read the prepared HTML or pass it inline to any tool.
- **Never** call `prepare_board_artifact` without `outPath`.
- **Never** create a second artifact titled differently ("Cowork Tasks Board",
  "Tasks v2", anything date-stamped). One artifact, `Cowork Tasks`, updated in
  place.
- **Never** ask the user to delete folders in Finder. (Legacy path: the
  `clear_artifact_folder` tool exists for exactly that reason, and
  `create_artifact` must never run before it when the id is not in the list.)

## Tool-call budget

| Path | Calls | Sequence |
|---|---|---|
| New artifact | 3 | prepare, list artifacts, create |
| Update existing | 3 | prepare, list artifacts, update |
| Legacy: update | 3 | prepare, list_artifacts, update_artifact |
| Legacy: fresh create | 4 | prepare, list_artifacts, **clear_artifact_folder**, create_artifact |
