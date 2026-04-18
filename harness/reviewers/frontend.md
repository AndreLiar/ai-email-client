# Frontend Reviewer Checklist

Run this against every PR touching `src/app/` components or pages.

## Client Components
- [ ] Every file using hooks has `'use client'` as the first line
- [ ] No hooks used in Server Components
- [ ] Clerk imports from `@clerk/nextjs`, never `@clerk/react`
- [ ] `useAuth()` guarded with `if (!isLoaded) return null` before rendering userId-dependent content

## Fetch Pattern
- [ ] Every `fetch()` checks `r.ok` before calling `.json()`
- [ ] Every `fetch()` has a `.catch()` or try/catch with a fallback state
- [ ] No unhandled promise rejections from fetch calls

## State
- [ ] No derived state stored in `useState` if it can be `useMemo`
- [ ] Async operations: loading state set before call, cleared in `finally`
- [ ] Optimistic UI for delete/unsubscribe (sender removed immediately)

## Analytics
- [ ] Every new user-facing action calls `track()` from `src/lib/analytics.ts`
- [ ] Event name follows existing naming convention (snake_case verbs)

## Component Size
- [ ] No file exceeds 400 lines
- [ ] Page-specific sub-components extracted to `src/app/<page>/components/`

## Copy / UX
- [ ] Copy accurately reflects what the code actually does (no stale descriptions)
- [ ] Loading states visible to the user for all async operations
- [ ] Error states shown to user (not just console.error)
