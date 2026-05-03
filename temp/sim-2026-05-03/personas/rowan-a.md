# Persona: Rowan A. (`rowan-a`)

- **Role:** Senior Engineer, Platform
- **Role class:** ic
- **Email volume baseline:** 35/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 230 |
| meeting  | 13 |
| slack    | 99 |
| issue    | 12 |
| calendar | 5 |
| **TOTAL** | **359** |

## Extraction outcome

- **Kept:** 104
- **Skipped:** 255
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Need your review on the API contract" (source=email, priority=medium, owner=Rowan A.)
- "Quick question for you about staging access" (source=email, priority=medium, owner=Rowan A.)
- "Need your review on the API contract" (source=email, priority=medium, owner=Rowan A.)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Rowan A.)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Rowan A.)

### Sample skipped items (5)
- "Calendar: invitation accepted by Beatrix N." — someone else moved it / passive notification
- "[Automated] cron job report ok" — watch/automated FYI
- "[Watch] Caspian R. merged PR #1234" — watch/automated FYI
- "Calendar: invitation accepted by Zara O." — someone else moved it / passive notification
- "[Automated] cron job report ok" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 113,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 87,
  "meeting": 9,
  "slack": 15,
  "jira": 7
}
```

Group-by:priority counts:
```json
{
  "medium": 87,
  "high": 31
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task f065c111018c67c3
- Mon 2pm: 30 fresh items → 14 new cards
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
