from app.services.performance_analyzer import analyze_performance


results = [True, True, False, True, False]

performance = analyze_performance(results)

print(performance)