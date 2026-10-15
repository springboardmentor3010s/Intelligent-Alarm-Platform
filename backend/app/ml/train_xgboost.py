"""
XGBoost Training and Evaluation Pipeline.

Trains an XGBoost Classifier for On-Time Wake-Up Prediction using
strict chronological train/test splitting and leakage prevention.

Saves:
- Model artifact: backend/app/ml/models/xgb_wake_model.joblib
- Metadata & Evaluation Metrics: backend/app/ml/models/model_metadata.json
"""

import os
import json
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    log_loss,
    brier_score_loss,
    confusion_matrix,
)
import joblib
from xgboost import XGBClassifier

import sys

base_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if base_backend_dir not in sys.path:
    sys.path.insert(0, base_backend_dir)

from app.ml.dataset_generator import generate_benchmark_dataset, CHALLENGE_TYPES


FEATURE_NUMERICAL = [
    "alarm_hour",
    "alarm_minute",
    "alarm_time_minutes",
    "sin_alarm_time",
    "cos_alarm_time",
    "day_of_week",
    "is_weekend",
    "difficulty_num",
    "preferred_wake_minutes",
    "schedule_diff_minutes",
    "sleep_duration_hours",
    "prior_habit_score",
    "prior_snooze_rate",
    "prior_avg_response_time",
]

FEATURE_CATEGORICAL = [
    "challenge_type",
]

ALL_FEATURES = FEATURE_NUMERICAL + FEATURE_CATEGORICAL
TARGET_COL = "on_time_wakeup"


def train_and_evaluate_model(
    csv_path: str = None,
    output_dir: str = None,
    test_ratio: float = 0.2,
) -> dict:
    base_dir = os.path.dirname(os.path.abspath(__file__))

    if csv_path is None or not os.path.exists(csv_path):
        data_dir = os.path.join(base_dir, "data")
        csv_path = os.path.join(data_dir, "synthetic_benchmark_dataset.csv")
        if not os.path.exists(csv_path):
            print("[XGBoost Train] Benchmark dataset not found. Generating...")
            generate_benchmark_dataset(output_path=csv_path)

    if output_dir is None:
        output_dir = os.path.join(base_dir, "models")
    os.makedirs(output_dir, exist_ok=True)

    print(f"[XGBoost Train] Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)

    # 1. Chronological Sorting (Mandatory for longitudinal event prediction)
    if "event_timestamp" in df.columns:
        df["event_timestamp"] = pd.to_datetime(df["event_timestamp"])
        df = df.sort_values(by="event_timestamp").reset_index(drop=True)

    X = df[ALL_FEATURES]
    y = df[TARGET_COL].astype(int)

    # 2. Chronological Train / Test Split
    split_idx = int(len(df) * (1.0 - test_ratio))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"[XGBoost Train] Total samples: {len(df)}")
    print(f"[XGBoost Train] Training samples (chronological 80%): {len(X_train)} (Positive: {y_train.mean():.1%})")
    print(f"[XGBoost Train] Test samples (chronological 20%): {len(X_test)} (Positive: {y_test.mean():.1%})")

    # 3. Preprocessor Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(categories=[CHALLENGE_TYPES], handle_unknown="ignore", sparse_output=False),
                FEATURE_CATEGORICAL,
            ),
            ("num", "passthrough", FEATURE_NUMERICAL),
        ]
    )

    # 4. MODEL 1: XGBoost Wake-Up Classifier
    classifier = XGBClassifier(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        gamma=0.1,
        min_child_weight=2,
        eval_metric="logloss",
        random_state=42,
    )

    pipeline_wake = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    print("[XGBoost Train] Training wake-up prediction model...")
    pipeline_wake.fit(X_train, y_train)

    y_pred = pipeline_wake.predict(X_test)
    y_prob = pipeline_wake.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    bal_acc = float(balanced_accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    auc = float(roc_auc_score(y_test, y_prob))
    brier = float(brier_score_loss(y_test, y_prob))
    loss = float(log_loss(y_test, y_prob))
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

    preprocessor_step = pipeline_wake.named_steps["preprocessor"]
    cat_names = list(preprocessor_step.named_transformers_["cat"].get_feature_names_out(FEATURE_CATEGORICAL))
    transformed_feature_names = cat_names + FEATURE_NUMERICAL

    importances = pipeline_wake.named_steps["classifier"].feature_importances_
    importance_dict = {
        name: round(float(imp), 4)
        for name, imp in sorted(zip(transformed_feature_names, importances), key=lambda x: x[1], reverse=True)
    }

    metrics = {
        "accuracy": round(acc, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(auc, 4),
        "brier_score": round(brier, 4),
        "log_loss": round(loss, 4),
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
        },
    }

    # 5. MODEL 2: XGBoost Adaptive Difficulty Classifier (Multiclass: 0=decrease, 1=maintain, 2=increase)
    diff_metrics = {}
    pipeline_diff = None
    if "recommended_difficulty_action" in df.columns:
        y_diff = df["recommended_difficulty_action"].astype(int)
        y_diff_train, y_diff_test = y_diff.iloc[:split_idx], y_diff.iloc[split_idx:]

        diff_classifier = XGBClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="multi:softprob",
            num_class=3,
            eval_metric="mlogloss",
            random_state=42,
        )

        pipeline_diff = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("classifier", diff_classifier),
            ]
        )

        print("[XGBoost Train] Training adaptive difficulty classifier...")
        pipeline_diff.fit(X_train, y_diff_train)

        y_diff_pred = pipeline_diff.predict(X_test)
        diff_acc = float(accuracy_score(y_diff_test, y_diff_pred))
        diff_bal_acc = float(balanced_accuracy_score(y_diff_test, y_diff_pred))
        diff_f1 = float(f1_score(y_diff_test, y_diff_pred, average="weighted", zero_division=0))

        diff_metrics = {
            "accuracy": round(diff_acc, 4),
            "balanced_accuracy": round(diff_bal_acc, 4),
            "weighted_f1_score": round(diff_f1, 4),
            "class_labels": {0: "decrease", 1: "maintain", 2: "increase"},
        }
        print(f"[XGBoost Train] Difficulty Model -> Accuracy: {diff_acc:.4f}, Balanced Acc: {diff_bal_acc:.4f}, F1: {diff_f1:.4f}")

    # 6. MODEL 3: XGBoost Behavioral Score Regressor (0.0 to 100.0)
    behavior_metrics = {}
    pipeline_behavior = None
    if "target_behavior_score" in df.columns:
        from xgboost import XGBRegressor
        from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

        y_beh = df["target_behavior_score"].astype(float)
        y_beh_train, y_beh_test = y_beh.iloc[:split_idx], y_beh.iloc[split_idx:]

        beh_regressor = XGBRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.06,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="reg:squarederror",
            random_state=42,
        )

        pipeline_behavior = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("regressor", beh_regressor),
            ]
        )

        print("[XGBoost Train] Training behavioral score regressor...")
        pipeline_behavior.fit(X_train, y_beh_train)

        y_beh_pred = pipeline_behavior.predict(X_test)
        mse = float(mean_squared_error(y_beh_test, y_beh_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_beh_test, y_beh_pred))
        r2 = float(r2_score(y_beh_test, y_beh_pred))

        behavior_metrics = {
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "r2_score": round(r2, 4),
        }
        print(f"[XGBoost Train] Behavioral Regressor -> RMSE: {rmse:.4f}, MAE: {mae:.4f}, R2: {r2:.4f}")

    print("\n" + "=" * 55)
    print("XGBOOST MODEL EVALUATION RESULTS (CHRONOLOGICAL TEST SET)")
    print("=" * 55)
    print(f"Wake ROC-AUC Score:      {metrics['roc_auc']:.4f}")
    print(f"Wake F1 Score:           {metrics['f1_score']:.4f}")
    print(f"Wake Precision:          {metrics['precision']:.4f}")
    print(f"Wake Recall:             {metrics['recall']:.4f}")
    print(f"Wake Balanced Accuracy:  {metrics['balanced_accuracy']:.4f}")
    print(f"Wake Brier Score:        {metrics['brier_score']:.4f}")
    print(f"Wake Log Loss:           {metrics['log_loss']:.4f}")
    if diff_metrics:
        print(f"Diff Accuracy:           {diff_metrics['accuracy']:.4f}")
    if behavior_metrics:
        print(f"Behavior R2 Score:       {behavior_metrics['r2_score']:.4f}")
    print("Top Predictive Features:")
    for feat, imp in list(importance_dict.items())[:6]:
        print(f"  - {feat}: {imp:.4f}")
    print("=" * 55 + "\n")

    # 7. Save Artifacts & Metadata
    wake_model_path = os.path.join(output_dir, "xgb_wake_model.joblib")
    diff_model_path = os.path.join(output_dir, "xgb_difficulty_model.joblib")
    behavior_model_path = os.path.join(output_dir, "xgb_behavior_regressor.joblib")
    metadata_path = os.path.join(output_dir, "model_metadata.json")

    joblib.dump(pipeline_wake, wake_model_path)
    if pipeline_diff is not None:
        joblib.dump(pipeline_diff, diff_model_path)
    if pipeline_behavior is not None:
        joblib.dump(pipeline_behavior, behavior_model_path)

    metadata = {
        "model_version": "1.0.0",
        "algorithm": "XGBoost Behavioral Intelligence Suite (Classifier + Regressor)",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_origin": "synthetic_circadian_benchmark",
        "dataset_notice": (
            "Model was trained on a reproducible synthetic circadian benchmark dataset. "
            "It establishes verified ML pipeline mechanics and baseline behavioral relationships. "
            "Does not represent real-world clinical precision."
        ),
        "dataset_stats": {
            "total_records": len(df),
            "train_records": len(X_train),
            "test_records": len(X_test),
            "train_positive_ratio": round(float(y_train.mean()), 4),
            "test_positive_ratio": round(float(y_test.mean()), 4),
        },
        "target_definition": {
            "target_variable": TARGET_COL,
            "label_1": "On-Time Prompt Wakeup (snooze_count == 0 and completed with response_time <= 60s)",
            "label_0": "Delayed / At-Risk Wakeup (snooze_count >= 1, response_time > 60s, or expired)",
        },
        "features": {
            "numerical": FEATURE_NUMERICAL,
            "categorical": FEATURE_CATEGORICAL,
            "all_features": ALL_FEATURES,
        },
        "metrics": metrics,
        "difficulty_model_metrics": diff_metrics,
        "behavior_regressor_metrics": behavior_metrics,
        "models": {
            "wake_prediction": {"artifact": "xgb_wake_model.joblib", "metrics": metrics},
            "adaptive_difficulty": {"artifact": "xgb_difficulty_model.joblib", "metrics": diff_metrics},
            "behavior_regressor": {"artifact": "xgb_behavior_regressor.joblib", "metrics": behavior_metrics},
        },
        "feature_importances": importance_dict,
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[XGBoost Train] Saved wake model artifact to: {wake_model_path}")
    if pipeline_diff is not None:
        print(f"[XGBoost Train] Saved difficulty model artifact to: {diff_model_path}")
    if pipeline_behavior is not None:
        print(f"[XGBoost Train] Saved behavior model artifact to: {behavior_model_path}")
    print(f"[XGBoost Train] Saved metadata to: {metadata_path}")

    return {
        "wake_model_path": wake_model_path,
        "diff_model_path": diff_model_path,
        "behavior_model_path": behavior_model_path,
        "metadata_path": metadata_path,
        "metrics": metrics,
        "difficulty_metrics": diff_metrics,
        "behavior_metrics": behavior_metrics,
        "feature_importances": importance_dict,
    }


if __name__ == "__main__":
    train_and_evaluate_model()
