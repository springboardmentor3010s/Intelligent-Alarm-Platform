from app.services.adaptive_service import get_next_difficulty


results = [True, True, False, True, True]

result = get_next_difficulty(
    "medium",
    results
)

print(result)