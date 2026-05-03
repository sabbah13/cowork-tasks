# Persona: Lukas H. (`lukas-h`)

- **Role:** Data Engineer, Data Platform
- **Role class:** ic
- **Email volume baseline:** 40/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 208 |
| meeting  | 12 |
| slack    | 64 |
| issue    | 7 |
| calendar | 5 |
| **TOTAL** | **296** |

## Extraction outcome

- **Kept:** 81
- **Skipped:** 215
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: onboarding?" (source=email, priority=high, owner=Lukas H.)
- "Your input on travel auth" (source=email, priority=medium, owner=Lukas H.)
- "Please sign contractor invoice" (source=email, priority=medium, owner=Lukas H.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Lukas H.)
- "Decision needed: go/no-go" (source=email, priority=medium, owner=Lukas H.)

### Sample skipped items (5)
- "LinkedIn: event reminder" — no clear owner ask
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Calendar: invitation accepted by Marisol G." — someone else moved it / passive notification
- "Calendar: invitation accepted by Tabitha E." — someone else moved it / passive notification
- "Eventbrite: trending company" — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 82,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 68,
  "meeting": 7,
  "slack": 9,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "high": 14,
  "medium": 72
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 00f388d1075aa4ee
- Mon 2pm: 30 fresh items → 5 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 117 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
