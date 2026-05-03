# Persona: Kai T. (`kai-t`)

- **Role:** Frontend Engineer, Web
- **Role class:** ic
- **Email volume baseline:** 25/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 257 |
| meeting  | 13 |
| slack    | 63 |
| issue    | 9 |
| calendar | 5 |
| **TOTAL** | **347** |

## Extraction outcome

- **Kept:** 113
- **Skipped:** 234
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Need your review on the design doc" (source=email, priority=medium, owner=Kai T.)
- "Need your review on the design doc" (source=email, priority=medium, owner=Kai T.)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Kai T.)
- "Approval needed: NDA" (source=email, priority=medium, owner=Kai T.)
- "Quick question for you about staging access" (source=email, priority=medium, owner=Kai T.)

### Sample skipped items (5)
- "LinkedIn: event reminder" — no clear owner ask
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Ivar K. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "Crunchbase: trending company" — someone else moved it / passive notification
- "Zara O. added a comment in a doc you're a viewer of" — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 118,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 99,
  "meeting": 6,
  "slack": 15,
  "jira": 3
}
```

Group-by:priority counts:
```json
{
  "medium": 99,
  "high": 24
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task cce128e1ea3be2d3
- Mon 2pm: 30 fresh items → 10 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 149 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
