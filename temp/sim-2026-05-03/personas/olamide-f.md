# Persona: Olamide F. (`olamide-f`)

- **Role:** Founder & CEO, Executive
- **Role class:** founder
- **Email volume baseline:** 130/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 199 |
| meeting  | 8 |
| slack    | 70 |
| issue    | 10 |
| calendar | 5 |
| **TOTAL** | **292** |

## Extraction outcome

- **Kept:** 100
- **Skipped:** 192
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Quick question for you about the deploy" (source=email, priority=medium, owner=Olamide F.)
- "Approval needed: contractor invoice" (source=email, priority=medium, owner=Olamide F.)
- "Decision needed: go/no-go" (source=email, priority=medium, owner=Olamide F.)
- "Quick question for you about staging access" (source=email, priority=medium, owner=Olamide F.)
- "Approval needed: NDA" (source=email, priority=medium, owner=Olamide F.)

### Sample skipped items (5)
- "Unsubscribe to stop these notifications" — broadcast / non-action
- "Newsletter: industry roundup" — broadcast / non-action
- "CI failed - main" — no clear owner ask
- "[Watch] Emeka O. merged PR #4567" — watch/automated FYI
- "[Watch] Beatrix N. merged PR #4567" — watch/automated FYI

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 104,
  "todo": 2,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 79,
  "meeting": 7,
  "slack": 17,
  "jira": 6
}
```

Group-by:priority counts:
```json
{
  "medium": 84,
  "high": 25
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 7981c5248317796f
- Mon 2pm: 30 fresh items → 9 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 136 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
