from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.domain.optimizer.schemas import (
    CapabilityCheckResult,
    ModelProfile,
    ModelQualityProfile,
    RequestRequirements,
)


class ModelCapabilityChecker:
    @staticmethod
    def check(model: ModelProfile, requirements: RequestRequirements) -> CapabilityCheckResult:
        reasons: list[str] = []
        features = set(model.supported_features)
        modalities = set(model.input_modalities)

        if requirements.requires_tools and "tools" not in features:
            reasons.append("tool_calling_not_supported")
        if requirements.requires_reasoning and "reasoning" not in features:
            reasons.append("reasoning_not_supported")
        if requirements.requires_structured_output and "structured_outputs" not in features:
            reasons.append("structured_outputs_not_supported")
        if requirements.requires_vision and "image" not in modalities:
            reasons.append("vision_not_supported")
        if (
            model.context_length is not None
            and model.context_length < requirements.minimum_context_tokens
        ):
            reasons.append("insufficient_context_window")
        if (
            model.max_completion_tokens is not None
            and model.max_completion_tokens < requirements.minimum_output_tokens
        ):
            reasons.append("insufficient_max_output_tokens")

        return CapabilityCheckResult(
            model_id=model.model_id,
            eligible=not reasons,
            reasons=tuple(reasons),
        )


@dataclass(frozen=True)
class RoutingCandidate:
    model: ModelProfile
    capability: CapabilityCheckResult
    estimated_quality: float
    estimated_cost_usd: float


class QualityAwareRouter:
    def __init__(
        self,
        quality_profiles: Mapping[str, ModelQualityProfile],
        minimum_quality: float = 0.95,
    ):
        self.quality_profiles = quality_profiles
        self.minimum_quality = minimum_quality
        self.capability_checker = ModelCapabilityChecker()

    def _quality_for_task(self, profile: ModelQualityProfile, task_type: str | None) -> float:
        if task_type == "reasoning":
            return profile.reasoning_quality
        if task_type in {"coding", "debugging"}:
            return profile.coding_quality
        if task_type == "extraction":
            return profile.extraction_quality
        if task_type == "factual_qa":
            return profile.factual_quality
        return profile.overall_quality

    def candidates(
        self,
        models: Sequence[ModelProfile],
        requirements: RequestRequirements,
        task_type: str | None = None,
    ) -> list[RoutingCandidate]:
        out = []
        for model in models:
            capability = self.capability_checker.check(model, requirements)
            if not capability.eligible:
                continue
            profile = self.quality_profiles.get(model.model_id)
            if profile is None:
                continue
            quality = self._quality_for_task(profile, task_type)
            estimated_cost = 0.0
            if model.pricing and model.pricing.prompt and model.pricing.completion:
                estimated_cost = float(
                    model.pricing.prompt.usd_per_token
                    + model.pricing.completion.usd_per_token
                )
            out.append(RoutingCandidate(model, capability, quality, estimated_cost))
        return out

    def choose(
        self,
        models: Sequence[ModelProfile],
        requirements: RequestRequirements,
        task_type: str | None = None,
    ) -> RoutingCandidate:
        candidates = [
            c for c in self.candidates(models, requirements, task_type)
            if c.estimated_quality >= self.minimum_quality
        ]
        if not candidates:
            raise ValueError("No model satisfies both capability and quality constraints.")
        return min(candidates, key=lambda c: (c.estimated_cost_usd, -c.estimated_quality))
