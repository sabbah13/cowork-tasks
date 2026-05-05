# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Performance

- **Lazy-load SidePanel on card select.** `SidePanel` is now loaded with `React.lazy` + `Suspense` and only mounts when a card is clicked. Memoized `selectedTask` lookup stops `tasks.find()` running on every 2s poll tick. Lighthouse Performance score: 60 → 72 (+12) on a 100+ card board. Closes #30.

## [0.4.13] - 2026-05-04

### Fixed

- **Critical: AI buttons no longer crash the artifact iframe.** Calling any of `window.cowork.askClaude`, `window.claude.complete`, or `window.claude.sendToChat` from inside the live-artifact iframe in current Cowork builds was unmounting the artifact ~4s after the click. Local edits in the open card would have been lost. This release ships a kill-switch (`SUPPRESS_AI_BRIDGE = true` in `api.ts`) that bypasses every host AI surface and falls back to a safe behavior.
- **Removed `alert()`** from the Triage-now / Setup buttons. Modal dialogs in the artifact iframe block the host and have been observed to trigger unmount.

### Changed

- **AI buttons (Summarize source / Tighten title / Draft reply / Split into subtasks) and the Triage-now CTA now copy the prompt to the clipboard** and surface a transient toast — the user pastes in chat to get the actual answer. Each AI button still pings `askClaude()` purely for diagnostic console output (`[cowork-tasks] AI bridge: ...`) so we can see what's exposed in any given Cowork build, but the result is suppressed.
- New `<Toast>` element rendered in App; auto-dismisses after 4s. Replaces every previous `alert()` call.
- `resolveAiBridge()` is now defensive: every probe is wrapped in `try/catch` so a sandboxed Window throwing on cross-origin property access doesn't take down the artifact.

### Tests

- e2e tests for AI buttons + Triage-now updated to assert clipboard-copy + toast behavior. 82/82 e2e green.
- 8/8 mcp-server unit + 15/15 storage unit unchanged.

### Re-enabling the inline AI path later

Flip `SUPPRESS_AI_BRIDGE` to `false` in `packages/artifact/src/api.ts` once we've identified a stable AI bridge in a specific Cowork build (verify by inspecting the boot log line `[cowork-tasks] AI bridge: …` in DevTools). The full `askClaude()` flow is intact; only the gate prevents calls.

## [0.4.12] - 2026-05-04

### Fixed

- **AI buttons now resolve a working bridge.** The "Summarize source", "Tighten title", "Draft reply", "Split into subtasks", and "Triage now" actions were silently no-oping in builds where the host's AI surface didn't match the one we probed. The new `resolveAiBridge()` checks every documented namespace in priority order:
  1. `window.cowork.askClaude(prompt, context?)` (newer Cowork drafts)
  2. `window.claude.complete(prompt)` (claude.ai artifacts API)
  3. `window.claude.sendToChat(prompt)` (older Cowork drafts)
     Logs which path is in use to the console at boot (`[cowork-tasks] AI bridge: ...`) so you can verify in DevTools.
- **`askClaude` now returns a structured result** `{ok, text?, via?, reason?, error?}`. Callers branch on it: inline result is shown in the side panel; "sent to chat" gets a "switch to chat" hint; `no-bridge` shows a clear message + offers clipboard fallback for the Triage-now CTA.

### Changed

- Side panel AI buttons surface real failure modes ("AI bridge not available in this Cowork build", "AI call failed via X") instead of silently doing nothing.
- Triage-now button copies the prompt to the clipboard when no AI bridge is available.

### Repo hygiene

- `temp/` untracked from main and added to `.gitignore`. The 28 generated sim-2026-05-03 files (REPORT, per-persona pages, scripts) are now local-only artifacts, not part of the repo.

## [0.4.11] - 2026-05-03

### Fixed (sim-2026-05-03 follow-ups)

- **`clear_artifact_folder` returns structured errors.** Missing args / unsafe id / non-absolute artifactsDir / path-escape now return `{ok: false, error_code, message, details}` instead of throwing a free-form string. Skills and MCP clients can branch on `error_code` (`MISSING_ARGS`, `UNSAFE_ID`, `NOT_ABSOLUTE`, `PATH_ESCAPE`). Successful runs return `{ok: true, existed, deleted, path}`.
- **NOT_ABSOLUTE check uses `path.isAbsolute`** instead of post-resolve startsWith — relative inputs were being silently coerced via cwd before; now they're rejected at the door.
- **task-extractor: borderline "Your input on …" emails default to skip** unless paired with a deadline, named deliverable, or urgency signal. Adds explicit skip rules for FYI / "looping you in" / "Cc'ing you" / sender-voice status updates / calendar invitations (handled by the calendar category).

### Added

- **Build-time skill validator** (`packages/plugin/scripts/validate-skills.mjs`). Runs as the last step of `pnpm build`. Scans every `SKILL.md` for `mcp_tools` allowlist blocks and fails the build if any entry doesn't match `mcp__<server>__<tool>`. Prevents a v0.4.8-style ship of an effectively-dead artifact.
- mcp-server unit test for the structured-error contract (`MISSING_ARGS` / `UNSAFE_ID` / `NOT_ABSOLUTE`). 8/8 pass.

## [0.4.10] - 2026-05-03

### Added

- **MCP server decoration per the 2025-11-25 spec.** The `serverInfo` returned in the `initialize` handshake now carries:
  - `title: "Cowork Tasks"` — human-readable display name
  - `description` — the same one-liner used in plugin.json
  - `websiteUrl` — link to the GitHub repo
  - `icons[]` — the plugin's `icon.png` embedded as a base64 `data:image/png` URI (256×256), so MCP clients that surface server icons can render the real logo without any external fetch.
- **Per-tool icons.** `tools/list` responses now attach the same plugin icon to all 16 tools. Forward-compatible with future MCP clients that show tool icons in command palettes.
- 2 new mcp-server unit tests verify `serverInfo.title/description/websiteUrl` and `icons[]` data-uri encoding.

### Changed

- `serverInfo` no longer hardcodes `version: "0.1.0"` in the constructor default; the bundled CLI passes the plugin version through.

### Verified

- Cowork's current Connectors panel does NOT yet read the new MCP icon fields for stdio plugins (the "C" letter badge remains until Cowork picks them up). This change is forward-compatible decoration; no UI regression.
- The directory submission path for becoming an "official" Cowork connector requires a remote HTTP/SSE MCP, not stdio. We're keeping the stdio plugin path; a hosted variant for the directory is tracked as future work.

## [0.4.9] - 2026-05-03

### Fixed

- **`mcp_tools` allowlist format.** Cowork rejects allowlist entries that don't match `mcp__<server>__<tool>`. v0.4.8 used `<server>:<tool>`, which Cowork dropped silently — `update_artifact` returned a warning ("must be of the form mcp**<server>**<tool>") and the artifact was published with no authorized tools. The artifact still rendered (because `__INITIAL_STATE__` was injected), but no `callMcpTool` from inside the artifact would have reached an MCP tool.
- **`callMcpTool` wire format.** The artifact now invokes `window.cowork.callMcpTool('mcp__cowork-tasks__list_tasks', args)` to match the canonical MCP wire format the allowlist uses.
- **Open-board skill** updated all 13 entries from `cowork-tasks:<tool>` to `mcp__cowork-tasks__<tool>` (both `create_artifact` and `update_artifact` calls).

### Tests

- Harness's `cowork.callMcpTool` shim accepts both wire formats so legacy + canonical paths are exercised.
- 82/82 e2e remain green.

## [0.4.8] - 2026-05-03

### Added

- **`window.cowork.*` host API** — the artifact now uses the documented Live Artifacts surface as primary: `callMcpTool(toolName, args)`, `askClaude(prompt, context?)`, `runScheduledTask(taskId)`. Tool names are passed in the `cowork-tasks:<tool>` form Cowork's allowlist expects.
- **`mcp_tools` allowlist declared at create_artifact** in the open-board skill. All 13 plugin tools (`list_tasks`, `get_task`, `get_tasks_bulk`, `create_task`, `create_tasks`, `update_task`, `move_task`, `archive_task`, `delete_task`, `list_config`, `update_config`, `is_processed`, `mark_processed`) are explicitly authorized so `callMcpTool` reaches them. Same allowlist re-passed on every `update_artifact` for safety.

### Changed

- `window.claude.*` is now the **fallback** surface, not primary. The artifact resolves a bridge with cowork preferred, claude as legacy backup. Both runtimes work without rebuild.
- **Removed redundant Refresh button** from the top bar — Cowork's artifact chrome already provides reload, per the host spec. Page reload re-runs `init()` and re-fetches via `callMcpTool`.
- `handleAddTask` now reconciles a locally-generated id with the server-assigned id: when `create_task` returns a different id, the placeholder is swapped in place. Prevents duplicate cards when both the local cache and the next poll diff reference the same task.

### Tests

- Test harness installs both `window.cowork` and `window.claude` so the new bridge selection logic is exercised end-to-end.
- New e2e: `no Refresh button is rendered (host owns reload)` + the existing reload test now goes through `page.reload()` instead of clicking the removed button.
- AI-button tests accept any of `askClaude` / `complete` / `sendToChat` event kinds.
- Full suite: 82/82 green (+1 over 81).

### Verified

- **Simulation + regression sweep (sim-2026-05-03).** 20 fictional
  personas (4 ICs, 4 managers, 2 execs, 4 specialists, 2 founders, 2 PMs,
  2 cross-functional) driven through a full Mon-Fri lifecycle: 6,255
  source items queued, 1,796 owner-first tasks created, skip-rate
  distribution 65.8%-76.4% (mean 71.3%), 98% owner-first accuracy on a
  50-task hand-graded sample. All 81 Playwright e2e + 15 storage + 5
  MCP-server unit tests passed at HEAD `56123e2`. Stress tests (220
  items × 5 high-volume personas, mergeWithCache integrity, ghost-id
  pruning, stale folder recovery via `clear_artifact_folder`,
  `getDataSource()` branch coverage) all green. No blocking issues; two
  low-severity follow-ups recommended. Full report:
  `temp/sim-2026-05-03/REPORT.md`.

## [0.4.7] - 2026-05-03

### Added

- **Phase F — drop placeholder line during drag.** A 2px terracotta accent line shows where a dragged card will land: above the hovered card, or at the top of an empty column. Subtle 1.4s opacity pulse, hidden in previewMode.
- **Phase D — add column / rename column.** Double-click a column header to rename in place (Enter commits, Esc cancels). A dashed "+ New column" pseudo-column at the right of the board opens an inline input that creates a column with a slugified id (collision-safe).
- **Phase E — group by source / owner / priority.** Top-bar dropdown changes how cards are bucketed:
  - **Status** (default) — current per-column behavior.
  - **Source** — one bucket per `source.type` (email, meeting, slack, jira, …).
  - **Owner** — one bucket per task owner; "No owner" bucket for unassigned.
  - **Priority** — fixed buckets Critical / High / Medium / Low / None.
  - Dragging in non-status modes mutates the relevant field instead of moving columns. `+ New column` and column rename are disabled when grouping by anything other than status.
- **e2e:** 9 new tests (5 column rename/add, 4 group-by). Total suite at 81/81 green.

### Changed

- `useConfig` now exposes `renameColumn(id, name)` and `addColumn(name)` mutators backed by `api.updateConfig`.
- `api.updateConfig(patch)` added — best-effort MCP write; local state is the source of truth in Cowork's iframe.

## [0.4.6] - 2026-05-03

### Added

- **Phase C — inline title edit on double-click.** Double-click any card title to rename in place. Enter commits, Escape cancels, blur saves. Drag listeners suspended while editing so the inline input is interactive.
- **Phase G — checklist + comments in the side panel.** Each task carries a checklist (toggle / edit / remove / progress count) and threaded comments (markdown body, author, timestamp). Both persist via `update_task`.
- **e2e coverage:** 4 inline title-edit tests added; full suite at 72/72 green.

### Changed

- Single-click on a card now defers panel-open by 220ms so a real double-click can pre-empt it. Tests that click + immediately interact with the side panel now wait for the panel to mount first.
- Storage merge no longer strips ids matching the dev-mock pattern (`^t\d+$`) from the seed - only from cache-only entries. Fixes a regression where test fixtures using `t1`–`t7` were dropped at boot.
- `storage.saveTasks` no longer filters ghost ids on write.

## [0.4.5] - 2026-05-02

### Added

- **Owner-first triage.** `task-extractor` agent rewritten as the user's coach. Hard-skips watch/FYI tasks, work owned by other people, status updates, dashboards, automated notifications.
- **`/coach-me` skill.** Reads the board, picks 2 tasks to start with, flags stuck items, calls out work that doesn't belong.
- **Storage v3 envelope** with `{snapshotVersion, tasks, locallyCreatedIds}` for the artifact's localStorage cache.
- **One-time ghost migration** strips dev-mock `t1`–`t9` ghost ids from existing v2 caches on first boot.
- **Storage unit tests** (15 covering merge, migration, ghost pruning, locally-created tracking).

### Changed

- `triage-now` skill source queries hard-filter to owner-only at the source layer (`assignee=currentUser`, owner-named action items in transcripts, DMs/@-mentions only).
- Plugin description reframes the product as "your personal task coach inside Claude Cowork".
- README adds "Why owner-first" section with concrete ✅/❌ examples + comparison table widened to ClickUp+Zapier and Trello.

## [0.4.4] - 2026-05-02

### Fixed

- **Ghost mock tasks in production.** The dev-mock IIFE in `<head>` was executing before the real `__INITIAL_STATE__` injection and installing both fake state AND a fake `window.claude.callTool` bridge - the artifact then ran in `mcp` mode polling the mock for 7 phantom tasks. Fix: inject state immediately after `<head>` so the mock guard sees it and returns early.

## [0.4.3] - 2026-05-02

### Added

- **GitHub Releases workflow** (`.github/workflows/release-on-tag.yml`). Push a `v*` tag → build → pack zip → attach to a GitHub Release with auto-generated notes.
- Marketplace manifest at `.claude-plugin/marketplace.json` so the repo can be added directly via `sabbah13/cowork-tasks` in Cowork.

## [0.4.2] - 2026-05-02

### Fixed

- **`/open-board` no longer has a failed step in any path.** Skill rewritten to call `clear_artifact_folder` proactively before `create_artifact` when the id is not in the manifest. Updates run in 4 calls, fresh creates in 5, all green.

## [0.4.1] - 2026-05-02

### Added

- **`clear_artifact_folder` MCP tool.** Removes a stale artifact folder when Cowork's UI deleted the manifest entry but left the directory on disk. Hard-guarded against path escapes.

### Fixed

- `check_version.outdated` no longer returns `true` when local version is `unknown`.

## [0.4.0] - 2026-05-02

### Changed

- **Palette switched from cream to native Cowork near-white.** Pixel-sample audit of the desktop chrome showed dominant bg = `#ffffff` (sidebar) / `~#f8f8f7` (pane), not the `#faf9f5` cream we were using. Token shifts in `styles.css`.

## [0.3.2] - 2026-05-02

### Fixed

- `/open-board` skill prescribes the canonical artifact id (`cowork-tasks`) and the explicit list-then-update-or-create flow. Eliminates the model thrash where it invented ids on stale-folder errors.

## [0.3.1] - 2026-05-02

### Fixed

- **Bundle slimmed from 3.6 MB to 612 KB** (gzip: 187 KB) by lazy-loading mermaid from CDN instead of inlining it.
- `prepare_board_artifact` omits the HTML body from the response when `outPath` is provided; the caller writes via path and `create_artifact` reads via `html_path`.

## [0.3.0] - 2026-05-02

### Added

- **Rich markdown rendering** in the side panel description: GFM tables, task lists, autolinked URLs, code blocks with syntax highlighting, mermaid diagrams (CDN-loaded), inline videos for `.mp4`/`.webm`, lazy images.

### Removed

- All personal data scrubbed from the repo and git history (via `git filter-repo`).

## [0.2.0] - 2026-05-02

### Added

- Public GitHub repo at `sabbah13/cowork-tasks` with the marketplace manifest. Skill cards show short titles via `name` field in YAML frontmatter.

## [0.1.1] - 2026-05-02

### Fixed

- **`/open-board` ENOENT bug.** The MCP server now derives its plugin-root from `import.meta.url` (the bundle's actual location), not from `CLAUDE_PLUGIN_ROOT` env (which Cowork doesn't expand in `env{}`).

## [0.1.0] - 2026-05-02

### Added

- **`@cowork-tasks/core`** — Zod task schema, file-based store with versioned change feed, chokidar-backed watcher, connector SDK (types, runtime, contract test harness). 14 unit tests passing.
- **`@cowork-tasks/mcp-server`** — MCP server exposing `list_tasks`, `create_task(s)`, `update_task` (with `ifVersion`), `move_task`, `archive_task`, `delete_task`, `get_task(_bulk)`, `list_config`, `update_config`, `is_processed`, `mark_processed`. SQLite-backed processed log. 4 unit tests + end-to-end smoke (`scripts/e2e-smoke.mjs`).
- **`@cowork-tasks/artifact`** — single inlined HTML React+Tailwind kanban dashboard (220 KB, 70 KB gzipped). Anthropic palette + Styrene/Tiempos fallbacks. Adaptive 2-second polling with `since: version` cursor, localStorage warm cache, dnd-kit drag/drop, side panel with `window.claude.complete()` and `sendToChat()` AI actions, light + dark mode.
- **`@cowork-tasks/plugin`** — Cowork plugin manifest (`.claude-plugin/plugin.json`), `.mcp.json`, five skills (`open-board`, `new-task`, `triage-now`, `setup`, `health`), `task-extractor` agent, `monitors.json` listing 12 connectors, `triage-runner.js` (batched LLM extraction with heuristic fallback), `health.js`.
- **Connectors v0.1** — Gmail (historyId cursor), Slack (mentions + DMs), Fathom (since cursor). All pass the contract test harness. Other connectors stubbed as "disabled: not yet implemented in v0.1".
- **`cowork-tasks-vscode`** — VSCode extension thin shell that embeds the same artifact bundle in a webview, keeps `Cmd+Shift+K` keybinding, shares `~/.cowork-tasks/` storage with Cowork.
- **`examples/connector-template/`** — copy-pasteable starter for community connectors.
- MIT license, contributor guide with "add a connector in 4 steps", GitHub issue templates (bug, feature, connector), CI workflow (Node 20 + 22), release-please.

### Architecture highlights

- Two-stage ingestion: cheap connector polling continuously queues raw items; one batched LLM call per `triageIntervalMinutes` (default 60) drains the queue. ~30× cheaper than per-arrival triage.
- Cursor-driven everywhere: Gmail historyId, Microsoft Graph deltaLink, Linear updatedAt, Fathom since=. No full re-scans.
- Versioned diff feed (MCP `list_tasks({since})`): unchanged poll = empty `{added:[], updated:[], removed:[]}`.
- Live artifact uses Cowork's native `window.claude.complete()` for AI actions instead of duplicating Claude inside the artifact.
