import type { JevRequestClassification } from "../jev";
import type { RequestRequirements, TaskType } from "./types";

type ChatMessage = {
  role?: string;
  content?: unknown;
  tool_calls?: unknown;
};

type ChatBody = {
  messages?: ChatMessage[];
  tools?: unknown[];
  functions?: unknown[];
  response_format?: { type?: string } | null;
  max_tokens?: number;
  max_completion_tokens?: number;
};

function contentHasImage(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (!part || typeof part !== "object") return false;
    const p = part as { type?: string; image_url?: unknown };
    return p.type === "image_url" || Boolean(p.image_url);
  });
}

function estimateTokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
        return "";
      })
      .join("\n");
  }
  return "";
}

function inferTaskType(blob: string): TaskType {
  if (/```|def |function |class |bug|stack trace|typescript|python/i.test(blob)) return "coding";
  if (/prove|theorem|reason step|chain of thought|logic puzzle/i.test(blob)) return "reasoning";
  if (/extract|json schema|fill the fields|structured/i.test(blob)) return "extraction";
  if (/summarize|tl;dr|synopsis/i.test(blob)) return "summarization";
  if (/what is|who is|capital of|when did/i.test(blob)) return "factual_qa";
  if (blob.length > 12_000) return "long_context";
  return "general";
}

export function extractRequirements(body: ChatBody): RequestRequirements {
  const messages = body.messages ?? [];
  const blob = messages.map((m) => flattenContent(m.content)).join("\n");
  const hasTools = Boolean(body.tools?.length || body.functions?.length || messages.some((m) => m.tool_calls));
  const hasVision = messages.some((m) => contentHasImage(m.content));
  const structured =
    body.response_format?.type === "json_object" ||
    body.response_format?.type === "json_schema" ||
    /return (only )?json|respond with json|output a json/i.test(blob);
  const taskType = inferTaskType(blob);
  const contextTokens = estimateTokens(blob) + 512;
  const minOut = body.max_completion_tokens ?? body.max_tokens ?? 0;

  return {
    requires_tools: hasTools,
    requires_reasoning: taskType === "reasoning" || /step by step|show your work/i.test(blob),
    requires_structured_output: structured,
    requires_vision: hasVision || taskType === "vision",
    minimum_context_tokens: contextTokens,
    minimum_output_tokens: minOut,
    task_type: hasVision ? "vision" : taskType,
  };
}

export type RequestUnderstanding = {
  requirements: RequestRequirements;
  classification_source: "jev" | "local";
  jev_task_type: TaskType | null;
  jev_task_type_confidence: number | null;
  jev_difficulty: "easy" | "medium" | "hard" | null;
  jev_difficulty_confidence: number | null;
};

/** Structural signals the local extractor can assert without a semantic model. */
function unambiguousTaskType(blob: string, local: RequestRequirements): TaskType | null {
  if (local.requires_vision) return "vision";
  const debug = /\b(stack ?trace|traceback)\b/i.test(blob);
  if (/```/.test(blob) && (debug || /\b(bug|exception|debug)\b/i.test(blob))) return "debugging";
  if (debug) return "debugging";
  if (/```/.test(blob) || /\b(def |function |class )\b/.test(blob)) return "coding";
  if (blob.length > 12_000) return "long_context";
  return null;
}

/**
 * Keep deterministic capability requirements. JEV may replace task type only
 * when no unambiguous local signal exists, and may supply difficulty.
 */
export function finalizeRequirements(body: ChatBody, jev: JevRequestClassification | null): RequestUnderstanding {
  const local = extractRequirements(body);
  if (!jev?.available) {
    return {
      requirements: local,
      classification_source: "local",
      jev_task_type: null,
      jev_task_type_confidence: null,
      jev_difficulty: null,
      jev_difficulty_confidence: null,
    };
  }

  const blob = (body.messages ?? []).map((m) => flattenContent(m.content)).join("\n");
  const explicit = unambiguousTaskType(blob, local);
  return {
    requirements: {
      requires_tools: local.requires_tools,
      requires_reasoning: local.requires_reasoning,
      requires_structured_output: local.requires_structured_output,
      requires_vision: local.requires_vision,
      minimum_context_tokens: local.minimum_context_tokens,
      minimum_output_tokens: local.minimum_output_tokens,
      task_type: explicit ?? jev.taskType,
    },
    classification_source: "jev",
    jev_task_type: jev.taskType,
    jev_task_type_confidence: jev.taskTypeConfidence,
    jev_difficulty: jev.difficulty,
    jev_difficulty_confidence: jev.difficultyConfidence,
  };
}
