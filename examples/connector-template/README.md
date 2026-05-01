# Connector template

Copy this folder to `packages/connector-<family>-<id>/` to start a new connector.

## What you need to do

1. Edit `package.json`: rename to `@cowork-tasks/connector-<family>-<id>`.
2. Edit `src/index.ts`: implement the source-specific `watch()`. The base class handles cursors, dedup, queueing, and backoff.
3. Run `pnpm test` — the contract harness will tell you if cursor + dedup are wired correctly.
4. Add a one-line entry to `packages/plugin/monitors/monitors.json`.
5. Add a binary at `packages/plugin/bin/connectors/<family>-<id>.js`.

That's it. PRs welcome.
