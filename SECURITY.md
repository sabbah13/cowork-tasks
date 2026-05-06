# Security Policy

## Supported versions

We support the latest minor release on the `main` branch. Older versions receive fixes only when a critical issue is reported and the user cannot upgrade.

| Version | Supported |
|---------|-----------|
| 0.4.x   | yes       |
| < 0.4   | no        |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Use GitHub's [private vulnerability reporting](https://github.com/sabbah13/cowork-tasks/security/advisories/new) (preferred), or DM the maintainer at https://x.com/sabbah13.

Include:

- A description of the issue and the impact
- Steps to reproduce
- Affected version (`/cowork-tasks:health` reports it)
- Whether you'd like credit in the disclosure

We will:

- Acknowledge within 72 hours
- Provide a fix or mitigation timeline within 7 days
- Credit you in the release notes (unless you prefer otherwise)

## Scope

In scope:

- The Cowork Tasks MCP server (`packages/mcp-server`) and its bundled build at `packages/plugin/bundle/mcp-server.js`
- The artifact runtime (`packages/artifact`)
- The plugin manifest, skills, and agents (`packages/plugin/`)
- The VSCode extension (`packages/vscode-ext`)

Out of scope:

- Vulnerabilities in third-party APIs (Gmail, Slack, etc.) - report to the vendor
- Vulnerabilities in **Cowork-hosted MCP connectors** declared in `packages/plugin/.mcp.json` (e.g. `mcp.slack.com/mcp`, `microsoft365.mcp.claude.com/mcp`) - report to Anthropic / Cowork. Auth, polling, rate-limiting, and token storage all live upstream
- Issues in Claude Cowork itself - report to Anthropic
- Issues in dependencies - report upstream first; we'll bump after they fix

## What we read and where it lives

- The plugin reads from Cowork-hosted MCP servers you've authorized in **Customize → Connectors**. The Cowork Tasks plugin itself never sees your source tokens or makes direct calls to Gmail / Slack / Atlassian / etc.
- Tasks live as JSON files in `~/.cowork-tasks/tasks/` (one file per task). Soft-deleted tasks move to `~/.cowork-tasks/archived/`.
- The dedup ledger (`processed.db`) and feedback log (`feedback.db`) are local SQLite files.
- Triage runs **on demand** via `/cowork-tasks:triage-now` (or whatever cadence Cowork's harness invokes). Each run is a single batched LLM call against the Claude session that's already active in the user's Cowork tab — no separate API key, no background daemon.

Notably absent from the disk layout: no `credentials/`, no `cursors/`, no `triage-queue/`. Those concerns live upstream in Cowork's hosted MCP infrastructure, shared with every other plugin in the user's account.
