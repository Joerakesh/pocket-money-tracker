from __future__ import annotations

import math
import os
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

app = FastAPI(
    title="Pocket Money Tracker ML Service",
    version="1.0.0",
    description="Read-only spending forecasts. This service never connects to or writes to the finance database.",
)

class ForecastRequest(BaseModel):
    daily_spending_paise: list[int] = Field(min_length=7, max_length=365)
    forecast_days: int = Field(default=30, ge=1, le=90)

def moving_average_predict(train: np.ndarray, horizon: int) -> np.ndarray:
    # Use the most recent 14 observations; recursively keep the estimate stable.
    window = train[-min(14, len(train)):]
    value = float(np.mean(window))
    return np.full(horizon, max(0.0, value))

def regression_predict(train: np.ndarray, horizon: int) -> np.ndarray:
    x = np.arange(len(train), dtype=float).reshape(-1, 1)
    model = LinearRegression().fit(x, train)
    future_x = np.arange(len(train), len(train) + horizon, dtype=float).reshape(-1, 1)
    return np.maximum(0.0, model.predict(future_x))

def forest_predict(train: np.ndarray, horizon: int) -> np.ndarray:
    x = np.arange(len(train), dtype=float).reshape(-1, 1)
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=1,
    )
    model.fit(x, train)
    future_x = np.arange(len(train), len(train) + horizon, dtype=float).reshape(-1, 1)
    return np.maximum(0.0, model.predict(future_x))

def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))

def evaluate_models(values: np.ndarray) -> tuple[dict, str]:
    # Chronological holdout: never shuffle time-series observations.
    holdout_size = max(3, min(14, int(math.ceil(len(values) * 0.2))))
    split = len(values) - holdout_size
    train, actual = values[:split], values[split:]
    candidates = {
        "moving_average": lambda: moving_average_predict(train, holdout_size),
        "linear_regression": lambda: regression_predict(train, holdout_size),
    }
    if len(train) >= 30:
        candidates["random_forest"] = lambda: forest_predict(train, holdout_size)

    scores = {name: round(mae(actual, np.maximum(0, fn())), 2) for name, fn in candidates.items()}
    selected = min(scores, key=scores.get)
    return scores, selected

@app.get("/health")
def health():
    return {"status": "ok", "service": "pocket-money-ml"}

@app.post("/predict/spending")
def predict_spending(payload: ForecastRequest):
    values = np.asarray(payload.daily_spending_paise, dtype=float)
    if not np.isfinite(values).all() or (values < 0).any():
        raise HTTPException(status_code=422, detail="Daily spending must contain finite, non-negative paise values.")

    # Require enough real history and some variation; zero-spend days are valid observations.
    if len(values) < 7:
        raise HTTPException(status_code=422, detail="At least 7 daily observations are required.")

    scores, selected = evaluate_models(values)
    predictors = {
        "moving_average": moving_average_predict,
        "linear_regression": regression_predict,
        "random_forest": forest_predict,
    }
    forecast = predictors[selected](values, payload.forecast_days)
    forecast = np.maximum(0, forecast)
    total_paise = float(np.sum(forecast))
    daily_paise = [int(round(x)) for x in forecast]

    confidence: Literal["limited", "moderate", "better"] = (
        "limited" if len(values) < 30 else "moderate" if len(values) < 90 else "better"
    )
    return {
        "model": selected,
        "model_scores_mae_paise": scores,
        "forecast_days": payload.forecast_days,
        "predicted_total_paise": int(round(total_paise)),
        "predicted_total": round(total_paise / 100, 2),
        "daily_predictions_paise": daily_paise,
        "daily_predictions": [round(x / 100, 2) for x in daily_paise],
        "observations": len(values),
        "confidence": confidence,
        "evaluation": "Chronological holdout MAE; model selected by lowest holdout error.",
        "currency": "INR",
        "ledger_mutated": False,
    }
