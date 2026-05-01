<div align="center">

<img src="docs/images/logo.svg" alt="Cowork Tasks" width="120" />

# Cowork Tasks

### A live kanban board for Claude Cowork.<br/>Your email, meetings, and Slack become tasks - automatically.

[![CI](https://github.com/cowork-tasks/cowork-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/cowork-tasks/cowork-tasks/actions)
[![npm](https://img.shields.io/npm/v/@cowork-tasks/mcp-server.svg)](https://www.npmjs.com/package/@cowork-tasks/mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/0000?label=Discord&logo=discord)](https://discord.gg/cowork-tasks)
[![Twitter Follow](https://img.shields.io/twitter/follow/coworktasks?style=social)](https://twitter.com/coworktasks)

<img src="docs/images/hero.gif" alt="Cowork Tasks demo" width="800" />

</div>

---

**Cowork Tasks** is a Claude Cowork plugin that gives you a real-time kanban board, fed automatically by everything happening around you - email, meetings, Slack, Jira. New work shows up as a card. You drag it to Done.

It's local-first, MIT-licensed, and uses Claude Cowork's native live artifacts as its UI - so the board feels like part of Claude itself.

## Why

- **Tasks slip through cracks.** A Slack message from your boss, a "let's do X" in a meeting, an email asking for a doc review - half of them never make it into your task list.
- **Manual capture is a tax.** You shouldn't have to retype what's already in your inbox.
- **You stay in control.** Auto-captured tasks land in **Inbox** for you to triage, never auto-promoted.

## Install

```bash
claude plugin install cowork-tasks/cowork-tasks
```

That's it. Open Claude Cowork, switch to the Live artifacts tab, and your board is there.

## Quickstart

```bash
# 1. Install the plugin
claude plugin install cowork-tasks/cowork-tasks

# 2. Connect your sources (Gmail, Slack, Fathom, etc.)
/cowork-tasks:setup

# 3. Open the board
/cowork-tasks:open-board

# 4. Trigger triage on demand (otherwise runs hourly)
/cowork-tasks:triage-now

# 5. See the health of your connectors anytime
/cowork-tasks:health
```

## Features

| | |
|---|---|
| **Live artifact UI** | Native Claude Cowork dashboard, refreshes in 2 s |
| **Auto-ingest** | Email, meetings, chat, issue trackers - 20+ sources |
| **Local-first** | Tasks live as JSON files in `~/.cowork-tasks/`, not someone else's cloud |
| **Cursor-driven** | Every connector uses native delta APIs (Gmail historyId, Graph deltaLink, Linear updatedAt). No full re-scans, ever. |
| **Batched LLM triage** | Default cadence: 1 hour. Cuts token spend ~30x vs per-arrival. |
| **Source links** | Every card links back to the email / Slack permalink / Fathom timestamp |
| **VSCode bonus** | Same board inside VSCode (`Cmd+Shift+K`) via the bundled extension |
| **MIT, open-source** | Build connectors in 50 lines of TypeScript |

## Sources supported

| Family | Connectors |
|---|---|
| Email | Gmail, Outlook / Microsoft 365, IMAP (Fastmail, ProtonMail, iCloud, ...) |
| Meetings / note-takers | Fathom, Otter.ai, Fireflies.ai, Granola, Read.ai, Tactiq, Sembly, Avoma, Zoom AI Companion, Microsoft Teams, Google Meet (Gemini) |
| Chat | Slack, Microsoft Teams, Discord, Telegram |
| Issues / project trackers | Jira, Linear, Asana, ClickUp, Notion, Monday, Trello, GitHub Issues, GitLab Issues, YouTrack |

Don't see yours? **[Add a connector in 50 lines](CONTRIBUTING.md#adding-a-connector).**

## How it works

```
+--------------------------------------------------------------+
|                     Claude Cowork (Desktop)                  |
|                                                              |
|   +-------------------------+   +------------------------+   |
|   |  Live Artifact          |   |  Chat / Skills         |   |
|   |  (Kanban Dashboard)     |   |  /cowork-tasks:triage  |   |
|   |  - polls every 2 s      |<->|  task-extractor agent  |   |
|   +-----------+-------------+   +-----------+------------+   |
|               | JSON-RPC over stdio          |               |
+---------------+------------------------------+---------------+
                |                              |
        +-------v------------------------------v-------+
        |  MCP Server (Node) - owns ~/.cowork-tasks/   |
        |  list_tasks(since) -> {version, diff}        |
        |  create_task / update_task / move_task       |
        +-------+--------------------------+-----------+
                |                          |
                v                          v
        +---------------+        +------------------------+
        | tasks/        |        | Connector monitors     |
        |  *.task.json  |<-------| (Gmail, Slack, Fathom, |
        | config.json   |        |  Linear, ...)          |
        +---------------+        +------------------------+
```

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## Comparison

| | Cowork Tasks | Linear / Asana | Todoist |
|---|---|---|---|
| Auto-capture from email | yes | no | no |
| Auto-capture from meetings | yes | no | no |
| Auto-capture from Slack | yes | partial | no |
| Local-first (your files) | yes | no | no |
| Open-source | MIT | no | no |
| Native to Claude / AI | yes | no | no |

## Roadmap

- [x] Core MCP server + live artifact
- [x] Gmail, Slack, Fathom connectors
- [ ] Outlook, Otter, Granola connectors (v0.2)
- [ ] Linear, Jira, Notion connectors (v0.3)
- [ ] Calendar awareness (auto-task from accepted invites) (v0.4)
- [ ] Team mode: shared board across multiple Cowork users (v1.0)
- [ ] Custom views: list, calendar, timeline (v1.1)

PRs welcome - [good-first-issue](https://github.com/cowork-tasks/cowork-tasks/labels/good%20first%20issue).

## Contributing

We love connectors. See [CONTRIBUTING.md](CONTRIBUTING.md). Quick links:

- [Add a connector in 4 steps](CONTRIBUTING.md#adding-a-connector)
- [Architecture overview](docs/architecture.md)
- [Task schema reference](docs/task-schema.md)

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=cowork-tasks/cowork-tasks&type=Date)](https://star-history.com/#cowork-tasks/cowork-tasks&Date)

## License

[MIT](LICENSE) - free to use, modify, and ship.
