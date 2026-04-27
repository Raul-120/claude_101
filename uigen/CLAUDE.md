# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps + prisma generate + prisma migrate
npm run dev          # Dev server with Turbopack (requires ./node-compat.cjs)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit/component tests
npm run db:reset     # Reset SQLite database
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Environment

Copy `.env.example` to `.env`. `ANTHROPIC_API_KEY` is optional — when absent, the app runs with a `MockLanguageModel` that returns predefined component templates.

## Architecture

UIGen is a Next.js 15 App Router app where users describe React components in natural language and Claude generates working code with a live preview.

### Request flow

1. User types a message → `ChatContext` (`src/lib/contexts/chat-context.tsx`) calls `POST /api/chat`
2. `src/app/api/chat/route.ts` streams responses via Vercel AI SDK `streamText()` using two tools:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — create/edit/view files
   - `file_manager` (`src/lib/tools/file-manager.ts`) — manage files/directories
3. Tool call results update the `VirtualFileSystem` (in-memory only, no disk writes) via `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`)
4. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) transpiles generated JSX client-side with `@babel/standalone` and renders the live preview

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is the central data structure — all generated files live in memory. The entry point for generated components is always `/App.jsx`. Local imports use the `@/` alias. The VFS is serialized to JSON and stored in the `Project.data` field in SQLite for authenticated users.

### AI provider

`src/lib/provider.ts` exports `getLanguageModel()` which returns a real Anthropic client (claude-haiku-4-5) or `MockLanguageModel` when no API key is present. The system prompt lives in `src/lib/prompts/generation.tsx` and is sent with ephemeral cache control for prompt caching.

### Authentication

JWT sessions (7-day expiry), httpOnly cookies, bcrypt passwords. All auth utilities are server-only (`src/lib/auth.ts`). Server Actions in `src/actions/` handle project CRUD. Anonymous usage is supported — anonymous work is tracked via `src/lib/anon-work-tracker.ts`.

### Database

Prisma with SQLite. Two models: `User` and `Project` (messages and VFS data stored as JSON columns). Schema: `prisma/schema.prisma`.

### Path alias

`@/*` resolves to `src/*` (configured in `tsconfig.json` and `vitest.config.mts`).

### Key layout files

- `src/app/page.tsx` — home; redirects authenticated users to their latest project
- `src/app/[projectId]/page.tsx` — per-project view
- `src/app/main-content.tsx` — the interactive builder (resizable panels: chat | editor/preview)
