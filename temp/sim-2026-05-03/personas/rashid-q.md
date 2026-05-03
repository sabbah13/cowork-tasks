# Persona: Rashid Q. (`rashid-q`)

- **Role:** Security Engineer, Security
- **Role class:** specialist
- **Email volume baseline:** 28/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 212 |
| meeting  | 10 |
| slack    | 76 |
| issue    | 6 |
| calendar | 5 |
| **TOTAL** | **309** |

## Extraction outcome

- **Kept:** 85
- **Skipped:** 224
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: customer escalation?" (source=email, priority=high, owner=Rashid Q.)
- "Reply needed re: customer escalation?" (source=email, priority=high, owner=Rashid Q.)
- "Decision needed: go/no-go" (source=email, priority=medium, owner=Rashid Q.)
- "Need your review on the Q3 plan" (source=email, priority=medium, owner=Rashid Q.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Rashid Q.)

### Sample skipped items (5)
- "Crunchbase: trending company" — someone else moved it / passive notification
- "Newsletter: monthly briefing" — broadcast / non-action
- "Crunchbase: New connection" — someone else moved it / passive notification
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Build green - main" — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 90,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 69,
  "slack": 15,
  "jira": 3,
  "meeting": 6
}
```

Group-by:priority counts:
```json
{
  "high": 26,
  "medium": 67
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 4871f35caebd46ef
- Mon 2pm: 30 fresh items → 8 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 121 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
