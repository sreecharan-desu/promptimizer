LLM / GPU COST OPTIMIZER
Production-oriented core + notebook-to-backend migration
==========================================================

STATUS
------
This package contains the production-oriented foundation built from our
cell-by-cell notebook experiment.

It is NOT a claim that the commercial SaaS is finished. Before deployment,
complete authentication, encrypted secret storage, rate limiting, tenant
isolation, provider error/retry handling, persistent benchmark storage,
quality-profile generation, Redis/Qdrant integration, tracing, load testing,
and security hardening.

PRODUCT DIRECTION
-----------------
Users bring ONLY a provider API key.

Our application owns the supported provider catalog and therefore owns the
OpenAI-compatible base URLs. The flow is:

    Provider selection
        -> user API key
        -> known application base URL
        -> OpenAI-compatible client
        -> model discovery
        -> normalized ModelProfile
        -> capability filtering
        -> empirical quality filtering
        -> cost optimization
        -> optional escalation
        -> response

CORE OPTIMIZATION OBJECTIVE
---------------------------
Minimize inference cost subject to explicit quality and latency constraints.

The optimizer must NOT claim success from cost savings alone. The benchmark
must report both savings and quality change.

CELL-BY-CELL DEVELOPMENT HISTORY
=================================

CELL 1 — EXPERIMENT OBJECTIVE
-----------------------------
Defined the optimization problem:

    minimize cost
    subject to quality >= threshold
               latency <= threshold

Planned strategies:
    frontier_only
    difficulty_based
    quality_aware
    quality_aware_with_escalation

Planned metrics:
    total_cost
    cost_reduction_pct
    avg_quality
    quality_delta
    p95_latency_ms
    cache_hit_rate
    escalation_rate

CELL 2 — LLMRequest
-------------------
Created a strict Pydantic raw request contract:

    request_id
    user_prompt
    system_prompt
    context
    max_output_tokens
    metadata

Important boundary:

    raw caller facts != derived routing intelligence

Therefore we intentionally did NOT put difficulty_score, recommended_model,
predicted_quality, or cache_hit into LLMRequest.

We tested both valid and invalid Pydantic initialization.

CELL 3 — PROVIDER CATALOG
--------------------------
Established the PI-agent-style onboarding model.

User supplies:
    provider selection
    API key

Application supplies:
    provider base URL

The sample catalog is in:
    config/providers.yaml

Current sample providers:
    OpenAI
    Groq
    Together AI
    OpenRouter
    DeepSeek

CELL 4 — ProviderConnection
----------------------------
Created a Pydantic connection object containing:

    provider_id
    api_key: SecretStr

The base URL is intentionally NOT user-controlled.

CELL 5 — ProviderRegistry
-------------------------
Introduced a dedicated registry to retrieve supported provider definitions.

This prevents the rest of the codebase from scattering raw catalog lookups
throughout business logic.

CELL 6 — OpenAIClientFactory
----------------------------
Combined:

    ProviderRegistry
    +
    ProviderConnection

to create:

    OpenAI(api_key=..., base_url=...)

The rest of the application can therefore use one client abstraction across
OpenAI-compatible providers.

CELL 7 — MODEL DISCOVERY
------------------------
Made the first real provider call:

    client.models.list()

A real provider returned 16 models with rich metadata, including:

    context_length
    max_completion_tokens
    pricing
    supported_features
    input_modalities
    output_modalities
    descriptions
    supported sampling parameters

This caused us to preserve more provider metadata instead of reducing models to
just a string ID.

CELL 8 — ModelProfile
---------------------
Normalized raw provider objects into our internal ModelProfile.

ModelProfile contains provider facts:

    provider_id
    model_id
    display_name
    description
    context_length
    max_completion_tokens
    pricing
    supported_features
    supported_sampling_parameters
    input_modalities
    output_modalities

We keep capability facts separate from quality intelligence.

CELL 9 — PRICING NORMALIZATION
------------------------------
We chose USD per token as the canonical internal unit.

Human-facing display may convert to USD per 1M tokens.

We verified the observed provider values against the provider dashboard:

    input             $0.10 / 1M
    completion        $0.50 / 1M
    cache read        $0.10 / 1M

Internal equivalents:

    0.0000001 USD/token
    0.0000005 USD/token
    0.0000001 USD/token

Decimal is used for money arithmetic.

CELL 10 — RequestRequirements
------------------------------
Created a separate schema describing what a request needs:

    requires_tools
    requires_reasoning
    requires_structured_output
    requires_vision
    minimum_context_tokens
    minimum_output_tokens

These are request requirements, not model properties.

CELL 11 — CAPABILITY CHECKING
-----------------------------
Capability filtering happens BEFORE cost ranking.

A model can be cheaper but still ineligible if it cannot satisfy the request.

The checker returns structured reasons such as:

    tool_calling_not_supported
    reasoning_not_supported
    structured_outputs_not_supported
    vision_not_supported
    insufficient_context_window
    insufficient_max_output_tokens

This gives the UI and router explainability.

CELL 12 — COST ESTIMATION
-------------------------
Created CostEstimator.

For:
    2,000 input tokens
    500 output tokens

with:
    $0.10/M input
    $0.50/M output

the calculation is:

    input  = $0.00020
    output = $0.00025
    total  = $0.00045

Cache-read pricing is supported as a separate cost component in the model.

CELL 13 — QUALITY DATA MODEL
----------------------------
Established a strict separation:

    model capability != model quality

A model supporting reasoning does not automatically have high reasoning quality.

Created:

    ModelQualityProfile
    EvaluationResult

Quality profiles are intended to come from benchmark evidence.

CELL 14 — BENCHMARK TASK
------------------------
Created a common benchmark schema.

Task types:

    factual_qa
    summarization
    extraction
    coding
    debugging
    reasoning
    long_context
    vision

Important distinction:

    expected_output_tokens
        = planning / estimation signal

    max_output_tokens
        = actual generation ceiling

This prevents accidental truncation from corrupting quality measurements.

CELL 15 — EVALUATION STRATEGY
-----------------------------
Use deterministic evaluators when possible:

    structured extraction -> schema/field checks
    coding -> executable tests
    schema compliance -> validation

Use LLM judges for semantic tasks only when necessary:

    factual QA
    reasoning
    summarization
    open-ended evaluation

We tested deterministic JSON evaluation:
    correct -> 1.0
    incorrect -> 0.0

We also created an LLM semantic evaluation path with structured Pydantic output.

CELL 16 — REAL MODEL INVOCATION
-------------------------------
Called a real discovered provider model.

Observed example:

    model: openai/gpt-oss-120b

Captured real API usage:

    input tokens
    output tokens
    total tokens

We discovered the benchmark could be accidentally truncated if the expected
token count were used as max_tokens. That was fixed.

CELL 17 — REAL COST + QUALITY
-----------------------------
A real factual QA request produced:

    input  = 89 tokens
    output = 750 tokens
    total  = 839 tokens

At the observed price this was approximately:

    total cost = $0.0003839

The semantic evaluator returned:

    score  = 0.99
    passed = True

BUT the evaluator was the same model as the candidate.

Therefore:
    pipeline test = valid
    independent benchmark evidence = invalid

The final benchmark must forbid candidate/evaluator self-evaluation.

WHY THE FINAL SYSTEM IS NOT A DUMB CHEAP-MODEL SWITCH
======================================================
The intended routing sequence is:

    1. Understand request requirements
    2. Filter incompatible models
    3. Estimate / predict quality
    4. Enforce quality constraint
    5. Compare expected cost
    6. Choose cheapest qualifying model
    7. Optionally validate runtime output
    8. Escalate if validation fails

This is the key product promise:

    cost optimization WITHOUT silently degrading answer quality

BACKEND MODULE MAP
==================

app/core/schemas.py
    Domain contracts and Pydantic models.

app/core/providers.py
    Provider catalog and registry.

app/core/cost.py
    Token-level cost arithmetic.

app/core/routing.py
    Capability filter and quality-aware candidate selector.

app/services/client_factory.py
    OpenAI-compatible client construction.

app/services/model_discovery.py
    Model discovery and normalization.

app/services/invocation.py
    Actual model execution and token usage extraction.

app/api/routes.py
    Initial FastAPI endpoints.

app/main.py
    Application composition.

config/providers.yaml
    Provider base URLs owned by the application.

tests/test_core.py
    Core unit tests.

notebooks/
    Original iterative notebook should be copied here before sharing.

STACK PLACEMENT
===============
Pydantic
    Domain schemas and validation.

OpenAI SDK
    Provider-compatible model access.

LangChain
    Model/retriever integration where it gives us leverage.

LangGraph
    Orchestration of routing, execution, validation, and escalation.

Redis
    First choice for exact/prefix hot-path caching.

Qdrant
    Later advanced option for semantic caching and historical similar-request
    retrieval. It should not be forced into the exact cache layer.

Ragas
    RAG-specific evaluation.

LangSmith
    Tracing, experiments, and visibility into LangGraph workflows.

FastAPI
    OpenAI-compatible gateway and developer-facing API.

NEXT STEPS
==========

1. Build the benchmark runner.
   Same task set -> multiple discovered models -> real response/usage/cost.

2. Add evaluator adapters.
   Deterministic -> tests -> Pydantic/schema -> independent LLM judge -> Ragas.

3. Generate ModelQualityProfile automatically from benchmark results.

4. Build the real quality-aware router over measured quality.

5. Add runtime escalation:
       cheap model -> validation -> frontier/stronger model on failure.

6. Add Redis prompt/prefix caching.

7. Add Qdrant semantic caching as an optional advanced optimization.

8. Put routing/execution/escalation into LangGraph.

9. Implement:
       POST /v1/chat/completions
   with OpenAI-compatible gateway semantics.

10. Add dashboard metrics:
       frontier baseline cost
       optimized cost
       cost reduction %
       quality delta
       cache hit rate
       escalation rate
       latency
       model distribution

SECURITY BEFORE PRODUCTION
==========================
Never log API keys.
Never commit real keys.
Never place real keys in notebooks or screenshots.
Use encrypted secret storage or a KMS/Vault for persisted credentials.
Authenticate users and isolate tenants.
Rate-limit API endpoints.
Add timeouts/retry/backoff.
Validate provider IDs against the static catalog.
Do not expose arbitrary user-supplied base URLs without SSRF controls.
Add audit logs without secrets.
Add concurrency/backpressure controls.

RUN
===
Create environment:

    python -m venv .venv
    source .venv/bin/activate

Install core:

    pip install -e ".[dev]"

Install full stack:

    pip install -e ".[dev,ai,rag]"

Run tests:

    make test

Run API:

    make run

Health:

    GET http://localhost:8000/health

Providers:

    GET http://localhost:8000/v1/providers

Model discovery:

    POST http://localhost:8000/v1/models/discover

The final chat route is intentionally disabled in this foundation until
empirical quality profiles exist. That prevents us from pretending the system
has measured routing intelligence before the benchmark actually produces it.
