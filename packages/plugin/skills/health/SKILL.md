---
description: Shows a per-connector health table for Cowork Tasks - last poll time, items pulled, errors. Use when the user says "is Cowork Tasks working?", "what's wrong with my board?", "show health", "show status".
---

# Health check

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/bin/health.js` - it queries each connector's
   stats file at `~/.cowork-tasks/stats/<connector>.json`.
2. Format as a table:

   | Connector | Status | Last poll | Items | Errors |
   |---|---|---|---|---|
   | gmail | ok | 2 min ago | 0 | none |
   | slack | error | 5 min ago | 0 | "401 invalid_auth" |

3. If any connector shows an auth error, suggest re-running
   `/cowork-tasks:setup`.
4. Show the triage runner state too: last cycle, queue depth, next scheduled.
