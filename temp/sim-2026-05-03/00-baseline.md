# Baseline state — sim-2026-05-03

## Git
```
branch: main @ 56123e2
remote main: 56123e2

git status --short:
?? temp/

git log --oneline -5:
56123e2 feat(E): group by + bump to 0.4.7
4d4a9de feat(D): add column / rename column
bc2df64 feat(F): drop placeholder line during drag
5498c11 docs: reposition as 'first task manager for Claude Cowork'
ccb54a6 feat(0.4.6): inline title edit + checklist + comments
```

## Build (pnpm build)
```
packages/landing build: built demo.html (artifact + 5384 bytes seed)
packages/landing build: Done
packages/core build: Done
packages/connector-chat-slack build: Done
packages/connector-meet-fathom build: Done
packages/connector-email-gmail build: Done
packages/vscode-ext build: ⚡ Done in 19ms
packages/vscode-ext build: [vscode-ext] built
packages/vscode-ext build: Done
packages/mcp-server build: Done
packages/artifact build: computing gzip size...
packages/artifact build: dist/index.html  627.87 kB │ gzip: 190.45 kB
packages/artifact build: ✓ built in 1.37s
packages/artifact build: Done
packages/plugin build: Done
```

Bundle sizes:
  627896  packages/artifact/dist/index.html
  627896  packages/plugin/artifact/cowork-tasks.html
  852584  packages/plugin/bundle/mcp-server.js

## Unit tests

### @cowork-tasks/mcp-server
```
 ✓ src/__tests__/server.test.ts  (5 tests) 359ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  580ms (transform 39ms, setup 0ms, collect 95ms, tests 359ms, environment 0ms, prepare 40ms)
```

### @cowork-tasks/artifact
```
> vitest run --passWithNoTests
 ✓ src/__tests__/storage.test.ts  (15 tests) 2ms
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  160ms (transform 18ms, setup 0ms, collect 18ms, tests 2ms, environment 0ms, prepare 27ms)
```

## E2E suite (Playwright)
```
[1A[2K  81 passed (1.4m)
```

_Phase 1 complete: 2026-05-03 02:56 PDT_
