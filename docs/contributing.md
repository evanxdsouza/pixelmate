# Contributing

Thank you for contributing to PixelMate!

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| pnpm | 8+ |
| Chrome / Chromium | 120+ |

---

## Setup

```bash
git clone https://github.com/pixelmate/pixelmate.git
cd pixelmate
pnpm install
```

Build all packages in dependency order:

```bash
pnpm -r run build
```

---

## Development Workflow

### Extension + PWA

Terminal 1 — watch the extension:
```bash
pnpm --filter @pixelmate/extension run dev
```

Terminal 2 — run the PWA dev server:
```bash
pnpm --filter @pixelmate/frontend dev
```

Load the extension from `packages/extension-v2/dist/` in `chrome://extensions` (see [Chrome Extension](./chrome-extension.md)).

Open `http://localhost:5173` for the PWA.

---

## Monorepo Structure

```
pixelmate/
├── packages/
│   ├── shared/          @pixelmate/shared  — TypeScript types
│   ├── core/            @pixelmate/core    — Agent, ToolRegistry, Providers
│   ├── extension-v2/    @pixelmate/extension — MV3 service worker + popup
│   └── frontend/        @pixelmate/frontend  — React PWA
├── docs/                Documentation
├── pnpm-workspace.yaml
└── tsconfig.json        Root base config
```

### Package Dependency Order

```
shared → core → extension-v2
                      └─ frontend (peer, connected via chrome.runtime)
```

---

## Running Tests

```bash
# All packages
pnpm run test

# Specific package
pnpm --filter @pixelmate/core run test
pnpm --filter @pixelmate/frontend run test
pnpm --filter @pixelmate/extension run test

# Watch mode
pnpm --filter @pixelmate/core run test:watch

# Coverage
pnpm --filter @pixelmate/core run test:coverage
```

---

## Code Style

- **TypeScript strict mode** is enabled in all packages
- **No `any`** except where unavoidable (e.g. Chrome API type gaps)
- **No unused variables/parameters** in production code (`noUnusedLocals`, `noUnusedParameters`)
- Formatting: keep consistent with the surrounding code (2-space indent, no semicolons in the existing style)

---

## Making Changes

### Adding a Tool

See [Tool Development](./tool-development.md).

### Adding a Skill

See [Skill Development](./skill-development.md).

### Adding a Provider

See [Providers — Adding a Provider](./providers.md#adding-a-provider).

### Modifying the Message Protocol

1. Add/update the handler in `packages/extension-v2/src/background.ts`
2. Add the corresponding method in `packages/frontend/src/services/ExtensionBridge.ts`
3. Update `docs/api.md`
4. Add tests for both sides

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add web search tool
fix: resolve scrollIntoView crash in jsdom tests
test: add coverage for AgentEvent handling
docs: update API reference for GET_MODELS
refactor: simplify provider selection logic
chore: upgrade vitest to v2
```

---

## Pull Request Checklist

- [ ] `pnpm run test` passes with no failures
- [ ] `pnpm -r run build` completes without TypeScript errors
- [ ] New public functions/classes have JSDoc comments
- [ ] Documentation updated if the change affects user-facing behaviour
- [ ] Commit messages follow Conventional Commits

---

## Project Decisions

| Decision | Rationale |
|----------|-----------|
| MV3 service worker (not background page) | Required for Chrome Web Store submission |
| No backend server | Chromebook-first; avoids hosting cost and latency |
| `chrome.runtime` messaging over WebSockets | Works inside the extension sandbox; no port conflicts |
| pnpm workspaces | Shared types without publishing to npm |
| Vitest (not Jest) | Native ESM support; faster in CI |
| Dexie.js for IndexedDB | Typed, promise-based API with minimal bundle size |
