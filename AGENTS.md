# CleanMail – Agent Guide

CleanMail is a desktop webmail client cleaner built with Electrobun, React, and the TanStack stack.

## Tech Stack

| Layer | Technology |
|---|---|
| Package manager | [Bun](https://bun.sh) |
| Desktop runtime | [Electrobun](https://github.com/blackboardsh/electrobun) (not Electron) |
| Linter / Formatter | [Biome](https://biomejs.dev) |
| Bundler / HMR | [Vite](https://vitejs.dev) |
| UI framework | [React](https://react.dev) |
| Component library | [shadcn/ui](https://ui.shadcn.com) (Tailwind-based) |
| Data fetching | [TanStack Query](https://tanstack.com/query) |
| Routing | [TanStack Router](https://tanstack.com/router) |
| Tables | [TanStack Table](https://tanstack.com/table) |

## Project Structure

```
cleanmail/
├── src/
│   ├── bun/                  # Main process (Electrobun / Bun runtime)
│   │   ├── index.ts          # Entry point: creates windows, starts RPC
│   │   └── rpc.ts            # All RPC handler registrations
│   ├── mainview/             # Renderer / webview (React + Vite)
│   │   ├── components/       # Shared React components
│   │   │   └── ui/           # shadcn/ui generated components (do not hand-edit)
│   │   ├── contexts/         # React contexts (Actions, ApplyAction, Drag)
│   │   ├── hooks/
│   │   │   ├── queries/      # TanStack Query hooks (useEmails, useMailboxes, …)
│   │   │   └── mutations/    # TanStack Query mutation hooks
│   │   ├── pages/            # Page-level components ([Name]Page.tsx)
│   │   ├── routes/           # TanStack Router file-based routes
│   │   ├── lib/              # Utilities, helpers, query client setup
│   │   │   ├── rpc.ts        # All rpc.request.* wrappers (named exports)
│   │   │   ├── query-keys.ts # Centralized query key factory
│   │   │   ├── query-client.ts # QueryClient singleton
│   │   │   └── utils.ts      # cn() (clsx + tailwind-merge)
│   │   ├── App.tsx           # Router outlet + providers
│   │   ├── main.tsx          # React entry point
│   │   ├── index.html        # HTML shell
│   │   └── index.css         # Tailwind base styles
│   └── shared/
│       └── rpc-types.ts      # All shared types between bun and mainview
├── biome.json                # Linter + formatter config (single source of truth)
├── electrobun.config.ts      # App metadata, window defaults
├── vite.config.ts            # Vite + React plugin config
├── tailwind.config.js        # Tailwind theme overrides
├── tsconfig.json
└── package.json
```

## Commands

```bash
# Install
bun install

# Development
bun run start          # HMR + app together (recommended for UI work)
bun run hmr            # Vite HMR server only (port 5173)
bun run start:app      # Electrobun dev (loads dist/, no HMR)
bun run watch          # Turbo TUI: format:watch + lint:watch + HMR + app

# Build
bun run build          # Production build (electrobun build)
bun run build:web      # Vite-only build (outputs to dist/)

# Lint & Format  (Biome is the sole toolchain — no ESLint, no Prettier)
bun run lint           # Check for lint errors
bun run lint:fix       # Auto-fix lint errors
bun run format         # Check formatting
bun run format:fix     # Auto-fix formatting
```

**There are no test scripts.** The project has no test framework configured. Do not add test dependencies without explicit instruction.

## Linter & Formatter (Biome)

`biome.json` is the single source of truth for code style:

- **Double quotes** for all JS/TS strings (`"quoteStyle": "double"`)
- Biome `recommended` rule set enforced (no-unused-vars, no-any, etc.)
- **Import organization** is automatic (`organizeImports: "on"`) — do not manually sort imports
- Auto-generated files excluded: `dist/`, `build/`, `.agents/`, `src/mainview/routeTree.gen.ts`
- Run `bun run lint:fix && bun run format:fix` after making changes

## TypeScript

`tsconfig.json` settings that affect code style:

- `strict: true` — full strict mode
- `noUnusedLocals: true` and `noUnusedParameters: true` — remove any dead code
- `noFallthroughCasesInSwitch: true`
- Path alias: `@/*` → `src/mainview/*`

Rules to follow:

- **Never use `any`** — use `unknown` and narrow, or a precise type
- Use `import type { ... }` for type-only imports (Biome enforces this)
- Use `type` (not `interface`) for shared types in `rpc-types.ts`
- No `React.FC` — use explicit prop types and let TypeScript infer return types
- Non-null assertions (`!`) require a `// biome-ignore lint/style/noNonNullAssertion: <reason>` comment
- Use `satisfies` for config objects: `export default { ... } satisfies ElectrobunConfig`
- Use optional chaining and nullish coalescing: `data?.items ?? []`

## Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| Files / directories | `kebab-case` | `query-keys.ts`, `mailbox-utils.ts` |
| React component files | `PascalCase` | `EmailTable.tsx`, `MailboxSidebar.tsx` |
| Route files | TanStack Router convention | `__root.tsx`, `$mailbox.tsx` |
| React components | `PascalCase` | `EmailTable`, `ImapSetupDialog` |
| Prop types | `[Component]Props` | `EmailTableProps` |
| Context value types | `[Name]ContextValue` | `ActionsContextValue` |
| Query hooks | `use[Resource]` | `useEmails`, `useMailboxes` |
| Mutation hooks | `use[Verb][Resource]` | `useAddAction`, `useMoveEmail` |
| Context accessor hooks | `use[Name]Context` | `useActionsContext()` |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `EMAILS_PER_PAGE`, `KEYTAR_SERVICE` |
| Discriminant strings | `SCREAMING_SNAKE_CASE` | `"MOVE"`, `"DELETE"` |
| Variables / functions | `camelCase` | `fetchEmails`, `rpcGetImapConfig` |

## Code Style Guidelines

### Imports

Biome auto-organizes imports into three groups (do not reorder manually):
1. Third-party libraries (`react`, `@tanstack/*`, `lucide-react`, `sonner`, …)
2. Internal `@/` alias imports (`@/components/…`, `@/lib/…`, `@/contexts/…`)
3. Relative imports (`../../shared/rpc-types`, `./sibling`)

### Components

- Prefer named exports everywhere except route files (TanStack Router requires default exports)
- Keep components focused — extract sub-components when a file grows large
- Use shadcn/ui primitives (Button, Dialog, Table, etc.) before writing custom markup
- Use TanStack Table for all data tables — never build custom `<table>` markup from scratch
- All styling via Tailwind classes — no inline `style` props, no CSS modules

### Contexts

All contexts follow this exact structure:

```ts
export const MyContext = createContext<MyContextValue>(defaultValue);
export function useMyContext() { return useContext(MyContext); }
export function MyContextProvider({ children }: { children: React.ReactNode }) {
  // ...
  return <MyContext value={...}>{children}</MyContext>;
}
```

### TanStack Query

- Query keys are centralized in `src/mainview/lib/query-keys.ts` via `createQueryKeys`
- Spread the key into `useQuery`: `useQuery({ ...emailKeys.byMailbox(path), queryFn: ... })`
- After mutations, use `queryClient.invalidateQueries({ queryKey: keys._def })` — not manual cache writes
- Place query hooks in `hooks/queries/` and mutation hooks in `hooks/mutations/`

## RPC Between Main and Renderer

All cross-process types live in `src/shared/rpc-types.ts`. Define all shared types there.

```ts
// src/bun/rpc.ts — register handlers
export const rpc = BrowserView.defineRPC<CleanMailRPC>({
  handlers: { requests: { fetchEmails: rpcFetchEmails, ... } }
});

// src/mainview/lib/rpc.ts — wrap calls as named exports
import { rpc } from "electrobun/webview";
export const fetchEmails = (params: FetchEmailsParams) => rpc.request.fetchEmails(params);
```

Push messages (bun → webview) use `rpc.send.*`; the renderer registers listeners in `lib/rpc.ts`.

## Error Handling

**Main process (`src/bun/`)** — always return structured result objects, never throw to the caller:

```ts
// Success
return { success: true };
// Failure
return { success: false, error: err instanceof Error ? err.message : String(err) };
```

IMAP operations must always release the mailbox lock in a `finally` block and attempt logout on error:

```ts
const lock = await client.getMailboxLock(path);
try { /* ... */ } finally { lock.release(); }
```

**Renderer (`src/mainview/`)** — surface errors via:
- TanStack Query `isError` / `error` state for query failures
- `toast.error(...)` (Sonner) for user-visible mutation failures
- Check `data?.error` field from RPC responses before using the result

## Electrobun Process Boundaries

- **`src/bun/`** — Bun runtime only. File system, IMAP, keychain, native APIs. No DOM, no React.
- **`src/mainview/`** — WebView (WebKit/Blink). React, all UI. No `Bun.*` or `bun:*` imports.
- **`src/shared/`** — TypeScript types only. No runtime imports from either side.

## Do Not

- Do not run `npm` or `yarn` — always use `bun`
- Do not import `Bun.*` or `bun:*` APIs inside `src/mainview/`
- Do not edit files in `src/mainview/components/ui/` — re-generate via `bunx shadcn@latest add <component>`
- Do not add ESLint or Prettier — Biome is the sole linter/formatter
- Do not use `React.FC` type annotation
- Do not use `any` — use `unknown` and narrow types
- Do not write raw `<table>` markup — use TanStack Table
- Do not use inline `style` props — use Tailwind classes
- Do not edit `src/mainview/routeTree.gen.ts` — it is auto-generated by TanStack Router
