# context-memory-manager

## Purpose & Use Case
Enforces continuous state maintenance in `context.md` across all LLM turns. If the LLM session context resets or runs out of tokens, reading `context.md` must restore exact project state, active tasks, directory layout, database schema specifications, and next immediate implementation steps without losing information.

## Rules & Standard Workflows
1. **Context Persistence**: After every task completion, automatically update `context.md` with: current directory layout, active task status, just completed steps, and next immediate steps.
2. **Session Recovery**: On new session start, first read `context.md`. If it exists, restore project state before proceeding with any new operations.
3. **Task Lifecycle Tracking**: Each task in the active tasks list must have exactly one of three statuses: `pending`, `in_progress`, or `completed`. Never allow ambiguous states.
4. **Cross-Turn Continuity**: No information about the project structure, database schemas, or API contracts may be lost between LLM turns. If uncertain, reference `context.md` before proceeding.

## Best Practices & Guardrails
- Maintain a `session continuity log` section in `context.md` that records: timestamp, actor (human/LLM), action taken, and outcome.
- Before writing any file or making any code change, verify the action aligns with the last recorded state in `context.md`.
- If `context.md` is missing or outdated, halt operations and request project state restoration.
- Use atomic updates: when modifying `context.md`, write to a temp file first, then rename to avoid corruption.

## Skill Invocation
- Trigger at the start of every new task or when session context is suspected to have reset.
- Response must include: "Reading context.md to restore project state..." then display the key sections or confirm state restoration.