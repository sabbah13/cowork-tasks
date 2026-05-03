# Persona: Tomasz W. (`tomasz-w`)

- **Role:** Director of Engineering, Infrastructure
- **Role class:** manager
- **Email volume baseline:** 60/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 183 |
| meeting  | 13 |
| slack    | 87 |
| issue    | 4 |
| calendar | 5 |
| **TOTAL** | **292** |

## Extraction outcome

- **Kept:** 76
- **Skipped:** 216
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Approval needed: travel auth" (source=email, priority=medium, owner=Tomasz W.)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Tomasz W.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Tomasz W.)
- "Reply needed re: follow-up call?" (source=email, priority=high, owner=Tomasz W.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Tomasz W.)

### Sample skipped items (5)
- "Re: thread you're on (no action)" — FYI / optional
- "Valentin Y. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "Calendar: invitation accepted by Valentin Y." — someone else moved it / passive notification
- "Newsletter: industry roundup" — broadcast / non-action
- "Re: thread you're on (no action)" — FYI / optional

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 74,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 47,
  "meeting": 10,
  "slack": 21,
  "jira": 1
}
```

Group-by:priority counts:
```json
{
  "medium": 61,
  "high": 18
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 0e25688511ed0114
- Mon 2pm: 30 fresh items → 3 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 112 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
