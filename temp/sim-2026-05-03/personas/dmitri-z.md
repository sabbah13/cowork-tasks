# Persona: Dmitri Z. (`dmitri-z`)

- **Role:** Solutions Architect, Customer Engineering
- **Role class:** cross
- **Email volume baseline:** 75/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 191 |
| meeting  | 13 |
| slack    | 95 |
| issue    | 10 |
| calendar | 5 |
| **TOTAL** | **314** |

## Extraction outcome

- **Kept:** 74
- **Skipped:** 240
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: onboarding?" (source=email, priority=high, owner=Dmitri Z.)
- "Reply needed re: vendor question?" (source=email, priority=high, owner=Dmitri Z.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Dmitri Z.)
- "Action required: travel auth" (source=email, priority=medium, owner=Dmitri Z.)
- "Need your review on the Q3 plan" (source=email, priority=medium, owner=Dmitri Z.)

### Sample skipped items (5)
- "Newsletter: monthly briefing" — broadcast / non-action
- "Newsletter: weekly digest" — broadcast / non-action
- "Office: company-wide all-hands recording" — broadcast / non-action
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Newsletter: monthly briefing" — broadcast / non-action

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 81,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 60,
  "meeting": 9,
  "slack": 13,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "high": 24,
  "medium": 60
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task a52cc2cd19073b09
- Mon 2pm: 30 fresh items → 10 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 110 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
