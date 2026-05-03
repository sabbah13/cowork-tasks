# Persona: Nadia R. (`nadia-r`)

- **Role:** Engineering Manager, Web
- **Role class:** manager
- **Email volume baseline:** 55/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 191 |
| meeting  | 8 |
| slack    | 72 |
| issue    | 4 |
| calendar | 5 |
| **TOTAL** | **280** |

## Extraction outcome

- **Kept:** 84
- **Skipped:** 196
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Need your review on the Q3 plan" (source=email, priority=medium, owner=Nadia R.)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Nadia R.)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Nadia R.)
- "Reply needed re: onboarding?" (source=email, priority=high, owner=Nadia R.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Nadia R.)

### Sample skipped items (5)
- "[Watch] Caspian R. merged PR #4567" — watch/automated FYI
- "LinkedIn: New connection" — someone else moved it / passive notification
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Re: thread you're on (no action)" — FYI / optional
- "Eventbrite: trending company" — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 90,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 71,
  "meeting": 3,
  "slack": 19,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "medium": 68,
  "high": 27
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 3fbede47e0349d7b
- Mon 2pm: 30 fresh items → 11 new cards
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
