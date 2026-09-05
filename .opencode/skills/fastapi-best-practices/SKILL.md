# fastapi-best-practices

## Purpose & Use Case
Standards for building production-grade FastAPI applications with async endpoints, Pydantic v2 validation, JWT authentication, and dependency injection. Ensures consistency, performance, and security across all backend services.

## Rules & Standard Workflows
1. **Async Endpoints**: All I/O-bound endpoint functions must be `async def`. CPU-bound work must be offloaded to a thread pool via `run_in_executor` or moved to a background task.
2. **Pydantic v2 Validation**: All request bodies must be validated using Pydantic v2 `BaseModel`. Use `Field(..., description=...)` for documentation. Validate response models explicitly; never return raw dicts from endpoints.
3. **JWT Authentication**: Implement authentication via a `Depends(get_current_user)` dependency. The dependency must: decode the JWT from the `Authorization: Bearer <token>` header, verify the token signature using a secret key, check token expiry (`exp` claim), and raise `HTTPException(status_code=401, detail="Unauthorized")` on failure.
4. **Dependency Injection**: Use FastAPI's `Depends` for database sessions, authentication, and service layer injection. Database sessions must be scoped per-request using a generator function with `yield` and proper cleanup in a `try...finally` block.
5. **Error Handling**: All endpoints must use `HTTPException` for error responses. Use custom exception handlers for consistent error formatting. Never expose raw stack traces to clients.
6. **OpenAPI Documentation**: Ensure all endpoints have `summary`, `description`, and `response` examples. Use `response_model` parameter to automatically generate correct schemas.

## Best Practices & Guardrails
- Use `settings` class (pydantic-settings) for configuration management; never hardcode secrets.
- Configure `allow_origins` dynamically from environment variables for CORS; never use `["*"]` in production.
- Log authentication failures via structured logging (include JWT subject ID but mask the token).
- Keep endpoint handler functions minimal: delegate business logic to service layer functions.

## Skill Invocation
- Trigger when: a user says "create FastAPI endpoint", "fix auth issue", or "optimize performance".
- Response must include: checking Pydantic v2 models, JWT dependency structure, and async/await usage compliance.