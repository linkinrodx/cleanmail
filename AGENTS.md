# CleanMail – Agent Guide

CleanMail is a desktop webmail client cleaner built with Electrobun, React, and the TanStack stack.

## Tech Stack

| Layer | Technology |
|---|---|
| Package manager | [Bun](https://bun.sh) |
| Desktop runtime | [Electrobun](https://github.com/blackboardsh/electrobun) (not Electron) |
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
│   │   └── index.ts          # Entry point: creates windows, registers RPC handlers
│   └── mainview/             # Renderer / webview (React + Vite)
│       ├── components/       # Shared React components
│       │   └── ui/           # shadcn/ui generated components (do not hand-edit)
│       ├── routes/           # TanStack Router file-based routes
│       ├── lib/              # Utilities, helpers, query client setup
│       ├── App.tsx           # Router outlet + providers
│       ├── main.tsx          # React entry point
│       ├── index.html        # HTML shell
│       └── index.css         # Tailwind base styles
├── electrobun.config.ts      # App metadata, window defaults
├── vite.config.ts            # Vite + React plugin config
├── tailwind.config.js        # Tailwind theme overrides
├── tsconfig.json
└── package.json
```

## Key Concepts

### Electrobun processes

Electrobun separates two runtimes:

- **Main process** (`src/bun/`) – runs in Bun, has access to the file system, native APIs, and controls windows. No DOM.
- **Renderer / webview** (`src/mainview/`) – runs in a system WebView (WebKit/Blink), contains all React code. No direct Node/Bun APIs.

Communication between them is done via **typed RPC** defined in the main process and called from the webview (or vice versa).

### Development commands

```bash
bun install            # Install dependencies
bun run dev            # Dev without HMR (loads bundled assets)
bun run dev:hmr        # Dev with Vite HMR (recommended during UI work)
bun run build          # Production build
bun run build:prod     # Production release build
```

### Adding shadcn components

```bash
bunx shadcn@latest add <component>
```

Components are placed in `src/mainview/components/ui/`. Do not manually edit generated files; re-run the command to update.

### Adding TanStack Router routes

TanStack Router uses file-based routing. Add a file under `src/mainview/routes/` following the naming convention:

```
routes/
  __root.tsx            # Root layout
  index.tsx             # / route
  inbox/
    index.tsx           # /inbox route
    $accountId.tsx      # /inbox/:accountId dynamic segment
```

Run `bun run dev:hmr` and the route tree is auto-generated.

### TanStack Query conventions

- Create query/mutation hooks in `src/mainview/lib/queries/` co-located by domain (e.g. `emails.ts`, `accounts.ts`).
- Use `queryClient.invalidateQueries` after mutations instead of manual cache writes unless performance demands otherwise.
- Wrap the app with `<QueryClientProvider>` in `main.tsx`.

## Coding Conventions

- **TypeScript strict mode** is enabled. Avoid `any`; use `unknown` and narrow types.
- **Tailwind** for all styling. No inline styles, no CSS modules.
- **shadcn/ui** as the first choice for UI primitives (Button, Dialog, Table, etc.).
- **TanStack Table** for any data table – do not build custom table markup from scratch.
- File names: `kebab-case` for files/directories, `PascalCase` for React component files that export a single component.
- Prefer named exports over default exports except for route files (TanStack Router requires default exports).
- Keep main-process code (`src/bun/`) free of any React or DOM imports.

## RPC Between Main and Renderer

Define typed RPC handlers in `src/bun/index.ts` using the Electrobun RPC API and call them from the renderer via the generated types. Example pattern:

```ts
// src/bun/index.ts
electrobun.rpc.define("getAccounts", async () => { /* ... */ });

// src/mainview/lib/rpc.ts
import { rpc } from "electrobun/webview";
export const getAccounts = () => rpc.call("getAccounts");
```

## Do Not

- Do not run `npm` or `yarn` – always use `bun`.
- Do not import Bun-specific APIs (`Bun.*`, `bun:*`) inside `src/mainview/`.
- Do not modify files in `src/mainview/components/ui/` directly; re-generate via `bunx shadcn`.
- Do not use `React.FC` type annotation – prefer explicit prop type + return type.
