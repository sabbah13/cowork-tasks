# Persona: Tariq L. (`tariq-l`)

- **Role:** Designer, Product Design
- **Role class:** specialist
- **Email volume baseline:** 26/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 221 |
| meeting  | 14 |
| slack    | 88 |
| issue    | 8 |
| calendar | 5 |
| **TOTAL** | **336** |

## Extraction outcome

- **Kept:** 89
- **Skipped:** 247
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: vendor question?" (source=email, priority=high, owner=Tariq L.)
- "Action required: SOW" (source=email, priority=medium, owner=Tariq L.)
- "Your input on NDA" (source=email, priority=medium, owner=Tariq L.)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Tariq L.)
- "Please sign SOW" (source=email, priority=medium, owner=Tariq L.)

### Sample skipped items (5)
- "Re: thread you're on (no action)" — FYI / optional
- "[Watch] Juno A. merged PR #8901" — watch/automated FYI
- "Crunchbase: trending company" — someone else moved it / passive notification
- "LinkedIn: trending company" — someone else moved it / passive notification
- "Office: company-wide maintenance window" — no clear owner ask

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 94,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 69,
  "meeting": 6,
  "slack": 21,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "high": 20,
  "medium": 78
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 727cb788e5b63289
- Mon 2pm: 30 fresh items → 9 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 125 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
