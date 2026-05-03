# Phase 4 — Stress + edges

Generated 2026-05-03T10:04:36.543Z

## 1. Volume stress (200+ items × 5 personas)

| Persona | Total items | Kept | Skipped | Latency (ms) | JSON errors |
|---|---|---|---|---|---|
| Olamide F. (`olamide-f`) | 220 | 74 | 146 | 1 | 0 |
| Haruto I. (`haruto-i`) | 220 | 74 | 146 | 1 | 0 |
| Ananya V. (`ananya-v`) | 220 | 74 | 146 | 1 | 0 |
| Elif D. (`elif-d`) | 220 | 74 | 146 | 0 | 0 |
| Selene K. (`selene-k`) | 220 | 74 | 146 | 0 | 0 |

Total items processed: **1100** in **3 ms** (avg **0.003 ms/item**).

Result: extractor output remained well-formed JSON. No parse errors.

## 2-3. mergeWithCache integrity + ghost-id pruning

vitest result: **PASS**

```

 RUN  v1.6.1 /Users/sabbah/Documents/Projects/cowork-tasks/packages/artifact

 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > drops cached ghost ids that match the dev-mock pattern
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > keeps locally-created ids even if not in seed
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > drops cached ids not in seed and not locally created (ghost)
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > keeps cache-only ids when cache is at least as fresh as seed
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > newer cached updated time wins for ids in both
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > tombstoned ids are dropped from both seed and cache
 ✓ src/__tests__/storage.test.ts > mergeWithCache (snapshot-tagged) > archived (status != active) tasks are filtered out
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > returns empty cache when nothing is stored
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > saveTasks + loadCache round-trips
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > preserves ids on load - ghost pruning happens during merge
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > mergeWithCache keeps t-prefixed ids when the seed includes them
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > markLocallyCreated tracks new ids
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > unmarkLocallyCreated removes ids
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > migrates v2 keys, dropping ghost ids
 ✓ src/__tests__/storage.test.ts > storage v3 envelope > clear() wipes both v3 envelope and any leftover legacy keys

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  03:03:13
   Duration  164ms (transform 18ms, setup 0ms, collect 18ms, tests 2ms, environment 0ms, prepare 28ms)


```

## 4. Stale folder recovery

First attempt issued the call without `artifactsDir`/`id`, which the server
rightly rejects (defensive parameter check). Re-ran via
`scripts/phase4-stale-fix.mjs` with proper args:

- Tool present in MCP server: **yes** (`clear_artifact_folder`,
  declared in `packages/mcp-server/src/server.ts:129`)
- Stale dir existed before: **true**
- Stale dir exists after: **false**
- Outcome: **PASS**

Server response:
```json
{"existed": true, "deleted": true,
 "path": ".../temp/sim-2026-05-03/fake-artifacts/cowork-tasks"}
```

The tool also enforces three safety guards (see server.ts:513-525):
the `id` must match `^[a-z0-9][a-z0-9_-]{0,63}$`, the resolved target must
be a child of `artifactsDir`, and `artifactsDir` must be absolute. Manual
sanity check of all three guards passed.

## 5. getDataSource() branch coverage

| Case | Condition | Expected | Present in code |
|---|---|---|---|
| fs branch when FSA connected | `fs.isConnected() === true` | 'fs' | yes |
| mcp branch when callTool exposed and bridge healthy | `typeof window.claude?.callTool === 'function' && bridgeHealthy` | 'mcp' | yes |
| snapshot fallback when neither | `neither` | 'snapshot' | yes |

All three branches present in source: **yes**.

## 6. Final regression e2e (Playwright)

Result: **PASS**

```
[1A[2K[52/81] [chromium] › test/e2e/board.spec.ts:257:3 › visual › priority + label badges render
[1A[2K[53/81] [chromium] › test/e2e/board.spec.ts:263:3 › visual › owner avatar shows initials
[1A[2K[54/81] [chromium] › test/e2e/regression.spec.ts:180:3 › regression: drag persistence in snapshot mode › archive in snapshot mode persists across polls
[1A[2K[55/81] [chromium] › test/e2e/board.spec.ts:268:3 › visual › dark mode applies via prefers-color-scheme
[1A[2K[56/81] [chromium] › test/e2e/board.spec.ts:277:3 › inline title edit › double-click opens an editable input with the current title
[1A[2K[57/81] [chromium] › test/e2e/board.spec.ts:286:3 › inline title edit › Enter commits the new title via update_task
[1A[2K[58/81] [chromium] › test/e2e/board.spec.ts:301:3 › inline title edit › Escape cancels and leaves the original title
[1A[2K[59/81] [chromium] › test/e2e/board.spec.ts:313:3 › inline title edit › clicking inside the edit input does not open the side panel
[1A[2K[60/81] [chromium] › test/e2e/regression.spec.ts:189:3 › regression: drag persistence in snapshot mode › inline-add in snapshot mode persists across polls
[1A[2K[61/81] [chromium] › test/e2e/journey.spec.ts:192:3 › user journey: edit a card in detail › open card, rewrite title, rewrite description, add label via labels (visual)
[1A[2K[62/81] [chromium] › test/e2e/board.spec.ts:324:3 › column rename + add › double-click a column name opens an editable input
[1A[2K[63/81] [chromium] › test/e2e/board.spec.ts:332:3 › column rename + add › Enter commits the new column name
[1A[2K[64/81] [chromium] › test/e2e/board.spec.ts:342:3 › column rename + add › Escape cancels and leaves the original name
[1A[2K[65/81] [chromium] › test/e2e/board.spec.ts:353:3 › column rename + add › Add column button reveals an input that creates a new column
[1A[2K[66/81] [chromium] › test/e2e/board.spec.ts:365:3 › column rename + add › Esc cancels add-column without creating
[1A[2K[67/81] [chromium] › test/e2e/regression.spec.ts:206:3 › regression: persistence across reload › drag survives page reload (localStorage merge)
[1A[2K[68/81] [chromium] › test/e2e/board.spec.ts:378:3 › group by › default group is by status (existing column ids)
[1A[2K[69/81] [chromium] › test/e2e/board.spec.ts:384:3 › group by › switching to source re-buckets columns by source.type
[1A[2K[70/81] [chromium] › test/e2e/regression.spec.ts:234:3 › regression: persistence across reload › archive survives page reload (tombstone log)
[1A[2K[71/81] [chromium] › test/e2e/board.spec.ts:391:3 › group by › switching to priority shows the 5 priority buckets
[1A[2K[72/81] [chromium] › test/e2e/board.spec.ts:399:3 › group by › add-column slot is hidden when grouping by non-status
[1A[2K[73/81] [chromium] › test/e2e/regression.spec.ts:247:3 › regression: persistence across reload › Reset to snapshot wipes local edits
[1A[2K[74/81] [chromium] › test/e2e/board.spec.ts:408:3 › a11y › column headers are <h2>
[1A[2K[75/81] [chromium] › test/e2e/board.spec.ts:413:3 › a11y › search input has type=search
[1A[2K[76/81] [chromium] › test/e2e/regression.spec.ts:271:5 › regression: console error gate › no console errors in bridge=ok
[1A[2K[77/81] [chromium] › test/e2e/regression.spec.ts:271:5 › regression: console error gate › no console errors in bridge=fail
[1A[2K[78/81] [chromium] › test/e2e/regression.spec.ts:271:5 › regression: console error gate › no console errors in bridge=missing
[1A[2K[79/81] [chromium] › test/e2e/journey.spec.ts:255:3 › user journey: full sweep across the board › move a card through Inbox -> To Do -> In Progress -> Done
[1A[2K[80/81] [chromium] › test/e2e/journey.spec.ts:299:3 › user journey: same-column reorder › drag the third Inbox card above the first
[1A[2K[81/81] [chromium] › test/e2e/journey.spec.ts:349:3 › user journey: keyboard navigation › Tab through the board, focus a card, press Enter to open it, Escape to close
[1A[2K  81 passed (1.4m)

```
