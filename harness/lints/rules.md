# Lint Rules

These are structural rules enforced manually (or by future CI scripts). Each rule was added to prevent a known failure pattern.

## File Size
- No backend service file (`src/services/`) > 300 lines
- No frontend page/component file > 400 lines
- Enforcement: `wc -l src/services/*.ts` and `wc -l src/app/**/*.tsx`

## Missing Error Handling
- Every `fetch()` call must have `.catch()` or be in a try/catch
- Every route handler must have a top-level try/catch
- Detection: grep for `fetch(` without adjacent `.catch\|try {`

## Auth Bypass
- Every file in `src/app/api/agent/` must contain `await auth()`
- Detection: `grep -rL "await auth()" src/app/api/agent/`

## Direct DB Access
- No `import.*from.*drizzle` in `src/app/api/`
- Detection: `grep -r "from 'drizzle-orm'" src/app/api/`

## Module-Level Throws
- No `throw new Error` at the top level of a service module (outside a function)
- Use lazy init pattern instead (see `getStripe()`)
- Detection: grep for `^throw ` or `^if (!` followed by `throw` outside function scope

## Hardcoded URLs
- No `http://localhost` in source files outside `.env*`
- No hardcoded price IDs (`price_`) in source files
- Detection: `grep -r "localhost:3000\|price_placeholder" src/`

## Clerk Import
- No `from '@clerk/react'` anywhere in `src/`
- Detection: `grep -r "from '@clerk/react'" src/`

## Missing Track Event
- Any new button with `onClick` in a cleaner page component should call `track()`
- Manual check during PR review

## TypeScript
- `npx tsc --noEmit` must pass with 0 errors before merge
- No `// @ts-ignore` added without a comment explaining why
