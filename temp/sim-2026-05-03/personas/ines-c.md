# Persona: Ines C. (`ines-c`)

- **Role:** ML Engineer, ML Platform
- **Role class:** specialist
- **Email volume baseline:** 32/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 197 |
| meeting  | 6 |
| slack    | 92 |
| issue    | 6 |
| calendar | 5 |
| **TOTAL** | **306** |

## Extraction outcome

- **Kept:** 84
- **Skipped:** 222
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Ines C.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Ines C.)
- "Need your review on the budget memo" (source=email, priority=medium, owner=Ines C.)
- "Decision needed: incident postmortem owner" (source=email, priority=medium, owner=Ines C.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Ines C.)

### Sample skipped items (5)
- "Deploy succeeded - main" — someone else moved it / passive notification
- "Yusuf I. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "LinkedIn: event reminder" — no clear owner ask
- "Eventbrite: New connection" — someone else moved it / passive notification
- "Newsletter: monthly briefing" — broadcast / non-action

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 92,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 65,
  "meeting": 5,
  "slack": 26,
  "jira": 1
}
```

Group-by:priority counts:
```json
{
  "medium": 76,
  "high": 21
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 48801a2caf1f82d7
- Mon 2pm: 30 fresh items → 13 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 120 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
