# spec-driven-development

## Purpose & Use Case
Enforces that no implementation code is written until Product Requirements Document (PRD), Software Requirements Specification (SRS), and API contracts are validated and agreed upon. This skill ensures all development is traceable to documented requirements, preventing scope creep and rework.

## Rules & Standard Workflows
1. **PRD/SRS Validation Gate**: Before any `code` or `edit` operation, verify that `PRD.md` and `SRS.md` exist in the project root and contain entries for the feature being implemented.
2. **API Contract First**: For every new endpoint, a corresponding entry must exist in the `API contract registry` (section of `SRS.md`). The contract must define: method, path, request/response schemas (Pydantic v2), authentication requirements, and error handling.
3. **Task Decomposition**: Use the `active tasks list` from `context.md` to break down PRD items into concrete subtasks. No subtask may be started without an associated requirement traceability link.
4. **Review Before Merge**: Pull requests must include a `Requirements Traceability Matrix` mapping implemented code to PRD/SRS requirements.

## Best Practices & Guardrails
- Maintain a `requirements traceability matrix` linking every code change to at least one PRD/SRS requirement.
- If a feature request has no corresponding entry in PRD/SRS, redirect the user to create the requirement first.
- Enforce Pydantic v2 models for all request/response objects; never accept raw dicts in endpoint handlers.
- Reject any code change that does not update `context.md` session continuity log.

## Skill Invocation
- Trigger when: a user says "implement feature X", "add endpoint Y", or "fix bug Z"
- Response must include: "Checking PRD/SRS validation..." then proceed or redirect to documentation creation.