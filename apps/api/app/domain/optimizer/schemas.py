from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class TaskType(StrEnum):
    FACTUAL_QA = "factual_qa"
    SUMMARIZATION = "summarization"
    EXTRACTION = "extraction"
    CODING = "coding"
    DEBUGGING = "debugging"
    REASONING = "reasoning"
    LONG_CONTEXT = "long_context"
    VISION = "vision"


class LLMRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str
    user_prompt: str = Field(..., min_length=1)
    system_prompt: str | None = None
    context: str | None = None
    max_output_tokens: int = Field(default=512, gt=0, le=32_000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProviderDefinition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    provider_id: str
    display_name: str
    base_url: str
    protocol: str = "openai_compatible"


class ProviderConnection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_id: str
    api_key: SecretStr = Field(..., min_length=1)


class TokenPrice(BaseModel):
    model_config = ConfigDict(frozen=True)
    usd_per_token: Decimal = Field(..., ge=0)

    @property
    def usd_per_million_tokens(self) -> Decimal:
        return self.usd_per_token * Decimal("1_000_000")


class ModelPricing(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt: TokenPrice | None = None
    completion: TokenPrice | None = None
    input_cache_read: TokenPrice | None = None
    image: TokenPrice | None = None
    request: TokenPrice | None = None


class ModelProfile(BaseModel):
    model_config = ConfigDict(frozen=True)
    provider_id: str
    model_id: str
    display_name: str
    description: str | None = None
    context_length: int | None = None
    max_completion_tokens: int | None = None
    pricing: ModelPricing | None = None
    supported_features: tuple[str, ...] = ()
    supported_sampling_parameters: tuple[str, ...] = ()
    input_modalities: tuple[str, ...] = ()
    output_modalities: tuple[str, ...] = ()


class RequestRequirements(BaseModel):
    model_config = ConfigDict(frozen=True)
    requires_tools: bool = False
    requires_reasoning: bool = False
    requires_structured_output: bool = False
    requires_vision: bool = False
    minimum_context_tokens: int = Field(default=0, ge=0)
    minimum_output_tokens: int = Field(default=0, ge=0)


class CapabilityCheckResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    model_id: str
    eligible: bool
    reasons: tuple[str, ...] = ()


class CostEstimate(BaseModel):
    model_config = ConfigDict(frozen=True)
    input_tokens: int = Field(..., ge=0)
    output_tokens: int = Field(..., ge=0)
    input_cost_usd: Decimal = Field(..., ge=0)
    output_cost_usd: Decimal = Field(..., ge=0)
    cache_cost_usd: Decimal = Field(default=Decimal("0"), ge=0)
    total_cost_usd: Decimal = Field(..., ge=0)


class ModelQualityProfile(BaseModel):
    model_config = ConfigDict(frozen=True)
    model_id: str
    overall_quality: float = Field(..., ge=0, le=1)
    reasoning_quality: float = Field(..., ge=0, le=1)
    coding_quality: float = Field(..., ge=0, le=1)
    extraction_quality: float = Field(..., ge=0, le=1)
    factual_quality: float = Field(..., ge=0, le=1)


class EvaluationResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    model_id: str
    task_id: str
    score: float = Field(..., ge=0, le=1)
    passed: bool
    evaluator: str
    details: str | None = None


class ModelResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    request_id: str
    model_id: str
    content: str
    input_tokens: int = Field(..., ge=0)
    output_tokens: int = Field(..., ge=0)
    total_tokens: int = Field(..., ge=0)


class BenchmarkTask(BaseModel):
    model_config = ConfigDict(frozen=True)
    task_id: str
    task_type: TaskType
    prompt: str = Field(..., min_length=1)
    reference_answer: str | None = None
    difficulty: int = Field(..., ge=1, le=5)
    expected_output_tokens: int = Field(..., gt=0)
    max_output_tokens: int = Field(..., gt=0)
    requires_tools: bool = False
    requires_reasoning: bool = False
    requires_structured_output: bool = False
    requires_vision: bool = False
