# Persona: Elif D. (`elif-d`)

- **Role:** VP of Engineering, Engineering
- **Role class:** exec
- **Email volume baseline:** 90/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 187 |
| meeting  | 13 |
| slack    | 58 |
| issue    | 9 |
| calendar | 5 |
| **TOTAL** | **272** |

## Extraction outcome

- **Kept:** 86
- **Skipped:** 186
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: follow-up call?" (source=email, priority=high, owner=Elif D.)
- "Reply needed re: vendor question?" (source=email, priority=high, owner=Elif D.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Elif D.)
- "Need your review on the budget memo" (source=email, priority=medium, owner=Elif D.)
- "Need your review on the Q3 plan" (source=email, priority=medium, owner=Elif D.)

### Sample skipped items (5)
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Penelope J. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "Crunchbase: event reminder" — no clear owner ask
- "Marisol G. added a comment in a doc you're a viewer of" — someone else moved it / passive notification

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 94,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 67,
  "meeting": 12,
  "slack": 14,
  "jira": 4
}
```

Group-by:priority counts:
```json
{
  "high": 15,
  "medium": 82
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 029d236c6be725f2
- Mon 2pm: 30 fresh items → 11 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 122 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
