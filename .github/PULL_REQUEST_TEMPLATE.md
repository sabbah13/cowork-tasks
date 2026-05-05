# Pull Request

## What

<!-- 1-2 sentences. What does this PR change? -->

## Why

<!-- 1-2 sentences. Why does this change matter? Link an issue if there is one. -->

## Type

- [ ] New connector
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Documentation
- [ ] Refactor (no behavior change)
- [ ] CI / tooling

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] If this is a connector PR, the contract test harness passes
- [ ] If this is a UI change, I tested in Claude Cowork (see [docs/local-install.md](../docs/local-install.md): `pnpm pack-local` → upload zip → `/open-board`)
- [ ] CHANGELOG updated under `[Unreleased]`
- [ ] Conventional commit message (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)

## Screenshots / demo (UI changes only)

<!-- Drop a screenshot or 5-second screen recording. -->

## Notes for the reviewer

<!-- Optional. Anything you want a reviewer to focus on or skip. -->
