from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestClassifier

from app.core.config import settings
from app.models.traffic import TrafficRecord


class TrafficPredictionService:
    def __init__(self, db: Session):
        self.db = db
        self.model: Optional[RandomForestClassifier] = None
        self.trained_at: Optional[datetime] = None
        self.training_records: int = 0
        self.classes: List[str] = []

    @property
    def minimum_training_records(self) -> int:
        return max(
            2,
            int(
                getattr(
                    settings,
                    "MIN_TRAINING_RECORDS",
                    10,
                )
            ),
        )

    @property
    def minimum_confidence(self) -> float:
        return max(
            0.0,
            min(
                1.0,
                float(
                    getattr(
                        settings,
                        "PREDICTION_MIN_CONFIDENCE",
                        0.50,
                    )
                ),
            ),
        )

    @staticmethod
    def _normalize_day(
        day_of_week: Optional[str],
    ) -> str:
        if day_of_week:
            value = str(day_of_week).strip().lower()

            aliases = {
                "monday": "monday",
                "mon": "monday",
                "0": "monday",
                "tuesday": "tuesday",
                "tue": "tuesday",
                "tues": "tuesday",
                "1": "tuesday",
                "wednesday": "wednesday",
                "wed": "wednesday",
                "2": "wednesday",
                "thursday": "thursday",
                "thu": "thursday",
                "thur": "thursday",
                "thurs": "thursday",
                "3": "thursday",
                "friday": "friday",
                "fri": "friday",
                "4": "friday",
                "saturday": "saturday",
                "sat": "saturday",
                "5": "saturday",
                "sunday": "sunday",
                "sun": "sunday",
                "6": "sunday",
            }

            if value in aliases:
                return aliases[value]

            raise ValueError(
                "Invalid day_of_week. Use a valid weekday name."
            )

        return datetime.now().strftime("%A").lower()

    @staticmethod
    def _day_to_number(day: str) -> int:
        days = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }

        return days[day]

    @staticmethod
    def _normalize_road(
        road_name: Optional[str],
    ) -> Optional[str]:
        if road_name is None:
            return None

        value = str(road_name).strip()

        if not value:
            return None

        return value

    def _get_records(
        self,
        road_name: Optional[str] = None,
        days: Optional[int] = None,
    ) -> List[TrafficRecord]:
        query = self.db.query(TrafficRecord)

        if road_name:
            normalized = road_name.strip().lower()

            query = query.filter(
                func.lower(
                    TrafficRecord.road_name
                )
                == normalized
            )

        if days is not None:
            days = max(1, int(days))

            cutoff = (
                datetime.now(timezone.utc)
                - timedelta(days=days)
            )

            recent = (
                query
                .filter(
                    TrafficRecord.recorded_at >= cutoff
                )
                .order_by(
                    TrafficRecord.recorded_at.asc()
                )
                .all()
            )

            if recent:
                return recent

        return (
            query
            .order_by(
                TrafficRecord.recorded_at.asc()
            )
            .all()
        )

    def _get_training_records(self) -> List[TrafficRecord]:
        return (
            self.db.query(TrafficRecord)
            .filter(
                TrafficRecord.recorded_at.isnot(None)
            )
            .order_by(
                TrafficRecord.recorded_at.asc()
            )
            .all()
        )

    @staticmethod
    def _safe_float(
        value: Any,
        default: float = 0.0,
    ) -> float:
        try:
            number = float(value)

            if np.isfinite(number):
                return number

        except (
            TypeError,
            ValueError,
        ):
            pass

        return default

    @staticmethod
    def _safe_int(
        value: Any,
        default: int = 0,
    ) -> int:
        try:
            return int(float(value))

        except (
            TypeError,
            ValueError,
        ):
            return default

    @staticmethod
    def _normalize_level(
        value: Any,
    ) -> str:
        normalized = str(
            value or "low"
        ).strip().lower()

        aliases = {
            "low": "low",
            "medium": "medium",
            "moderate": "medium",
            "high": "high",
            "severe": "severe",
            "critical": "severe",
        }

        return aliases.get(
            normalized,
            "low",
        )

    @staticmethod
    def _level_from_score(
        score: float,
    ) -> str:
        if score >= 0.875:
            return "severe"

        if score >= 0.625:
            return "high"

        if score >= 0.375:
            return "medium"

        return "low"

    @staticmethod
    def _score_from_level(
        level: Any,
    ) -> float:
        values = {
            "low": 0.25,
            "medium": 0.50,
            "high": 0.75,
            "severe": 1.00,
        }

        return values.get(
            TrafficPredictionService._normalize_level(
                level
            ),
            0.25,
        )

    @staticmethod
    def _speed_congestion_score(
        speed: float,
        free_flow: float,
    ) -> float:
        if free_flow <= 0:
            return 0.0

        ratio = max(
            0.0,
            min(
                1.0,
                speed / free_flow,
            ),
        )

        return max(
            0.0,
            min(
                1.0,
                1.0 - ratio,
            ),
        )

    @staticmethod
    def _confidence_from_training(
        confidence: float,
        training_count: int,
    ) -> float:
        data_factor = min(
            1.0,
            training_count / 100.0,
        )

        result = (
            (confidence * 0.75)
            + (data_factor * 0.25)
        )

        return round(
            max(
                0.50,
                min(
                    0.99,
                    result,
                ),
            ),
            2,
        )

    def train(self) -> Dict[str, Any]:
        records = self._get_training_records()

        self.training_records = len(records)

        if len(records) < self.minimum_training_records:
            self.model = None
            self.trained_at = None
            self.classes = []

            return {
                "trained": False,
                "model_available": False,
                "model_type": "random_forest",
                "training_records": len(records),
                "minimum_required": (
                    self.minimum_training_records
                ),
                "message": (
                    f"At least "
                    f"{self.minimum_training_records} "
                    f"historical traffic records are "
                    f"required."
                ),
            }

        features = []
        labels = []

        for record in records:
            recorded_at = record.recorded_at

            if recorded_at is None:
                continue

            vehicle_count = self._safe_int(
                record.vehicle_count
            )

            speed = self._safe_float(
                record.avg_speed_kmph
            )

            free_flow = self._safe_float(
                record.free_flow_speed_kmph,
                1.0,
            )

            if free_flow <= 0:
                free_flow = 1.0

            level = self._normalize_level(
                record.congestion_level
            )

            features.append(
                [
                    recorded_at.hour,
                    recorded_at.weekday(),
                    vehicle_count,
                    speed,
                    free_flow,
                ]
            )

            labels.append(level)

        if len(features) < self.minimum_training_records:
            self.model = None
            self.trained_at = None
            self.classes = []

            return {
                "trained": False,
                "model_available": False,
                "model_type": "random_forest",
                "training_records": len(features),
                "minimum_required": (
                    self.minimum_training_records
                ),
                "message": (
                    "Not enough valid historical "
                    "traffic records are available "
                    "for model training."
                ),
            }

        unique_classes = sorted(
            set(labels)
        )

        if len(unique_classes) < 2:
            self.model = None
            self.trained_at = None
            self.classes = unique_classes

            return {
                "trained": False,
                "model_available": False,
                "model_type": "random_forest",
                "training_records": len(features),
                "minimum_required": (
                    self.minimum_training_records
                ),
                "message": (
                    "Historical data must contain at "
                    "least two congestion levels for "
                    "Random Forest training."
                ),
            }

        model = RandomForestClassifier(
            n_estimators=150,
            max_depth=10,
            min_samples_leaf=1,
            random_state=42,
            class_weight="balanced",
        )

        model.fit(
            np.asarray(
                features,
                dtype=float,
            ),
            np.asarray(labels),
        )

        self.model = model
        self.classes = [
            str(value)
            for value in model.classes_
        ]
        self.trained_at = datetime.now(
            timezone.utc
        )
        self.training_records = len(features)

        return {
            "trained": True,
            "model_available": True,
            "model_type": "random_forest",
            "training_records": len(features),
            "minimum_required": (
                self.minimum_training_records
            ),
            "trained_at": (
                self.trained_at.isoformat()
            ),
            "classes": self.classes,
        }

    def _historical_average(
        self,
        records: List[TrafficRecord],
        field: str,
    ) -> Optional[float]:
        values: List[float] = []

        for record in records:
            value = getattr(
                record,
                field,
                None,
            )

            if value is None:
                continue

            try:
                number = float(value)

                if np.isfinite(number) and number >= 0:
                    values.append(number)

            except (
                TypeError,
                ValueError,
            ):
                continue

        if not values:
            return None

        return sum(values) / len(values)

    def predict(
        self,
        road_name: Optional[str] = None,
        vehicle_count: Optional[int] = None,
        current_speed_kmph: Optional[float] = None,
        free_flow_speed_kmph: Optional[float] = None,
        hour: Optional[int] = None,
        day_of_week: Optional[str] = None,
    ) -> Dict[str, Any]:

        normalized_road = self._normalize_road(
            road_name
        )

        if (
            vehicle_count is None
            and current_speed_kmph is None
        ):
            raise ValueError(
                "Provide vehicle count or current speed "
                "before requesting a prediction."
            )

        if vehicle_count is not None:
            vehicle_count = self._safe_int(
                vehicle_count,
                -1,
            )

            if vehicle_count < 0:
                raise ValueError(
                    "Vehicle count must be a valid "
                    "non-negative integer."
                )

        if current_speed_kmph is not None:
            current_speed_kmph = self._safe_float(
                current_speed_kmph,
                -1.0,
            )

            if current_speed_kmph < 0:
                raise ValueError(
                    "Current speed must be a valid "
                    "non-negative number."
                )

        if free_flow_speed_kmph is not None:
            free_flow_speed_kmph = self._safe_float(
                free_flow_speed_kmph,
                -1.0,
            )

            if free_flow_speed_kmph <= 0:
                raise ValueError(
                    "Free-flow speed must be greater "
                    "than zero."
                )

        if hour is None:
            hour = datetime.now().hour

        try:
            hour = int(hour)

        except (
            TypeError,
            ValueError,
        ):
            raise ValueError(
                "Hour must be a valid integer."
            )

        if not 0 <= hour <= 23:
            raise ValueError(
                "Hour must be between 0 and 23."
            )

        normalized_day = self._normalize_day(
            day_of_week
        )

        day_number = self._day_to_number(
            normalized_day
        )

        historical = self._get_records(
            road_name=normalized_road,
            days=30,
        )

        if (
            normalized_road
            and not historical
        ):
            historical = self._get_records()

        total_records = (
            self.db.query(
                TrafficRecord
            ).count()
        )

        if total_records < self.minimum_training_records:
            raise ValueError(
                f"Prediction model is not ready. "
                f"At least "
                f"{self.minimum_training_records} "
                f"historical records are required; "
                f"{total_records} are available."
            )

        training_result = self.train()

        if not training_result.get("trained"):
            raise ValueError(
                training_result.get(
                    "message",
                    "Prediction model could not "
                    "be trained.",
                )
            )

        if current_speed_kmph is None:
            current_speed_kmph = (
                self._historical_average(
                    historical,
                    "avg_speed_kmph",
                )
            )

            if current_speed_kmph is None:
                raise ValueError(
                    "Current speed was not supplied "
                    "and no historical speed is "
                    "available for this road."
                )

        if vehicle_count is None:
            average_vehicle_count = (
                self._historical_average(
                    historical,
                    "vehicle_count",
                )
            )

            if average_vehicle_count is None:
                raise ValueError(
                    "Vehicle count was not supplied "
                    "and no historical vehicle-count "
                    "data is available."
                )

            vehicle_count = int(
                round(
                    average_vehicle_count
                )
            )

        if free_flow_speed_kmph is None:
            free_flow_speed_kmph = (
                self._historical_average(
                    historical,
                    "free_flow_speed_kmph",
                )
            )

            if (
                free_flow_speed_kmph is None
                or free_flow_speed_kmph <= 0
            ):
                raise ValueError(
                    "Free-flow speed was not supplied "
                    "and no valid historical free-flow "
                    "speed is available."
                )

        features = np.asarray(
            [[
                hour,
                day_number,
                vehicle_count,
                current_speed_kmph,
                free_flow_speed_kmph,
            ]],
            dtype=float,
        )

        prediction = self.model.predict(
            features
        )[0]

        predicted_level = self._normalize_level(
            prediction
        )

        confidence = 0.0

        if hasattr(
            self.model,
            "predict_proba",
        ):
            probabilities = (
                self.model.predict_proba(
                    features
                )[0]
            )

            confidence = float(
                np.max(probabilities)
            )

        confidence = (
            self._confidence_from_training(
                confidence,
                self.training_records,
            )
        )

        speed_ratio = (
            current_speed_kmph
            / max(
                free_flow_speed_kmph,
                0.1,
            )
        )

        predicted_speed = current_speed_kmph

        reduction = {
            "low": 0.05,
            "medium": 0.22,
            "high": 0.45,
            "severe": 0.60,
        }.get(
            predicted_level,
            0.10,
        )

        predicted_speed = max(
            5.0,
            round(
                current_speed_kmph
                * (1.0 - reduction),
                1,
            ),
        )

        congestion_score = max(
            0.0,
            min(
                1.0,
                (
                    self._score_from_level(
                        predicted_level
                    )
                    + (
                        max(
                            0.0,
                            min(
                                1.0,
                                1.0 - speed_ratio,
                            ),
                        )
                        * 0.20
                    )
                ),
            ),
        )

        result = {
            "road_name": normalized_road,
            "prediction_method": "random_forest",
            "model_available": True,
            "predicted_congestion": predicted_level,
            "congestion_level": predicted_level,
            "congestion_score": round(
                congestion_score,
                3,
            ),
            "estimated_speed_kmph": (
                predicted_speed
            ),
            "predicted_speed_kmph": (
                predicted_speed
            ),
            "confidence": confidence,
            "confidence_threshold": (
                self.minimum_confidence
            ),
            "confidence_status": (
                "high"
                if confidence
                >= self.minimum_confidence
                else "low"
            ),
            "input": {
                "vehicle_count": vehicle_count,
                "current_speed_kmph": round(
                    current_speed_kmph,
                    2,
                ),
                "free_flow_speed_kmph": round(
                    free_flow_speed_kmph,
                    2,
                ),
                "hour": hour,
                "day_of_week": normalized_day,
            },
            "historical_records_used": len(
                historical
            ),
            "model_status": self.get_report(
                train_model=False
            ),
        }

        return result

    def get_peak_hours(
        self,
    ) -> Dict[str, Any]:
        records = self._get_records()

        hourly: Dict[
            int,
            List[float],
        ] = {}

        for record in records:
            if record.recorded_at is None:
                continue

            hour = record.recorded_at.hour

            speed = self._safe_float(
                record.avg_speed_kmph
            )

            free_flow = self._safe_float(
                record.free_flow_speed_kmph,
                1.0,
            )

            if free_flow <= 0:
                free_flow = 1.0

            if record.congestion_level:
                score = self._score_from_level(
                    record.congestion_level
                )
            else:
                score = (
                    self._speed_congestion_score(
                        speed,
                        free_flow,
                    )
                )

            hourly.setdefault(
                hour,
                [],
            ).append(score)

        hourly_analysis = []

        for hour in sorted(hourly):
            values = hourly[hour]

            average = (
                sum(values)
                / len(values)
            )

            hourly_analysis.append(
                {
                    "hour": hour,
                    "average_congestion": round(
                        average,
                        3,
                    ),
                    "observation_count": len(
                        values
                    ),
                }
            )

        peak_hours = sorted(
            hourly_analysis,
            key=lambda item: item[
                "average_congestion"
            ],
            reverse=True,
        )[:3]

        return {
            "peak_hours": peak_hours,
            "hourly_analysis": hourly_analysis,
            "total_observations": len(records),
        }

    def get_report(
        self,
        train_model: bool = True,
    ) -> Dict[str, Any]:

        total_records = (
            self.db.query(
                TrafficRecord
            ).count()
        )

        if train_model:
            training_result = self.train()
        else:
            training_result = {
                "trained": self.model is not None
            }

        model_available = (
            self.model is not None
        )

        return {
            "model_available": model_available,
            "training_ready": (
                total_records
                >= self.minimum_training_records
            ),
            "model_type": (
                "random_forest"
                if model_available
                else "not_trained"
            ),
            "training_records": (
                self.training_records
                if self.training_records
                else total_records
            ),
            "minimum_training_records": (
                self.minimum_training_records
            ),
            "trained_at": (
                self.trained_at.isoformat()
                if self.trained_at
                else None
            ),
            "confidence_threshold": (
                self.minimum_confidence
            ),
            "original_model_recovered": False,
            "peak_hours_available": (
                total_records > 0
            ),
            "message": (
                "Random Forest prediction model "
                "is trained from historical "
                "traffic_records."
                if model_available
                else (
                    "Prediction model requires "
                    "sufficient historical "
                    "traffic records."
                )
            ),
            "training_result": training_result,
        }