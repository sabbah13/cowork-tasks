# Persona: Priya M. (`priya-m`)

- **Role:** Software Engineer, Payments
- **Role class:** ic
- **Email volume baseline:** 30/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 250 |
| meeting  | 8 |
| slack    | 87 |
| issue    | 10 |
| calendar | 5 |
| **TOTAL** | **360** |

## Extraction outcome

- **Kept:** 109
- **Skipped:** 251
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Priya M.)
- "Approval needed: SOW" (source=email, priority=medium, owner=Priya M.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Priya M.)
- "Quick question for you about team capacity" (source=email, priority=medium, owner=Priya M.)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Priya M.)

### Sample skipped items (5)
- "Newsletter: weekly digest" — broadcast / non-action
- "Deploy succeeded - main" — someone else moved it / passive notification
- "Deploy succeeded - main" — someone else moved it / passive notification
- "Marisol G. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "Calendar: invitation accepted by Quentin H." — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 110,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 85,
  "slack": 20,
  "jira": 3,
  "meeting": 7
}
```

Group-by:priority counts:
```json
{
  "medium": 92,
  "high": 23
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 290fe2d6b182105e
- Mon 2pm: 30 fresh items → 6 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 145 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
