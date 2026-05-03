# Security Policy

## Supported versions

We support the latest minor release on the `main` branch. Older versions receive fixes only when a critical issue is reported and the user cannot upgrade.

| Version | Supported |
|---------|-----------|
| 0.4.x   | yes       |
| < 0.4   | no        |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email the maintainer at: `security@cowork-tasks.dev` (or DM the maintainer on the project's X / Twitter handle).

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

- The MCP server (`packages/mcp-server`)
- Connectors (`packages/connector-*`)
- The artifact runtime (`packages/artifact`)
- The plugin manifest and skills

Out of scope:

- Vulnerabilities in third-party APIs (Gmail, Slack, etc.)
- Issues in Claude Cowork itself - report to Anthropic
- Issues in dependencies - report upstream first; we'll bump after they fix

## What we read and where it lives

- Source data is fetched only from APIs you authorize via Cowork's Connectors panel
- Raw items live in `~/.cowork-tasks/triage-queue/` until triage runs
- Tasks live as JSON files in `~/.cowork-tasks/tasks/`
- Credentials are stored encrypted under `~/.cowork-tasks/credentials/`
- The hourly triage call to Claude is the only third-party network call we make on your behalf
