# Persona: Yuki S. (`yuki-s`)

- **Role:** Engineering Manager, Data Platform
- **Role class:** manager
- **Email volume baseline:** 50/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 254 |
| meeting  | 7 |
| slack    | 91 |
| issue    | 10 |
| calendar | 5 |
| **TOTAL** | **367** |

## Extraction outcome

- **Kept:** 104
- **Skipped:** 263
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Yuki S.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Yuki S.)
- "Quick question for you about staging access" (source=email, priority=medium, owner=Yuki S.)
- "Quick question for you about team capacity" (source=email, priority=medium, owner=Yuki S.)
- "Need your review on the design doc" (source=email, priority=medium, owner=Yuki S.)

### Sample skipped items (5)
- "LinkedIn: trending company" — someone else moved it / passive notification
- "[Watch] Zara O. merged PR #4567" — watch/automated FYI
- "LinkedIn: New connection" — someone else moved it / passive notification
- "Eventbrite: trending company" — someone else moved it / passive notification
- "Unsubscribe to stop these notifications" — broadcast / non-action

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 107,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 83,
  "meeting": 5,
  "slack": 20,
  "jira": 4
}
```

Group-by:priority counts:
```json
{
  "medium": 83,
  "high": 29
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 678b96d9dd2c8e0b
- Mon 2pm: 30 fresh items → 8 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 140 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
