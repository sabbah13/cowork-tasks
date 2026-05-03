# Persona: Vivienne O. (`vivienne-o`)

- **Role:** Product Manager, Growth
- **Role class:** pm
- **Email volume baseline:** 65/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 233 |
| meeting  | 9 |
| slack    | 41 |
| issue    | 6 |
| calendar | 5 |
| **TOTAL** | **294** |

## Extraction outcome

- **Kept:** 76
- **Skipped:** 218
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Need your review on the API contract" (source=email, priority=medium, owner=Vivienne O.)
- "Decision needed: incident postmortem owner" (source=email, priority=medium, owner=Vivienne O.)
- "Decision needed: incident postmortem owner" (source=email, priority=medium, owner=Vivienne O.)
- "Approval needed: SOW" (source=email, priority=medium, owner=Vivienne O.)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Vivienne O.)

### Sample skipped items (5)
- "Calendar: invitation accepted by Marisol G." — someone else moved it / passive notification
- "Liesel B. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "CI failed - release-1.2" — no clear owner ask
- "Calendar: invitation accepted by Beatrix N." — someone else moved it / passive notification
- "[Watch] Juno A. merged PR #1234" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 80,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 69,
  "meeting": 6,
  "slack": 8,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "medium": 72,
  "high": 13
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 6f4168d8a0114dfa
- Mon 2pm: 30 fresh items → 9 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 112 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
