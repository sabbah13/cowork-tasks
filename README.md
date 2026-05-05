<div align="center">

<img src="docs/images/logo.svg" alt="Cowork Tasks" width="120" />

# Cowork Tasks

### The kanban that fills itself in.<br/><sub>Watches email, Slack, meetings, and issue trackers. Writes the cards. You drag Done.</sub>

[![License: MIT](https://img.shields.io/badge/license-MIT-c96342.svg)](LICENSE)
[![CI](https://github.com/sabbah13/cowork-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/sabbah13/cowork-tasks/actions)
[![npm](https://img.shields.io/npm/v/@cowork-tasks/mcp-server.svg?color=c96342)](https://www.npmjs.com/package/@cowork-tasks/mcp-server)
[![30x cheaper LLM](https://img.shields.io/badge/LLM_cost-30x_cheaper-6c8054.svg)](docs/architecture.md#performance-budget)
[![Stars](https://img.shields.io/github/stars/sabbah13/cowork-tasks?style=flat&color=c96342)](https://github.com/sabbah13/cowork-tasks/stargazers)

<a href="https://cowork-tasks.vercel.app" target="_blank">
<img src="docs/images/demo.gif" alt="Demo: a Gmail email arrives, a card appears on the kanban in 2 seconds, user drags it to Todo then opens the side panel and clicks Ask Claude actions" width="820" />
</a>

**[Try the live demo - no signup, no install](https://cowork-tasks.vercel.app)**

<sub>Drag cards, open the side panel, click <em>Ask Claude</em> actions. Seeded with real-looking data.</sub>

</div>

---

**Cowork Tasks** is a kanban board that watches your work happen and updates itself. Cards arrive from your email, Slack, meetings, Linear, and Jira automatically. Replies, status changes, and new deadlines move them around in the background. You drag the ones that matter to Done.

Built for developers, founders, and technical PMs who live in their inbox and hate retyping tasks into a second app.

**No API key needed. No tokens to paste.** Cowork Tasks reads from the connectors you've already authorized in **Cowork → Customize → Connectors**. The plugin pre-declares 25+ Cowork-native MCP servers (Gmail, Slack, Atlassian, Linear, Notion, Fathom, ...) so they appear in the Connectors panel ready to enable. **Local-first:** tasks live in `~/.cowork-tasks/` - not someone else's cloud.

Most task tools make you retype work into them. Cowork Tasks reads where the work already lives - your inbox, your Slack, your meeting transcripts.

Built on Anthropic's Live Artifacts (released April 2026). The first kanban board on this substrate.

## What gets captured

| What happens | What lands on your board |
|---|---|
| Email asking "can you review this by Fri?" | Card in **Inbox** with the email linked |
| Slack DM "could you handle X today?" | Card in **Inbox** with the permalink |
| Meeting transcript "Sam will draft the proposal" | Card in **Inbox** with the Fathom timestamp |
| Linear / Jira issue assigned to you | Card in **Inbox** with the issue link |
| A reply on the same email thread | Same card, updated |
| The issue moves to In Review | Same card, status updated |

The assistant keeps watching and updating in the background. Coach mode (`/coach-me`) reads your board and picks two to start with, flags what's stuck, calls out what to drop.

## Install

**Requirements:** Claude Cowork Desktop (any version) or Claude Code CLI. Node 18+ for local development. No other dependencies.

**In Claude Cowork (Desktop):**

1. Customize → Plugins → **Add marketplace**
2. Paste `sabbah13/cowork-tasks`, click **Sync**
3. Install **Cowork Tasks** from the marketplace

**In Claude Code (CLI):**

```bash
claude plugin marketplace add sabbah13/cowork-tasks && claude plugin install cowork-tasks
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

## Card detail + Ask Claude actions

<a href="https://cowork-tasks.vercel.app" target="_blank">
<img src="docs/images/screenshots/card-detail.png" alt="Card detail panel with email source, checklist, and Ask Claude actions: Summarize source, Tighten title, Draft reply, Split into subtasks" width="820" />
</a>

Click any card to open the side panel. Source link, priority, due date, checklist, comments, and four AI actions - **Summarize source**, **Tighten title**, **Draft reply**, **Split into subtasks**. Powered by your Cowork plan. No API key needed.

## Features

### Core

| | |
|---|---|
| **Always-on assistant** | Watches your communications and creates cards as work happens. Updates existing cards when replies, status changes, or new deadlines arrive. |
| **Coach mode** | `/coach-me` reads your board, picks 2 to start with, flags what's stuck, calls out what to drop. |
| **AI card actions** | Summarize source, tighten title, draft reply, split into subtasks - powered by your Cowork plan, no extra key. |
| **Local-first** | Tasks are JSON files in `~/.cowork-tasks/`. Yours. Offline-readable. No cloud dependency. |

### Technical

| | |
|---|---|
| **Cowork-native composition** | The plugin doesn't ship its own OAuth, polling daemons, or per-source binaries. It composes the Cowork-hosted MCP connectors you've already authorized in **Customize → Connectors**. One auth surface, shared with every other plugin. |
| **Batched LLM triage** | One LLM call per triage run, not per message. The `triage-now` skill pulls deltas from each enabled connector, hands them to the `task-extractor` agent in a single batch, then writes only the owner's own action items to the board. |
| **Live artifact UI** | Native Claude Cowork dashboard. Refreshes every 2 seconds. Unchanged state = empty diff = zero re-renders. |
| **MIT licensed** | Fork the artifact UI, extend the triage rules, contribute new skills. The plugin is a kanban + skills + agents layer over Cowork's connector graph - all of it is yours to remix. |

## Sources supported

Cowork Tasks reads from whatever Cowork-hosted MCP connectors you've enabled. The plugin pre-declares all of these so they appear in **Customize → Connectors** ready to authorize.

| Family | Cowork connectors used |
|---|---|
| Email | Gmail, Microsoft 365 (Outlook) |
| Calendar | Google Calendar, Microsoft 365 |
| Chat | Slack, Microsoft Teams (via MS365) |
| Issues / project trackers | Atlassian (Jira), Linear, Asana, monday.com, ClickUp, GitHub |
| Knowledge bases | Notion, Guru |
| Meeting recorders | Fathom, Fireflies, Granola, Gong |
| Customer support | Intercom |
| CRM | HubSpot, Close |
| Incidents / on-call | PagerDuty, Datadog |
| Files | Box, Egnyte |
| Signatures | DocuSign |
| Design | Figma, Canva |

The full list lives in [`packages/plugin/.mcp.json`](packages/plugin/.mcp.json). If Cowork ships an MCP for a source we haven't pre-declared yet, open an issue - it's a one-line addition. We do **not** maintain custom connectors in this repo.

## Architecture

```mermaid
flowchart TB
    subgraph Cowork["Claude Cowork (Desktop)"]
        Artifact["Live Artifact<br/>Kanban Dashboard<br/><i>polls every 2 s</i>"]
        Skills["Chat / Skills<br/>/open-board · /triage-now<br/>task-extractor agent"]
        Artifact <-->|JSON-RPC over stdio| Skills
    end

    MCP["MCP Server (Node)<br/>owns ~/.cowork-tasks/<br/><br/><i>list_tasks(since) → {version, diff}</i><br/><i>create_task · update_task · move_task</i><br/><i>prepare_board_artifact · check_version</i>"]

    Disk[("tasks/*.task.json<br/>config.json<br/>processed.db")]

    Connectors["Cowork-native MCP connectors<br/>(declared in .mcp.json)<br/><br/>Gmail · Google Calendar · MS365<br/>Slack<br/>Atlassian · Linear · Asana · monday · ClickUp · GitHub<br/>Notion · Guru<br/>Fathom · Fireflies · Granola · Gong<br/>Intercom · HubSpot · Close · PagerDuty · Datadog · ..."]

    Cowork ==> MCP
    MCP <==> Disk
    Cowork <-.triage-now skill calls each connector's tools.- Connectors

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

| | Cowork Tasks | Linear | Motion | Notion AI |
|---|---|---|---|---|
| **Tasks update themselves when reality changes** | ✓ | ✗ | ✗ | ✗ |
| Auto-capture from email | ✓ | ✗ | partial | ✗ |
| Auto-capture from meetings | ✓ | ✗ | ✗ | ✗ |
| Auto-capture from Slack | ✓ | partial | ✗ | ✗ |
| Coach mode (picks 2 to start, flags stuck, calls out drops) | ✓ | ✗ | ✗ | ✗ |
| Data on your machine | ✓ | ✗ | ✗ | ✗ |
| Open source | MIT | proprietary | proprietary | proprietary |
| **Cost** | **$0 + $0.30/mo LLM** | $8/user/mo | $34/mo | $10/user/mo |

## Roadmap

**Shipped:** Core MCP server, live artifact UI, `triage-now` / `coach-me` / `setup` / `health` skills, `task-extractor` owner-first agent, 25+ Cowork-native MCP connectors pre-declared.

**Upcoming:**
- [ ] Calendar awareness - auto-task from accepted invites (v0.5)
- [ ] Snooze-until-tomorrow card action (v0.5)
- [ ] Keyboard navigation polish (v0.5)
- [ ] Team mode: shared board across multiple Cowork users (v1.0)
- [ ] Custom views: list, calendar, timeline (v1.1)

PRs welcome - [good-first-issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue).

## Contributing

UI polish, triage rule improvements, MCP server features, and skill prompts are all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Quick links:

- [High-impact areas to work on](CONTRIBUTING.md#high-impact-areas)
- [Local dev setup](docs/local-install.md)
- [Architecture overview](docs/architecture.md)
- [Task schema reference](docs/task-schema.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)

> **Note on connectors:** Cowork Tasks does **not** ship its own connectors. It composes Cowork's native MCP connectors (declared in [`packages/plugin/.mcp.json`](packages/plugin/.mcp.json)). If you want a new source, the right path is for Cowork to ship the MCP - then it's a one-line addition here. We do not accept custom connector packages.

**Maintainer SLA:** PRs reviewed within 48 hours. Good-first-issue PRs are usually merged the same week.

*Used by the maintainer daily. Feedback and battle reports welcome in [Discussions](https://github.com/sabbah13/cowork-tasks/discussions).*

## Community

- [GitHub Discussions](https://github.com/sabbah13/cowork-tasks/discussions) - questions, showcases, connector wishlist
- [Issues](https://github.com/sabbah13/cowork-tasks/issues) - bugs and feature requests
- Discord - in progress, [upvote to prioritize](https://github.com/sabbah13/cowork-tasks/discussions)

[![Contributors](https://contrib.rocks/image?repo=sabbah13/cowork-tasks)](https://github.com/sabbah13/cowork-tasks/graphs/contributors)

## License

[MIT](LICENSE) - free to use, modify, and ship.
