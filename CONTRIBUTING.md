# Contributing to Cowork Tasks

Thanks for considering a contribution. The most-impactful thing you can do is **add a connector** for a source we don't yet support.

## Quick links

- **First-time contributor?** Pick a [good first issue](https://github.com/sabbah13/cowork-tasks/labels/good%20first%20issue) - scoped to one or two files with clear acceptance criteria. Some are connector PRs (~50 lines), others are UI or performance fixes.
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

## What happens after you open a PR

1. **CI runs automatically** - typecheck, lint, tests, and build on Node 20 and 22. Fix any failures before asking for review.
2. **Automated code review** - an AI reviewer analyzes your diff and posts a review comment covering correctness, style, and any issues. This usually appears within an hour of opening the PR.
3. **Maintainer review** - the maintainer reads the AI review, tests the change in Claude Cowork, and either requests changes or approves and merges.

**SLA:** PRs reviewed within 48 hours. Good-first-issue PRs are typically merged the same week.

If you want feedback before the PR is polished, open it as a **draft** - the AI review still runs, and you can iterate before requesting a full maintainer review.

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
