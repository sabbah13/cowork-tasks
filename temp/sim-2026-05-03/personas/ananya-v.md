# Persona: Ananya V. (`ananya-v`)

- **Role:** Founder & CTO, Engineering
- **Role class:** founder
- **Email volume baseline:** 100/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 209 |
| meeting  | 11 |
| slack    | 54 |
| issue    | 8 |
| calendar | 5 |
| **TOTAL** | **287** |

## Extraction outcome

- **Kept:** 81
- **Skipped:** 206
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Reply needed re: customer escalation?" (source=email, priority=high, owner=Ananya V.)
- "Decision needed: go/no-go" (source=email, priority=medium, owner=Ananya V.)
- "Need your review on the launch checklist" (source=email, priority=medium, owner=Ananya V.)
- "Decision needed: vendor selection" (source=email, priority=medium, owner=Ananya V.)
- "Reply needed re: follow-up call?" (source=email, priority=high, owner=Ananya V.)

### Sample skipped items (5)
- "Newsletter: monthly briefing" — broadcast / non-action
- "Build green - staging" — someone else moved it / passive notification
- "Newsletter: monthly briefing" — broadcast / non-action
- "Office: company-wide policy update" — no clear owner ask
- "[Automated] cron job report ok" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 92,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 70,
  "meeting": 13,
  "slack": 12,
  "jira": 1
}
```

Group-by:priority counts:
```json
{
  "high": 17,
  "medium": 79
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task ec4203dbbeb9385a
- Mon 2pm: 30 fresh items → 15 new cards
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
