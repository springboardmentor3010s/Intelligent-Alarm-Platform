# ml-pipeline-inference

## Purpose & Use Case
PyTorch/Scikit-learn inference wrappers, model evaluation, and cache optimization for the cognitive challenge engine and adaptive difficulty system. Ensures low-latency inference and reliable model serving.

## Rules & Standard Workflows
1. **Model Loading**: All models must be loaded at application startup using `torch.load()` or `joblib.load()` and stored in a global singleton. Models must be moved to the correct device (`torch.device("cuda" if torch.cuda.is_available() else "cpu")`).
2. **Inference API**: Expose a single `infer(input_data)` function that preprocesses input, runs model.forward(), and postprocesses output. The function must handle `torch.no_grad()` context for evaluation mode.
3. **Scikit-learn Integration**: Classical ML models (XGBoost, Scikit-learn) must be serialized with `joblib` and wrapped in a `predict_proba()`-compatible interface for consistency with PyTorch models.
4. **Cache Optimization**: Implement LRU caching (`functools.lru_cache`) for repeated predictions with identical input. For production, use Redis or in-memory cache with TTL for hot challenge predictions.
5. **Model Evaluation**: Expose `evaluate(test_dataset)` that returns a dictionary of metrics: accuracy, precision, recall, F1-score, and confusion matrix heatmap data.

## Best Practices & Guardrails
- Use `torch.compile()` or JIT scripting for performance-critical inference paths.
- Normalize all input data using the same scaler fit during training; never apply transformations inline without the fitted scaler.
- Log inference latency (p50, p95, p99) via structured metrics. Alert if p95 latency exceeds 200ms.
- Keep model files under `models/` directory with version tags (e.g., `challenge_v1.2.pt`).
- Validate input shapes against expected model input dimensions before running inference.

## Skill Invocation
- Trigger when: a user says "run inference", "evaluate model", or "optimize latency".
- Response must include: model loading pattern, inference wrapper structure, and cache strategy reference.