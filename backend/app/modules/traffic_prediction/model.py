from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.ensemble import RandomForestClassifier


DAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


class TrafficModel:
    def __init__(
        self,
        n_estimators: int = 120,
        max_depth: int = 8,
        random_state: int = 42,
    ) -> None:
        self.model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )

        self.is_trained = False
        self.training_records = 0

    @staticmethod
    def day_to_index(day: str) -> int:
        normalized = str(day or "").strip().lower()

        if normalized not in DAY_INDEX:
            raise ValueError(
                "Invalid day_of_week. Expected Monday through Sunday."
            )

        return DAY_INDEX[normalized]

    @staticmethod
    def _features(
        hour: int,
        day_of_week: str,
        vehicle_count: int,
        speed: float,
    ) -> List[float]:
        try:
            hour = int(hour)
            vehicle_count = int(vehicle_count)
            speed = float(speed)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Prediction inputs must contain valid numeric values."
            ) from exc

        if not 0 <= hour <= 23:
            raise ValueError(
                "Hour must be between 0 and 23."
            )

        if vehicle_count < 0:
            raise ValueError(
                "Vehicle count cannot be negative."
            )

        if speed < 0:
            raise ValueError(
                "Speed cannot be negative."
            )

        return [
            float(hour),
            float(TrafficModel.day_to_index(day_of_week)),
            float(vehicle_count),
            speed,
        ]

    @staticmethod
    def _label_from_congestion(
        congestion_level: Optional[str],
    ) -> Optional[int]:
        normalized = str(
            congestion_level or ""
        ).strip().lower()

        return {
            "low": 0,
            "medium": 1,
            "high": 2,
            "severe": 2,
        }.get(normalized)

    def train(
        self,
        records: List[Any],
    ) -> Dict[str, Any]:
        X: List[List[float]] = []
        y: List[int] = []

        for record in records:
            recorded_at = getattr(
                record,
                "recorded_at",
                None,
            )

            speed_value = getattr(
                record,
                "avg_speed_kmph",
                None,
            )

            if recorded_at is None or speed_value is None:
                continue

            label = self._label_from_congestion(
                getattr(
                    record,
                    "congestion_level",
                    None,
                )
            )

            if label is None:
                continue

            try:
                vehicle_count = max(
                    0,
                    int(
                        getattr(
                            record,
                            "vehicle_count",
                            0,
                        )
                        or 0
                    ),
                )

                speed = float(speed_value)

                if speed < 0:
                    continue

                features = self._features(
                    hour=recorded_at.hour,
                    day_of_week=recorded_at.strftime("%A"),
                    vehicle_count=vehicle_count,
                    speed=speed,
                )

            except (
                TypeError,
                ValueError,
                AttributeError,
            ):
                continue

            X.append(features)
            y.append(label)

        if not X:
            self.is_trained = False
            self.training_records = 0

            raise ValueError(
                "No usable historical traffic records are available "
                "for model training."
            )

        unique_classes = sorted(set(y))

        if len(unique_classes) < 2:
            self.is_trained = False
            self.training_records = 0

            raise ValueError(
                "Historical traffic data contains only one congestion "
                "class. At least two classes are required for training."
            )

        X_array = np.asarray(
            X,
            dtype=float,
        )

        y_array = np.asarray(
            y,
            dtype=int,
        )

        self.model.fit(
            X_array,
            y_array,
        )

        self.is_trained = True
        self.training_records = len(X)

        return {
            "trained": True,
            "model_type": "random_forest",
            "training_records": len(X),
            "classes": unique_classes,
        }

    def predict(
        self,
        hour: int,
        day_of_week: str,
        vehicles: int,
        speed: float,
    ) -> Dict[str, Any]:
        if not self.is_trained:
            raise ValueError(
                "Traffic model has not been trained."
            )

        features = self._features(
            hour=hour,
            day_of_week=day_of_week,
            vehicle_count=vehicles,
            speed=speed,
        )

        X = np.asarray(
            [features],
            dtype=float,
        )

        label = int(
            self.model.predict(X)[0]
        )

        probabilities = self.model.predict_proba(X)[0]

        confidence = float(
            np.max(probabilities)
        )

        labels = {
            0: "Low",
            1: "Medium",
            2: "High",
        }

        predicted_congestion = labels.get(
            label,
            "Unknown",
        )

        speed_reduction = {
            0: 0.00,
            1: 0.18,
            2: 0.35,
        }.get(
            label,
            0.35,
        )

        estimated_speed = max(
            0.0,
            round(
                float(speed)
                * (1.0 - speed_reduction),
                1,
            ),
        )

        return {
            "predicted_congestion": predicted_congestion,
            "confidence": round(
                confidence,
                3,
            ),
            "confidence_percentage": round(
                confidence * 100,
                1,
            ),
            "estimated_speed_kmph": estimated_speed,
            "model_type": "random_forest",
            "training_records": self.training_records,
            "input_speed_kmph": round(
                float(speed),
                1,
            ),
            "input_vehicle_count": int(vehicles),
            "input_hour": int(hour),
            "input_day_of_week": str(day_of_week).strip(),
        }

    def status(self) -> Dict[str, Any]:
        return {
            "model_available": self.is_trained,
            "model_type": (
                "random_forest"
                if self.is_trained
                else "not_trained"
            ),
            "training_records": self.training_records,
        }