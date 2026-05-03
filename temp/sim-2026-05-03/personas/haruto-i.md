# Persona: Haruto I. (`haruto-i`)

- **Role:** Chief Operating Officer, Operations
- **Role class:** exec
- **Email volume baseline:** 110/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 178 |
| meeting  | 11 |
| slack    | 55 |
| issue    | 8 |
| calendar | 5 |
| **TOTAL** | **257** |

## Extraction outcome

- **Kept:** 76
- **Skipped:** 181
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Quick question for you about team capacity" (source=email, priority=medium, owner=Haruto I.)
- "Reply needed re: vendor question?" (source=email, priority=high, owner=Haruto I.)
- "Approval needed: SOW" (source=email, priority=medium, owner=Haruto I.)
- "Need your review on the API contract" (source=email, priority=medium, owner=Haruto I.)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Haruto I.)

### Sample skipped items (5)
- "Eventbrite: event reminder" — no clear owner ask
- "[Watch] Fenella P. merged PR #8901" — watch/automated FYI
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Newsletter: monthly briefing" — broadcast / non-action
- "Crunchbase: event reminder" — no clear owner ask

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 75,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 64,
  "meeting": 5,
  "slack": 7,
  "jira": 3
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
- Mon 11am: enriched task f61f8eb4c825e9ef
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
