# Roadmap

Live document. The order changes based on what people ask for in [GitHub Discussions](https://github.com/sabbah13/cowork-tasks/discussions).

---

## v0.4.x (now)

- [x] Core MCP server + versioned task store
- [x] Live artifact dashboard (React + Tailwind + dnd-kit)
- [x] 26 Cowork-native MCP connectors pre-declared in `.mcp.json` (Gmail, Slack, Atlassian, Linear, Notion, Fathom, Fireflies, Granola, Intercom, HubSpot, ...)
- [x] Owner-first `task-extractor` agent (skips work owned by others, FYI items, status feeds)
- [x] `triage-now` / `coach` / `setup` / `health` skills
- [x] VSCode extension (Cmd+Shift+K)
- [x] E2E test suite (Playwright)
- [x] Plugin marketplace manifest

## v0.5 (target: T+30 days post-launch)

- [ ] Calendar awareness - auto-task from accepted invites whose description has a prep ask
- [ ] Snooze-until-tomorrow card action
- [ ] Empty-column states + drop placeholder polish
- [ ] Keyboard navigation: move cards across columns with arrow keys
- [ ] Triage rule tightening: more "borderline phrasings" added to the skip list based on real misses
- [ ] Per-user feedback corpus - learn from dismissed cards

## v0.6 (target: T+60 days)

- [ ] Group-by Source column hover previews
- [ ] Inline checklist progress display on cards
- [ ] Configurable triage cadence (manual / hourly / daily)
- [ ] Standalone CLI mode (run the kanban without Cowork, manual task entry only)

## v1.0 (target: T+120 days)

- [ ] Team mode - shared board across multiple Cowork users
- [ ] Custom views: list, calendar, timeline
- [ ] Plugin SDK + plugin store inside Cowork Tasks (custom card actions, custom triage rules)
- [ ] Offline-friendly mobile companion (read-only at first)

---

## Source coverage is upstream

We do **not** ship custom connectors. Source coverage grows when Cowork adds an MCP server to its catalog, at which point we add a one-line entry to `packages/plugin/.mcp.json`. If a source you need isn't pre-declared:

1. Check whether Cowork has an MCP for it (search the Cowork Connectors panel).
2. If yes, open a PR adding it to `.mcp.json` - this is a one-line good-first-issue.
3. If no, request it upstream from Anthropic / Cowork. Auth and rate-limiting belong there, not here.

## Vetting new ideas

Bigger feature ideas live in [Discussions / Ideas](https://github.com/sabbah13/cowork-tasks/discussions). The ones with the most thumbs-ups bubble up onto this list at each milestone.

If something here looks wrong - too late, too early, missing - say so in [Discussions / Ideas](https://github.com/sabbah13/cowork-tasks/discussions). We update the roadmap monthly.
