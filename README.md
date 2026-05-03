<div align="center">

<img src="docs/images/logo.svg" alt="Cowork Tasks" width="120" />

# Cowork Tasks

### A live kanban board for Claude Cowork.<br/>Your email, meetings, and Slack become tasks - automatically.

[![License: MIT](https://img.shields.io/badge/license-MIT-c96342.svg)](LICENSE)
[![Claude Cowork plugin](https://img.shields.io/badge/Claude_Cowork-plugin-1a1a18.svg)](https://github.com/sabbah13/cowork-tasks)
[![Local-first](https://img.shields.io/badge/local--first-yes-6c8054.svg)](#)

</div>

---

**Cowork Tasks** is a Claude Cowork plugin that acts as your personal task coach. It watches your email, meetings, Slack, and issue trackers and surfaces only **your own** action items - the things you specifically committed to, were asked to do, or were assigned. Then it helps you prioritize, unblock, and finish them.

It's local-first, MIT-licensed, and uses Claude Cowork's native live artifacts as its UI - so the board feels like part of Claude itself.

## Why owner-first

Most task tools become a status feed: every meeting note, every Slack ping, every issue your team touches lands as a card. After a week the board is unusable.

Cowork Tasks does the opposite. The bar is **"will this not happen unless I do it?"**

- ❌ "Watch the launch on Monday" - skip. The launch will happen without you watching it.
- ❌ "Track Q3 metrics rollout" - skip. That's a dashboard, not a task.
- ❌ "Maya is shipping the redesign" - skip. Maya owns it.
- ✅ "Reply to Jamie about pricing by Fri" - keep. Won't happen unless you do it.
- ✅ "Review David's PR before standup" - keep. You're the reviewer.
- ✅ "Decide on vendor by Wed" - keep. The decision is yours.

The result: a board that's small, current, and entirely about you.

## Install

**In Claude Cowork (Desktop):**

1. Customize → Plugins → **Add marketplace**
2. Paste `sabbah13/cowork-tasks`, click **Sync**
3. Install **Cowork Tasks** from the marketplace

**In Claude Code (CLI):**

```bash
claude plugin marketplace add sabbah13/cowork-tasks
claude plugin install cowork-tasks
```

Then run `/open-board` and your kanban opens in the Live Artifacts tab.

## Quickstart

```text
/setup        — connect your sources (Gmail, Slack, Fathom, ...)
/open-board   — open the live kanban
/triage-now   — pull your latest action items from connected sources
/new-task     — capture a thought from chat as an action item
/coach-me     — ask the coach what to start with, what's stuck, what to drop
/health       — connector + board status
```

## Features

| | |
|---|---|
| **Owner-first triage** | Aggressive skip rules: watch-tasks, FYI items, work owned by others - none of them touch your board |
| **Coach mode** | `/coach-me` reads your board, picks 2 to start with, flags what's stuck, calls out what to drop |
| **Live artifact UI** | Native Claude Cowork dashboard, refreshes in 2 s |
| **Auto-ingest** | Email, meetings, chat, issue trackers - 20+ sources |
| **Local-first** | Tasks live as JSON files in `~/.cowork-tasks/`, not someone else's cloud |
| **Cursor-driven** | Every connector uses native delta APIs (Gmail historyId, Graph deltaLink, Linear updatedAt). No full re-scans, ever. |
| **Batched LLM triage** | Default cadence: 1 hour. Cuts token spend ~30x vs per-arrival. |
| **Source links** | Every card links back to the email / Slack permalink / Fathom timestamp |
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

```mermaid
flowchart TB
    subgraph Cowork["Claude Cowork (Desktop)"]
        Artifact["Live Artifact<br/>Kanban Dashboard<br/><i>polls every 2 s</i>"]
        Skills["Chat / Skills<br/>/open-board · /triage-now<br/>task-extractor agent"]
        Artifact <-->|JSON-RPC over stdio| Skills
    end

    MCP["MCP Server (Node)<br/>owns ~/.cowork-tasks/<br/><br/><i>list_tasks(since) → {version, diff}</i><br/><i>create_task · update_task · move_task</i><br/><i>prepare_board_artifact · check_version</i>"]

    Disk[("tasks/*.task.json<br/>config.json<br/>processed.db")]

    Connectors["Cowork Connectors<br/><br/>Gmail · Outlook · IMAP<br/>Slack · Teams · Discord<br/>Fathom · Otter · Fireflies · Granola<br/>Linear · Jira · Asana · Notion · ClickUp"]

    Cowork ==> MCP
    MCP <==> Disk
    MCP <-.reads new items.- Connectors

    classDef cowork fill:#fbfbfa,stroke:#1a1a18,stroke-width:1.5px,color:#1a1a18;
    classDef accent fill:#f6e5dd,stroke:#c96342,stroke-width:1.5px,color:#1a1a18;
    classDef disk fill:#eeedec,stroke:#56554f,stroke-width:1px,color:#1a1a18;
    classDef ext fill:#fbfbfa,stroke:#56554f,stroke-width:1px,stroke-dasharray:5 3,color:#1a1a18;

    class Artifact,Skills cowork;
    class MCP accent;
    class Disk disk;
    class Connectors ext;
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

PRs welcome - [good-first-issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue).

## Contributing

We love connectors. See [CONTRIBUTING.md](CONTRIBUTING.md). Quick links:

- [Add a connector in 4 steps](CONTRIBUTING.md#adding-a-connector)
- [Architecture overview](docs/architecture.md)
- [Task schema reference](docs/task-schema.md)

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=sabbah13/cowork-tasks&type=Date)](https://star-history.com/#sabbah13/cowork-tasks&Date)

## License

[MIT](LICENSE) - free to use, modify, and ship.
