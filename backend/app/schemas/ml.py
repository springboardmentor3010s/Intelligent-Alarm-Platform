"""
Pydantic schemas for ML Wake-Up Prediction endpoints.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PredictionInsightItem(BaseModel):
    factor: str
    impact: str  # "Positive", "Negative", "Neutral"
    description: str


class WakeUpPredictionResponse(BaseModel):
    alarm_id: Optional[int] = None
    alarm_name: Optional[str] = None
    alarm_time: Optional[str] = None
    prediction: str = Field(..., description="'ON_TIME' or 'DELAYED_RISK'")
    on_time_probability: float = Field(..., ge=0.0, le=1.0, description="Probability between 0.0 and 1.0")
    risk_probability: float = Field(..., ge=0.0, le=1.0, description="Risk probability between 0.0 and 1.0")
    prediction_source: str = Field(
        ...,
        description="'synthetic_benchmark_model', 'real_validated_model', or 'rule_based_fallback'",
    )
    confidence_note: str
    risk_factors: List[str] = []
    recommendation: str
    risk_level: str = Field(..., description="'Low', 'Moderate', or 'High'")
    insights: List[PredictionInsightItem] = []
    extracted_features: Dict[str, Any] = {}
    model_version: str = "1.0.0"
    model_algorithm: str = "XGBoost Classifier"
    disclaimer: str
    evaluated_at: str
    fallback_reason: Optional[str] = None
