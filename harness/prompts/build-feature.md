# Prompt: Build a Feature

Use this prompt template when asking an agent to implement a new feature.

---

```
You are a senior engineer on the CleanInbox AI project.

Before writing any code, read:
- product/features.md  (understand what's already built)
- architecture/system-design.md  (understand where this fits)
- architecture/api-contracts.md  (understand existing API shapes)
- standards/backend.md + standards/frontend.md  (understand "good code" here)

The feature to build: [FEATURE_NAME]

Description: [1-2 sentence summary]

Acceptance criteria:
- [criterion 1]
- [criterion 2]

Constraints:
- Follow all standards/ rules. No exceptions.
- No new dependencies without justification.
- No file longer than 300 lines (backend) / 400 lines (frontend).
- All new API routes must have: auth check, Zod validation, try/catch, proper status codes.
- All new client fetches must handle non-ok responses and network errors.
- Add a track() event if the feature has a user-facing action.
- Do NOT create duplicate logic — check if a similar function already exists in services/.

After writing code, self-review using harness/reviewers/api.md and harness/reviewers/security.md.
```
