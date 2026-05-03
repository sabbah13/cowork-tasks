# Persona: Miriam B. (`miriam-b`)

- **Role:** Engineering Manager, Identity
- **Role class:** manager
- **Email volume baseline:** 45/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 206 |
| meeting  | 10 |
| slack    | 55 |
| issue    | 11 |
| calendar | 5 |
| **TOTAL** | **287** |

## Extraction outcome

- **Kept:** 86
- **Skipped:** 201
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Miriam B.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Miriam B.)
- "Decision needed: incident postmortem owner" (source=email, priority=medium, owner=Miriam B.)
- "Reply needed re: follow-up call?" (source=email, priority=high, owner=Miriam B.)
- "Quick question for you about team capacity" (source=email, priority=medium, owner=Miriam B.)

### Sample skipped items (5)
- "Calendar: invitation accepted by Penelope J." — someone else moved it / passive notification
- "Calendar: invitation accepted by Hadia M." — someone else moved it / passive notification
- "[Watch] Nikolai V. merged PR #8901" — watch/automated FYI
- "HR: company-wide maintenance window" — no clear owner ask
- "[Watch] Gunnar S. merged PR #1234" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 86,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 76,
  "meeting": 6,
  "slack": 6,
  "jira": 3
}
```

Group-by:priority counts:
```json
{
  "medium": 74,
  "high": 17
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 152a64b2dadc8136
- Mon 2pm: 30 fresh items → 5 new cards
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
