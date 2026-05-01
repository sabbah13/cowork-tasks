---
description: Drains the Cowork Tasks triage queue right now (don't wait for the hourly cycle). Use when the user wants their board updated immediately - "triage now", "process my inbox", "run triage", "check for new tasks".
---

# Run triage now

The connectors continuously queue raw items at
`~/.cowork-tasks/triage-queue/<connector>/<hash>.json`. This skill drains that
queue once and converts items into tasks.

## Steps

1. Run the triage runner binary:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/bin/triage-runner.js --once
   ```
2. Read its stdout summary - it prints `created N, skipped M, failed K`.
3. Use the `task-extractor` subagent for any items it didn't already process
   inline (the runner delegates by default).
4. Tell the user: "Triaged N items: created K tasks, skipped M (not
   actionable)."

If there's nothing in the queue, say "Nothing to triage - your board is up to
date."
