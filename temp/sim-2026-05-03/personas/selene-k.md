# Persona: Selene K. (`selene-k`)

- **Role:** Technical Program Manager, Cross-functional
- **Role class:** cross
- **Email volume baseline:** 80/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 253 |
| meeting  | 17 |
| slack    | 66 |
| issue    | 5 |
| calendar | 5 |
| **TOTAL** | **346** |

## Extraction outcome

- **Kept:** 107
- **Skipped:** 239
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Decision needed: go/no-go" (source=email, priority=medium, owner=Selene K.)
- "Reply needed re: follow-up call?" (source=email, priority=high, owner=Selene K.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Selene K.)
- "Approval needed: travel auth" (source=email, priority=medium, owner=Selene K.)
- "Decision needed: naming proposal" (source=email, priority=medium, owner=Selene K.)

### Sample skipped items (5)
- "[Watch] Hadia M. merged PR #4567" — watch/automated FYI
- "[Automated] cron job report ok" — watch/automated FYI
- "[Watch] Fenella P. merged PR #4567" — watch/automated FYI
- "[Automated] cron job report warn" — watch/automated FYI
- "Re: thread you're on (no action)" — FYI / optional

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 112,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 87,
  "meeting": 11,
  "slack": 16,
  "jira": 2
}
```

Group-by:priority counts:
```json
{
  "medium": 90,
  "high": 26
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 12c7093a09722c92
- Mon 2pm: 30 fresh items → 9 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 143 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 1 ms
