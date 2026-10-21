"""
ml/train.py

Training script for the XGBoost Cognitive Wake-Up Readiness Model.
Runs train/test split validation, computes performance metrics,
and saves the trained model artifact to ml/models/xgboost_readiness.joblib.
"""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.xgboost_model import train_xgboost_model, MODEL_PATH, METRICS_PATH


def main():
    print("=" * 60)
    print("Training XGBoost Cognitive Wake-Up Readiness Model...")
    print("=" * 60)

    model, metrics = train_xgboost_model(save=True)

    print(f"Algorithm:       {metrics['algorithm']}")
    print(f"Total Samples:   {metrics['n_samples']}")
    print(f"Train Samples:   {metrics['train_samples']}")
    print(f"Test Samples:    {metrics['test_samples']}")
    print("-" * 60)
    print(f"Accuracy:        {metrics['accuracy'] * 100:.2f}%")
    print(f"Precision:       {metrics['precision'] * 100:.2f}%")
    print(f"Recall:          {metrics['recall'] * 100:.2f}%")
    print(f"F1-Score:        {metrics['f1_score'] * 100:.2f}%")
    print(f"ROC-AUC:         {metrics['roc_auc']:.4f}")
    print("-" * 60)
    print("Feature Importances:")
    for feature, imp in metrics["feature_importances"].items():
        print(f"  - {feature:25s}: {imp * 100:.2f}%")
    print("-" * 60)
    print(f"Model saved to:   {MODEL_PATH}")
    print(f"Metrics saved to: {METRICS_PATH}")
    print("=" * 60)
    print("Training complete successfully!")


if __name__ == "__main__":
    main()