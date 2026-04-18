# Frontend Standards

## Component Rules

- All components using React hooks must have `'use client'` at the top.
- Server Components default — only add `'use client'` when you need hooks or browser APIs.
- No file longer than 400 lines. Extract sub-components to `src/app/<page>/components/`.
- Shared/reusable components go in `src/components/`.
- Page-specific components go in `src/app/<page>/components/`.

## State Management

- No global state library. Local `useState` + `useEffect` is sufficient for this app.
- Derived values should be `useMemo`, not `useState`. If a value can be computed from other state, don't store it separately.
- Async operations: set loading state before the call, clear it in `finally`.

## Fetch Pattern

Always handle the failure case:
```ts
fetch('/api/endpoint')
  .then(r => r.ok ? r.json() : fallbackValue)
  .then(data => setState(data))
  .catch(() => setState(fallbackValue));
```
Never call `.json()` without checking `r.ok` first.

## Analytics

Every meaningful user action must call `track()` from `src/lib/analytics.ts`.
Named events: `cta_connect_clicked`, `gmail_connected`, `preview_generated`, `apply_safe_clicked`, `apply_success`, `upgrade_clicked`, `upgrade_shown`.
When adding a new flow step, add a named track event.

## Styling

- Bootstrap 5 utility classes for layout and spacing.
- Dark terminal theme via `cleaner.module.css`. Do not inline styles for anything that repeats.
- Inline styles (`style={{}}`) only for one-off dynamic values (colors from data, widths from state).
- No Tailwind. No CSS-in-JS.

## Clerk Integration

- `useAuth()` is the only hook needed in most cases — gives `{ isLoaded, userId }`.
- Always guard renders with `if (!isLoaded) return null` or similar before reading `userId`.
- Import from `@clerk/nextjs` (client) or `@clerk/nextjs/server` (server/API routes). Never `@clerk/react`.

## TypeScript

- Strict mode is on. No `any` unless unavoidable (external library boundary).
- Domain types live in `src/types/`. Import from there — never redefine.
- Use `unknown` over `any` for parsed external data, then narrow with type guards or Zod.
