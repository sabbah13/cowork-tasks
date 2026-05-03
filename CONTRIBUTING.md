# Contributing to Cowork Tasks

Thanks for considering a contribution. The most-impactful thing you can do is **add a connector** for a source we don't yet support.

## Quick links

- **First-time contributor?** Pick a [good first issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue) - they're all connector PRs sized to ~50 lines.
- **Want a connector for tool X?** Open an issue with the `connector` label, or post in the [Connectors-Wishlist discussion](https://github.com/sabbah13/cowork-tasks/discussions).
- **Maintainer SLA:** PRs reviewed within 48 hours. Connector PRs usually merged the same week.
- **Community:** [GitHub Discussions](https://github.com/sabbah13/cowork-tasks/discussions) for questions and showcases.



## Adding a connector

A connector is a small TypeScript module that knows how to:

1. Authenticate to a source (OAuth, API key, IMAP, ...).
2. Fetch new items since the last cursor.
3. Hand the items to the triage queue.

It's typically 30-80 lines.

### 4 steps

1. Copy `examples/connector-template/` to `packages/connector-<family>-<id>/`.
2. Edit `src/index.ts` - implement `auth()`, `watch(cursor, cb)`, and (optionally) `toTasks(item)`.
3. Add a line to `packages/plugin/monitors/monitors.json`.
4. Open a PR. CI runs the connector contract test suite. We label it `connector` and merge.

### Connector contract

```ts
import type { Connector } from '@cowork-tasks/core';

export const connector: Connector = {
  id: 'meet-mynotetaker',
  label: 'My Note Taker',
  category: 'meeting',
  auth: { kind: 'apiKey', envVar: 'MYNOTETAKER_API_KEY' },
  schedule: { kind: 'poll', intervalMs: 5 * 60 * 1000 },

  async watch(cursor, push) {
    const since = cursor ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const meetings = await fetchMeetingsSince(since);
    for (const m of meetings) {
      push({
        id: m.id,
        sourceHash: hashOf(m),
        title: m.title,
        body: m.transcript,
        url: m.shareUrl,
        author: m.host,
        timestamp: m.endTime,
      });
    }
    return meetings.at(-1)?.endTime ?? since;
  },
};
```

The base class handles cursor persistence, dedup, queue writes, backoff, and stats. You only write the API integration.

### Testing your connector

```bash
pnpm --filter @cowork-tasks/connector-<id> test
```

The harness mocks the API response and asserts:

- Cursor advances correctly across calls.
- Same item never produces two queue entries.
- Empty response is a no-op.
- Errors back off exponentially.

## Code style

- TypeScript, strict mode, no `any` unless commented why.
- ESLint + Prettier (run `pnpm lint`, `pnpm format`).
- One feature per PR. Keep diffs tight.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.

## Reporting bugs

Use the [bug template](.github/ISSUE_TEMPLATE/bug.yml). Include:

- Plugin version (`/cowork-tasks:health` shows it).
- Cowork version.
- Connector that misbehaved (if applicable).
- Logs from `~/.cowork-tasks/logs/cowork-tasks.log`.

## Code of conduct

Be kind. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
