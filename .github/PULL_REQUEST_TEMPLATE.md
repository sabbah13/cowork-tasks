# Pull Request

## What

<!-- 1-2 sentences. What does this PR change? -->

## Why

<!-- 1-2 sentences. Why does this change matter? Link an issue if there is one. -->

## Type

- [ ] Bug fix
- [ ] Feature / enhancement (UI, MCP tool, skill, agent prompt)
- [ ] Triage rule improvement (`task-extractor` agent or `triage-now` filters)
- [ ] New `.mcp.json` entry for a Cowork-hosted MCP we hadn't pre-declared yet
- [ ] Documentation
- [ ] Refactor (no behavior change)
- [ ] CI / tooling

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] If this is a UI change, I tested in Claude Cowork (see [docs/local-install.md](../docs/local-install.md): `pnpm pack-local` → upload zip → `/open-board`)
- [ ] CHANGELOG updated under `[Unreleased]`
- [ ] Conventional commit message (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
- [ ] No custom connector packages, OAuth flows, or polling daemons added (those live upstream in Cowork - see [CONTRIBUTING.md](../CONTRIBUTING.md))

## Screenshots / demo (UI changes only)

<!-- Drop a screenshot or 5-second screen recording. -->

## Notes for the reviewer

<!-- Optional. Anything you want a reviewer to focus on or skip. -->
