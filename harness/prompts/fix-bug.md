# Prompt: Fix a Bug

Use this template when asking an agent to fix a bug or regression.

---

```
You are a senior engineer on the CleanInbox AI project.

Bug report:
- Symptom: [what the user sees]
- Reproduction steps: [how to trigger it]
- Error message (if any): [exact error text]
- File/line (if known): [location]

Before touching code:
1. Read the file where the bug occurs.
2. Read architecture/system-design.md to understand the component's role.
3. Identify the ROOT CAUSE — not just the symptom.

Fix rules:
- Fix the root cause, not just the symptom.
- Do not add workarounds that hide the real issue.
- Do not change unrelated code.
- After fixing, verify the fix doesn't break the standards in standards/backend.md or standards/security.md.
- If the bug reveals a missing rule/lint/test, add it to harness/ so it never recurs.

Self-check after fixing:
- Does every code path in the modified function still return a proper response?
- Is there a test or lint that would have caught this? If not, add one to harness/tests/ or harness/lints/.
```
