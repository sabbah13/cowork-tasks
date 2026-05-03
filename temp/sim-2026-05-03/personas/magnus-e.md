# Persona: Magnus E. (`magnus-e`)

- **Role:** Senior Product Manager, Platform
- **Role class:** pm
- **Email volume baseline:** 70/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 220 |
| meeting  | 16 |
| slack    | 56 |
| issue    | 8 |
| calendar | 5 |
| **TOTAL** | **305** |

## Extraction outcome

- **Kept:** 91
- **Skipped:** 214
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Need your review on the budget memo" (source=email, priority=medium, owner=Magnus E.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Magnus E.)
- "Need your review on the Q3 plan" (source=email, priority=medium, owner=Magnus E.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Magnus E.)
- "Reply needed re: onboarding?" (source=email, priority=high, owner=Magnus E.)

### Sample skipped items (5)
- "Calendar: invitation accepted by Emeka O." — someone else moved it / passive notification
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "LinkedIn: trending company" — someone else moved it / passive notification
- "[Automated] cron job report warn" — watch/automated FYI
- "[Automated] cron job report warn" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 94,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 74,
  "meeting": 11,
  "slack": 12,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "medium": 78,
  "high": 21
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task d5d2957a039e4f48
- Mon 2pm: 30 fresh items → 8 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 127 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
