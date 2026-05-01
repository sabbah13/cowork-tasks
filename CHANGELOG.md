# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
