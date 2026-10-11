# Architecture

Cowork Tasks is a **composer**, not a connector. It reads from the hosted connectors you've connected in **Customize > Connectors**, runs owner-first triage in batches, and writes a local kanban. Three cooperating layers, narrow contracts between them.

```mermaid
flowchart TB
    subgraph Cowork["Claude desktop app (Cowork)"]
        Artifact["Artifact<br/>(Kanban Dashboard)"]
        Chat["Chat / Skills<br/>/cowork-tasks:*<br/>task-extractor agent"]
    end

    MCP["Cowork Tasks MCP Server<br/>~/.cowork-tasks/<br/>(bundled with the plugin)"]
    Files[("tasks/*.task.json<br/>config.json<br/>processed.db")]

    subgraph Native["Hosted connectors (declared in .mcp.json)"]
        Gmail["gmail"]
        Slack["slack"]
        Atlassian["atlassian"]
        Linear["linear"]
        Fathom["fathom"]
        Others["...21 more"]
    end

    Artifact -- "list_tasks(since)<br/>2 s polling" --> MCP
    Chat -- "create_task / update / move<br/>is_processed / mark_processed" --> MCP
    Chat -- "triage-now skill calls<br/>each enabled connector's tools" --> Native
    MCP -- "writes" --> Files
    MCP -- "reads" --> Files

    style Artifact fill:#d97757,color:#fff
    style MCP fill:#3b82f6,color:#fff
    style Files fill:#e8e6dc,color:#141413
    style Native fill:#fbfbfa,stroke-dasharray:5 3,color:#141413
```

## Layers

### 1. Artifact

A persistent React HTML page, shown in the **Artifacts** view. Polls the MCP server every 2 s with a version cursor so unchanged steady state costs nothing. AI actions ("Summarize this email", "Draft a reply") currently build a prompt and copy it to the clipboard for you to paste into the conversation.

> **How the board reaches the task store.** The `open-board` skill has the server stamp the current tasks and the server's host name (`host:plugin_cowork-tasks_cowork-tasks`) into the plugin's pre-built page with `prepare_board_artifact`, then publishes that file as an artifact with the `mcp` capability. Inside the page, `await window.claude.use("mcp")` gives a namespace whose `callTool("host:...", tool, input)` runs the plugin's local server on the viewer's device, with a one-time consent. If that is unavailable (outside the Claude app, server not running, consent refused) the board falls back to a read-only snapshot and says so in a banner. The pre-2026-08-19 interface (`cowork.create_artifact` with `mcp_tools`, `window.cowork.*`) remains as a legacy path. In-board AI actions still copy a prompt; moving them to the `sample` capability is tracked in [audit-2026-10.md](audit-2026-10.md).

### 2. Cowork Tasks MCP server (bundled)

Owns `~/.cowork-tasks/` (the storage root). Exposes CRUD over tasks via JSON-RPC, plus a versioned change feed. Tasks live as one JSON file per task (grep-friendly, git-friendly), with an in-memory index and a coalesced `index.json` snapshot for fast cold-start. This is the **only** MCP server the plugin ships - bundled in `packages/plugin/bundle/mcp-server.js`.

### 3. Hosted connectors (upstream)

The plugin's `packages/plugin/.mcp.json` declares 26 hosted connectors (`gmail`, `slack`, `atlassian`, `linear`, `notion`, `fathom`, `fireflies`, `granola`, `intercom`, `hubspot`, ...). They are listed on the plugin's **Connectors** tab (Customize > Plugins > Cowork Tasks), where the user adds and connects each one; installing the plugin does not connect anything. The plugin does **not** run OAuth, store tokens, or maintain delta cursors - all of that lives in Claude's hosted infrastructure, shared with every other plugin.

When `triage-now` runs:

1. The skill iterates over enabled connectors and calls each one's MCP tools (`gmail.search_threads`, `slack.search_messages`, `atlassian.search_jira_issues`, etc.) with owner-focused filters.
2. For each result, it checks `cowork-tasks:is_processed` to skip items already triaged.
3. The surviving items go to the `task-extractor` agent in **one** batched call.
4. Surviving owner-action items are written via `cowork-tasks:create_tasks`; everything else is `mark_processed` and dropped.

## Why these boundaries

- **Artifact ↔ MCP** is the only synchronous chatter. Everything else runs on demand from chat skills.
- **The plugin doesn't authenticate sources.** Cowork does. One auth surface, shared across every plugin in the user's account.
- **Triage doesn't know which source it came from.** It receives a normalized `SourceItem` with `connector` + `category` and emits `Task` drafts. Adding a new connector entry to `.mcp.json` requires no triage code change.
- **MCP doesn't know about LLMs.** It's a typed, versioned task store with a `processed` ledger.

Each boundary is a place we can swap an implementation without touching the others.

## Storage

```
~/.cowork-tasks/
├─ tasks/                  # one JSON per task
│  ├─ email_review_q3_20260501.task.json
│  └─ meeting_action_kickoff_20260501.task.json
├─ archived/               # soft-deleted tasks (timestamped, restore_task)
├─ config.json             # columns, labels, owners, triage cadence
├─ processed.db            # SQLite: (connector, sourceHash) → taskId
├─ feedback.db             # SQLite: dismissed-task examples for extractor learning
├─ wal.log                 # write-ahead log for MCP version recovery
├─ index.json              # coalesced snapshot for fast cold-start
└─ logs/cowork-tasks.log
```

Notably absent: no `credentials/`, no `cursors/`, no `triage-queue/`. Auth + delta cursors live in Cowork's hosted MCP servers; triage runs synchronously in the chat session against fresh source queries.

## Performance budget

| Layer | Idle bytes/min | Active path |
|---|---|---|
| Connector calls | 0 (skill only fires on demand) | depends on source - usually <500 ms per connector at the MCP edge |
| MCP `list_tasks({since: version})` | <100 B | <1 ms |
| Artifact poll cycle | 1 fetch, 0 React renders | <1 ms |
| Triage runner | 0 (asleep) | 1 batched LLM call per `/triage-now`, ~5K input tokens for a typical day |

Net: a quiet desktop costs near-zero CPU and zero LLM tokens. Triage runs on demand (or on the cadence the user picks); each run is one LLM call regardless of how many items came in.
