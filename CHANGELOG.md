# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
