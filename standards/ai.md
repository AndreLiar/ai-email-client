# AI Standards

## Model Usage

- Always use the model selector in `src/services/ai.ts`. Never instantiate `google()` or `groq()` directly in route handlers.
- Primary: Gemini 2.0 Flash. Fallback: Groq (llama-3.3-70b-versatile or equivalent).
- Model selection is configuration, not logic. If the model changes, only `ai.ts` changes.

## Structured Output

- Use Zod schemas + `generateObject()` for any AI call that produces structured data (classifications, decisions).
- Never parse JSON from raw text output with `JSON.parse`. Use `generateObject` or `generateText` with strict schemas.
- Every AI output schema must have a fallback/default for optional fields.

## Classification

- Sender categories: `newsletter | job_alert | promo | social | transactional | other`.
- Classification is batch — never classify one sender at a time.
- Confidence scores are floats 0–1. Thresholds: delete ≥ 0.9, archive ≥ 0.75.

## Decision Engine

- Input: Gmail query + limit → fetch messages → extract metadata → AI classify → score → return decisions.
- Decisions: `delete | archive | keep | reply`.
- The engine is stateless. It does not write to DB. The route that calls it writes the preview.
- `dropped` count must be tracked and persisted — it represents metadata fetch failures.

## Prompt Hygiene

- System prompts live in `src/services/ai.ts`. No inline prompt strings in route handlers.
- Prompts must include: role, task, constraints, output format.
- Never include user email content verbatim in prompts beyond what's needed for classification.

## Safety

- The decision engine applies `highRiskKeywords` check before allowing `reply` actions.
- Replies are only allowed when `allowReply: true` in the policy.
- If a decision has action `reply` but no `replyDraft`, it is downgraded to `keep` at execution time.
- The AI output is always reviewed by `filterDecisionsByPolicy()` before being returned to the client. Raw AI output is never sent directly.
