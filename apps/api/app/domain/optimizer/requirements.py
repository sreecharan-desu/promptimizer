from __future__ import annotations

from typing import Any

from app.domain.optimizer.schemas import RequestRequirements, TaskType


def extract_requirements(
    messages: list[dict[str, Any]],
    extra: dict[str, Any] | None = None,
) -> RequestRequirements:
    extra = extra or {}
    parts: list[str] = []
    has_vision = False
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "image_url" or block.get("image_url"):
                        has_vision = True
                    if block.get("text"):
                        parts.append(str(block["text"]))
    blob = "\n".join(parts)
    rf = extra.get("response_format") or {}
    structured = isinstance(rf, dict) and rf.get("type") in {
        "json_object",
        "json_schema",
    }
    tools = bool(extra.get("tools") or extra.get("functions"))
    task = TaskType.FACTUAL_QA
    lower = blob.lower()
    if "```" in blob or "def " in blob or "function " in lower:
        task = TaskType.CODING
    elif "prove" in lower or "reason step" in lower:
        task = TaskType.REASONING
    elif has_vision:
        task = TaskType.VISION
    elif "summarize" in lower:
        task = TaskType.SUMMARIZATION
    max_out = extra.get("max_tokens") or extra.get("max_completion_tokens") or 0
    return RequestRequirements(
        requires_tools=tools,
        requires_reasoning=task == TaskType.REASONING,
        requires_structured_output=structured or "respond with json" in lower,
        requires_vision=has_vision,
        minimum_context_tokens=max(0, len(blob) // 4 + 512),
        minimum_output_tokens=int(max_out),
        task_type=TaskType.VISION if has_vision else task,
    )
