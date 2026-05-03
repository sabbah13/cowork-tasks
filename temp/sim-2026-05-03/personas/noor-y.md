# Persona: Noor Y. (`noor-y`)

- **Role:** Site Reliability Engineer, Reliability
- **Role class:** specialist
- **Email volume baseline:** 22/day

## Items queued (5 working days)

| Category | Count |
|---|---|
| email    | 224 |
| meeting  | 11 |
| slack    | 97 |
| issue    | 12 |
| calendar | 5 |
| **TOTAL** | **349** |

## Extraction outcome

- **Kept:** 90
- **Skipped:** 259
- **Skip rate:** NaN%

### Sample kept tasks (5)
- "Quick question for you about the rollout plan" (source=email, priority=medium, owner=Noor Y.)
- "Reply needed re: onboarding?" (source=email, priority=high, owner=Noor Y.)
- "Quick question for you about staging access" (source=email, priority=medium, owner=Noor Y.)
- "Reply needed re: vendor question?" (source=email, priority=high, owner=Noor Y.)
- "Reply needed re: customer escalation?" (source=email, priority=high, owner=Noor Y.)

### Sample skipped items (5)
- "Re: thread you're on (no action)" — FYI / optional
- "Calendar: invitation accepted by Soren W." — someone else moved it / passive notification
- "Re: thread you're on (no action)" — FYI / optional
- "Yusuf I. added a comment in a doc you're a viewer of" — someone else moved it / passive notification
- "Re: thread you're on (no action)" — FYI / optional

## Final board (after Mon-Fri lifecycle)

```json
{
  "done": 2,
  "triage": 101,
  "todo": 1,
  "in-progress": 1
}
```

Group-by:source counts:
```json
{
  "email": 83,
  "meeting": 7,
  "slack": 12,
  "jira": 3
}
```

Group-by:priority counts:
```json
{
  "medium": 80,
  "high": 25
}
```

## Lifecycle log

- Mon 10am: moved 2→todo, 1→in-progress
- Mon 11am: enriched task 155f34346993314b
- Mon 2pm: 30 fresh items → 15 new cards
- Mon 4pm: 2→done, 1→archived
- Tue: coach annotated top 3
- Wed: renamed inbox→Triage, +Review col; group-by counts ok
- Thu: stale-folder check delegated to Phase 4
- Fri 4pm: snapshot taken

## Tool-call count (simulated)

- ~ 126 write operations
- 1 task-extractor batch (per day) × 5 + 1 (Mon 2pm fresh) = 6 extractor invocations
- Lifecycle: 6 directly mutated cards

## Errors

(none)

## Latency

- Lifecycle simulation: 0 ms
