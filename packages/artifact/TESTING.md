# Cowork Tasks artifact - testing

## Run the suite

```bash
cd packages/artifact
pnpm build           # the suite tests the built single-file artifact
pnpm test:e2e        # runs all 27 tests in headless Chromium (~15 s)
pnpm test:e2e:ui     # opens the Playwright UI for live debugging
pnpm test:e2e:report # opens the HTML report from the last run
```

Artifacts (screenshots + videos) land in `test/e2e/.results/`.

## What the harness does

The suite simulates Cowork's iframe runtime end-to-end without any real
Cowork process:

- A tiny static server (`test/e2e/server.mjs`) serves the built artifact at
  `/artifact.html`.
- Each test uses `page.addInitScript` to seed:
  - `window.__INITIAL_STATE__` - the snapshot the `open-board` skill bakes
    in when it creates the live artifact.
  - `window.claude` - a stateful mock matching the production MCP server's
    behavior (versioned diffs, tombstones, optimistic mutations).
- Three bridge modes mirror what we actually see in Cowork:
  - `bridge=ok` - normal Cowork (default).
  - `bridge=fail` - `callTool` throws (the "snapshot mode" path).
  - `bridge=missing` - `window.claude` undefined (worst-case sandboxed
    iframe).

## Coverage checklist

### First paint

- [x] Renders 7 seeded tasks in the right columns.
- [x] Shows empty state + "Connect a source" CTA when no tasks.
- [x] Renders the seeded snapshot when `window.claude` is missing entirely.
- [x] Shows the snapshot on initial paint when `callTool` throws 400.

### Filtering & search

- [x] Search narrows visible cards by title.
- [x] Search matches description text.
- [x] Search is case-insensitive.
- [x] Search with no matches shows zero cards.

### Side panel

- [x] Clicking a card opens the panel with title, description, and AI
      buttons (Summarize / Tighten / Draft reply / Split into subtasks).
- [x] Inline AI buttons route through `window.claude` (complete or
      sendToChat).
- [x] Editing the title commits `update_task` on blur.
- [x] Editing the description commits `update_task` on blur.
- [x] Archive removes the card from the board.
- [x] Delete removes the card from the board.
- [x] "Open in <source>" link is `target=_blank` and points at the source
      URL.
- [x] Close (X) dismisses the panel without modifying state.

### Drag and drop

- [x] Moving a card from Inbox to To Do updates both column counts.
- [ ] Same-column reorder (skipped - product limitation: App.tsx onDragEnd
      short-circuits when source.column === target.column. Implementing
      this requires per-card drop targets via @dnd-kit/sortable.)

### Top bar

- [x] Refresh button triggers `list_tasks`.
- [x] "Triage now" button hands off to chat.

### Visual polish

- [x] Priority and label badges render.
- [x] Owner avatar shows initials.
- [x] Dark-mode snapshot picks up `prefers-color-scheme: dark`.

### Accessibility

- [x] Search input has the right type.
- [x] Column headers are real `<h2>`s.
- [x] Tab focus reaches interactive controls.

### Snapshots (manual review)

- [x] Full board screenshot for visual review (`.results/00-full-board.png`).
- [x] Empty state (`.results/02-empty-state.png`).
- [x] Side panel open (`.results/03-side-panel.png`).
- [x] After drag (`.results/04-after-drag.png`).
- [x] Dark mode (`.results/05-dark-mode.png`).

## Known issues found while writing the suite

These were caught and fixed:

| # | Issue | Fix |
|---|---|---|
| 1 | `<article role="article">` was being overridden by dnd-kit's `role="button"`, breaking `getByRole('article')`. | Added `data-testid="task-card"` + `data-task-id` + `data-column` to TaskCard. Tests use those. |
| 2 | The artifact's `window.claude.callTool` path doesn't actually exist in Cowork - the live artifact iframe has no MCP bridge. | Added `__INITIAL_STATE__` snapshot injection at create-time (in the open-board skill) and File System Access API as the live data source. |
| 3 | Schema rejected `source: "<url>"` - forced agents to know the exact object shape. | New `SourceInputSchema` accepts a string OR a partial/full object. |
| 4 | `source.title` was silently dropped because the strict Zod schema didn't allow extra keys. | Added `.passthrough()` plus a `title` field. |

Still open:

| # | Issue | Severity |
|---|---|---|
| 1 | Same-column reorder is a no-op. | low (product gap, documented) |
| 2 | After archive, no toast/feedback - card just disappears 1-2 polls later. | low (UX) |
| 3 | The Refresh button doesn't show a spinning state while the call is in flight. | low (polish) |
| 4 | If `__INITIAL_STATE__` is large (>20 MB after stringify), the open-board skill may exceed Cowork's HTML size cap. We don't gate this. | medium (won't matter at typical task volumes) |

## How the production runtime is mirrored

| Production | Mock |
|---|---|
| `cowork-tasks` MCP server (Node, stdio, Zod-validated) | In-page stateful object that mutates `state.tasks`/`state.tombstones` |
| `window.claude.callTool(server, tool, args)` | Closure over the mock state, same call signature |
| `window.claude.sendToChat(prompt)` | Records into `window.__claudeCalls` |
| `window.claude.complete(prompt)` | Returns `[mock] <prompt prefix>` |
| Versioned diff (`{version, added, updated, removed}`) | Maintains per-task version + tombstone map |
| File System Access API for live polling | Headless Chromium has `showDirectoryPicker`; not exercised by current tests but available for future |

## Adding a test

1. Pick a section in `board.spec.ts` (or add a new `test.describe`).
2. Use `gotoBoard(page, { fixture, bridge })` to set up the iframe state.
3. Drive the UI with regular Playwright locators (`getByTestId`,
   `getByRole`, `getByPlaceholder`).
4. For mutations, assert the resulting card count or fetch
   `window.__claudeCalls` to verify the right MCP tool was invoked.
5. Drop a screenshot at a meaningful step:
   ```ts
   await page.screenshot({ path: 'test/e2e/.results/<n>-<name>.png', fullPage: true });
   ```
