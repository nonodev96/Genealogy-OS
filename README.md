# genealogy.os

> Collaborative family tree editor — Angular 21 · D3.js · Angular Material · IndexedDB

A privacy-first, offline-capable SPA for building and exploring family trees. No server required — everything runs in the browser.

## Features

- **Multiple trees** — create, duplicate, import and export independent genealogy projects
- **Rich person profiles** — name, gender, birth/death dates, biography, photo
- **13 relation types** — parent, child, partner, sibling, adoptive, step, guardian and more
- **D3.js canvas** — interactive SVG tree with zoom, pan, drag-to-reposition, fit-to-screen
- **Undo / redo** — full history per tree with keyboard shortcuts (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Collaboration links** — share read-only or editor tokens via URL; cross-tab sync via `BroadcastChannel`
- **Export** — download as `.svg`, `.txt` or `.json` backup
- **i18n** — English and Spanish, switchable at runtime

## Tech stack

| Layer              | Technology                                 |
| ------------------ | ------------------------------------------ |
| Framework          | Angular 21 (standalone, signals)           |
| UI                 | Angular Material 21                        |
| Visualization      | D3.js v7                                   |
| Storage            | IndexedDB (idb) with LocalStorage fallback |
| i18n               | @ngx-translate/core                        |
| Linter / Formatter | Biome                                      |
| Test runner        | Vitest                                     |
| Package manager    | pnpm                                       |

## Getting started

```bash
# Install dependencies
pnpm install

# Start dev server — http://localhost:4200
pnpm start
```

## Scripts

```bash
pnpm start          # Dev server with live reload
pnpm build          # Production bundle → dist/
pnpm test           # Unit tests (Vitest)
pnpm lint           # Biome lint
pnpm lint:fix       # Biome lint with auto-fix
pnpm format         # Biome format
```

## Project structure

```
src/app/
├── core/
│   ├── models/          # Shared TypeScript types (Person, Relation, FamilyTree…)
│   └── services/
│       ├── storage.service.ts        # IndexedDB + LocalStorage persistence
│       ├── tree.service.ts           # CRUD orchestration + active tree state
│       ├── tree-layout.service.ts    # Auto-layout algorithm from relative edges
│       ├── history.service.ts        # Undo/redo stack per tree
│       ├── export.service.ts         # SVG, plain-text and JSON export
│       └── collaboration.service.ts  # Tokens, sessions, share URLs
├── features/
│   ├── dashboard/                    # Project list — create, import, manage
│   ├── tree-editor/                  # Editor shell + sidebar + D3 canvas
│   │   ├── person-form/              # Add / edit person dialog
│   │   ├── relation-form/            # Add / edit relation dialog
│   │   └── tree-canvas/             # D3 SVG renderer
│   └── collaboration/               # Landing page for shared links
└── shared/
    └── confirm-dialog.component.ts  # Reusable confirmation dialog
```

## Keyboard shortcuts

| Shortcut                  | Action |
| ------------------------- | ------ |
| `Ctrl+Z`                  | Undo   |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo   |

## Relation types

`parentOf` · `childOf` · `partnerOf` · `siblingOf` · `halfSiblingOf` · `ancestorOf` · `descendantOf` · `adoptiveParentOf` · `adoptiveChildOf` · `stepParentOf` · `stepChildOf` · `guardianOf` · `wardOf`
