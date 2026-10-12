import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.ml_sd_engine import ml_boost_model, sd_boost_model

print("=== Testing ML & SD Boost Engine ===")

# Test dataset of attempts
sample_attempts = [
    {"response_time": 12.5, "correct": True, "time_limit": 25.0, "current_streak": 2, "difficulty_score": 0.5},
    {"response_time": 11.8, "correct": True, "time_limit": 25.0, "current_streak": 3, "difficulty_score": 0.52},
    {"response_time": 10.2, "correct": True, "time_limit": 25.0, "current_streak": 4, "difficulty_score": 0.55},
    {"response_time": 9.5, "correct": True, "time_limit": 25.0, "current_streak": 5, "difficulty_score": 0.58},
    {"response_time": 9.8, "correct": True, "time_limit": 25.0, "current_streak": 6, "difficulty_score": 0.61},
    {"response_time": 9.1, "correct": True, "time_limit": 25.0, "current_streak": 7, "difficulty_score": 0.64},
]

# 1. Test ML Boost Training and Prediction
trained = ml_boost_model.train_on_history(sample_attempts)
print(f"ML Model Trained: {trained}")

ml_pred = ml_boost_model.predict_performance(sample_attempts, current_streak=7, hour_of_day=7, current_score=0.64)
print("\n--- ML Boost Prediction ---")
print(f"ML Model Name: {ml_pred.get('model_name', 'N/A')}")
print(f"Predicted Response Time: {ml_pred['predicted_response_time']} seconds")
print(f"Wakefulness Index: {ml_pred['wakefulness_index']}%")
print(f"ML Boost Delta: {ml_pred['ml_boost']}")

# 2. Test SD Boost Computation
sd_res = sd_boost_model.compute_sd_metrics(sample_attempts)
print("\n--- SD Boost Metrics ---")
print(f"Standard Deviation (sigma): {sd_res['std_dev_response_time']} seconds")
print(f"Mean Response Time: {sd_res['mean_response_time']} seconds")
print(f"Cognitive Stability Index (CSI): {sd_res['cognitive_stability_index']}%")
print(f"SD Boost Delta: {sd_res['sd_boost']}")
print(f"SD Boost Active: {sd_res['sd_boost_active']}")

print("\n=== ML & SD Boost Engine Verification Successful! ===")
