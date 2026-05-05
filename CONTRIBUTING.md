# Contributing to Cowork Tasks

Thanks for considering a contribution. The fastest way to land something useful is to pick a [good first issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue) - each one is scoped to one or two files with clear acceptance criteria.

## Quick links

- **First-time contributor?** [good first issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue)
- **Maintainer SLA:** PRs reviewed within 48 hours. Good-first-issue PRs are usually merged the same week.
- **Community:** [GitHub Discussions](https://github.com/sabbah13/cowork-tasks/discussions) for questions, showcases, and ideas.

## How Cowork Tasks fits together

Cowork Tasks is a **composer**, not a connector. The plugin reads from Cowork's hosted MCP servers (Gmail, Slack, Atlassian, Linear, Notion, Fathom, ...) - declared in [`packages/plugin/.mcp.json`](packages/plugin/.mcp.json). Authentication, polling, rate limiting, and cursor management all live upstream in Cowork. The plugin's job is everything that happens **after** an item lands.

That means contributions cluster in four layers:

| Layer | What lives there | Examples |
|---|---|---|
| **Live artifact UI** | `packages/artifact/` - React + Tailwind + dnd-kit kanban | drag-drop polish, keyboard nav, empty states, hover previews |
| **MCP server / task store** | `packages/mcp-server/` and `packages/core/` - owns `~/.cowork-tasks/` | new MCP tools, indexing perf, schema migrations |
| **Skills + triage logic** | `packages/plugin/skills/` and `packages/plugin/agents/task-extractor.md` | better owner-detection, per-source filters, coaching prompts |
| **Docs & examples** | `docs/`, `README.md`, `SHOWCASE.md` | walkthroughs, architecture notes, real-use writeups |

## High-impact areas

Pick whichever matches your interests:

- **Artifact UX polish** - drop indicators during drag, empty-column states, hover previews of card descriptions, keyboard shortcuts to move cards across columns. See open issues with the `a11y` and `enhancement` labels.
- **Triage rules** - help the `task-extractor` agent skip more noise. Real examples of "this should not have become a task" are gold; open a PR adjusting the per-category rules in `packages/plugin/skills/triage-now/SKILL.md` or the agent prompt in `packages/plugin/agents/task-extractor.md`.
- **New MCP tools** - the artifact's "Ask Claude" actions, snooze-until-tomorrow, undo, and grouping all came from small additions to the MCP server. If there's a board action you want, the path is usually a new tool in `packages/mcp-server/src/server.ts` plus a button wired in `packages/artifact/src/`.
- **Documentation** - the "first 5 minutes" walkthrough, screenshots, real-use writeups in [SHOWCASE.md](SHOWCASE.md).

## What we do **not** accept

- **Custom connector packages.** Cowork Tasks composes Cowork's native MCP connectors. Adding a new `packages/connector-*` package is out of scope - the right place for new source support is Cowork's MCP catalog, after which we add a one-line entry to `packages/plugin/.mcp.json`. If you want a source Cowork doesn't yet ship an MCP for, the most useful thing is to request it upstream.
- **OAuth flows or token-paste UX.** Auth is Cowork's job. The plugin should never prompt for credentials.
- **Background polling daemons.** Triage runs on demand via `/cowork-tasks:triage-now` (or on a Cowork-managed cadence). We don't ship long-running shell processes.

## What happens after you open a PR

1. **CI runs automatically** - typecheck, lint, tests, and build on Node 20 and 22. Fix any failures before asking for review.
2. **Automated code review** - an AI reviewer analyzes your diff and posts a review comment covering correctness, style, and any issues. This typically appears within a few hours of opening the PR.
3. **Maintainer review** - the maintainer reads the AI review, tests the change in Claude Cowork, and either requests changes or approves and merges.

**SLA:** PRs reviewed within 48 hours. Good-first-issue PRs are typically merged the same week.

If you want feedback before the PR is polished, open it as a **draft** - the AI review still runs, and you can iterate before requesting a full maintainer review.

## Code style

- TypeScript, strict mode, no `any` unless commented why.
- ESLint + Prettier (run `pnpm lint`, `pnpm format`).
- One feature per PR. Keep diffs tight.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.

## Reporting bugs

Use the [bug template](.github/ISSUE_TEMPLATE/bug.yml). Include:

- Plugin version (`/cowork-tasks:health` shows it).
- Cowork version.
- Which Cowork connector was involved (if applicable - the connector itself is upstream of us, but the symptom may show up in our triage output).
- Logs from `~/.cowork-tasks/logs/cowork-tasks.log`.

## Code of conduct

Be kind. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
