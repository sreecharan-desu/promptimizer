import type { ChatMessage, Classification, Tier } from "./types";

const HIGH_RISK = new Set(["system_design", "safety_sensitive", "code_debug", "reasoning"]);

function textFrom(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      return m.content.map((b) => b.text ?? "").join("\n");
    })
    .join("\n")
    .trim();
}

export function classifyMessages(messages: ChatMessage[]): Classification {
  return classifyText(textFrom(messages));
}

export function classifyText(text: string): Classification {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split("\n").length;
  const features = {
    code_fence: /```/.test(text),
    code_kw:
      /\b(def |class |function |import |fn |pub |async |SELECT |goroutine|mutex|traceback)\b/i.test(
        text,
      ),
    math: /(\$\$|\\frac|prove that|expected value|O\([nN]\)|\d+\s*[\*\^]\s*\d+)/i.test(text),
    design:
      /\b(design|architect|rate limiter|distributed|consistency|shard|1 million QPS)\b/i.test(
        text,
      ),
    reason: /\b(prove|why does|walk through|step by step|derive|contradiction|p-value)\b/i.test(
      text,
    ),
    debug: /\b(bug|race|panic|fails on|diagnose|deadlock)\b/i.test(text),
    summarize: /\b(summarize|tl;dr|in two sentences|eli5)\b/i.test(text),
    translate: /\b(translate|traduce)\b/i.test(text),
    creative: /\b(write a (poem|story|song)|haiku)\b/i.test(text),
    safety: /\b(refund|legal|medical|hipaa|lawsuit|diagnosis)\b/i.test(text),
    analysis: /\b(compare|trade-?off|versus|analyse|analyze|evaluate|should we)\b/i.test(text),
    constraints: (text.match(/\b(must|include|constraints?|requirements?)\b/gi) ?? []).length,
    words,
    lines,
    question_marks: (text.match(/\?/g) ?? []).length,
  };

  const category = categoryOf(features);
  const complexity = complexityOf(features, category);
  const p_small_quality = pSmallQuality(features, category, complexity);
  const quality_risk = riskOf(category, complexity, p_small_quality);
  const recommended_tier = tierFromP(p_small_quality);
  const signals = [
    features.code_fence,
    features.code_kw,
    features.math,
    features.design,
    features.reason,
    features.debug,
    features.safety,
  ].filter(Boolean).length;
  const confidence =
    category === "factual_recall" && words < 16 ? 0.9 : Math.min(0.95, 0.55 + 0.12 * signals);

  return {
    complexity,
    category,
    confidence: Number(confidence.toFixed(3)),
    recommended_tier,
    quality_risk,
    p_small_quality,
    uncertainty: Number((1 - p_small_quality).toFixed(3)),
    structured_output: Boolean(features.code_fence || (features.constraints as number) >= 1),
    context_tokens_est: Math.max(1, Math.round(text.length / 4)),
    rationale: `${category.replaceAll("_", " ")} L${complexity}. P(quality|small)=${p_small_quality}. Route to ${recommended_tier}.`,
    features,
  };
}

function categoryOf(h: Record<string, unknown>): string {
  if (h.safety) return "safety_sensitive";
  if (h.design) return "system_design";
  if (h.debug && (h.code_fence || h.code_kw)) return "code_debug";
  if (h.code_fence || h.code_kw) return "code_generation";
  if (h.math && h.reason) return "reasoning";
  if (h.math) return "math";
  if (h.reason) return "reasoning";
  if (h.translate) return "translation";
  if (h.summarize) return "summarization";
  if (h.creative) return "creative";
  if (h.analysis) return "analysis";
  if ((h.words as number) < 24 && (h.question_marks as number) >= 1) return "factual_recall";
  return (h.words as number) > 80 ? "analysis" : "factual_recall";
}

function complexityOf(h: Record<string, unknown>, category: string): number {
  let score = 1;
  if ((h.words as number) > 40) score += 1;
  if ((h.words as number) > 120) score += 1;
  if ((h.lines as number) > 12 || h.code_fence) score += 1;
  if ((h.constraints as number) >= 2) score += 1;
  if (h.design || h.reason) score += 1;
  if (h.debug) score += 1;
  if (["system_design", "reasoning", "safety_sensitive"].includes(category)) score = Math.max(score + 1, 4);
  if (category === "code_generation") score = Math.max(score, 3);
  if (category === "code_debug") score = Math.max(score, 4);
  if (category === "factual_recall" && (h.words as number) < 20) score = Math.min(score, 2);
  return Math.max(1, Math.min(5, score));
}

function pSmallQuality(h: Record<string, unknown>, category: string, complexity: number): number {
  let p = 0.96;
  if (h.design || category === "system_design") p -= 0.28;
  if (h.safety || category === "safety_sensitive") p -= 0.3;
  if (h.debug || category === "code_debug") p -= 0.22;
  if (h.reason || category === "reasoning") p -= 0.18;
  if (complexity >= 5) p -= 0.22;
  else if (complexity >= 4) p -= 0.14;
  else if (complexity === 3) p -= 0.06;
  if ((h.words as number) > 120) p -= 0.07;
  if ((h.constraints as number) >= 2) p -= 0.07;
  if (category === "code_generation") p -= 0.05;
  if (category === "factual_recall" && (h.words as number) < 24) p = Math.max(p, 0.94);
  return Number(Math.min(0.99, Math.max(0.05, p)).toFixed(3));
}

function riskOf(category: string, complexity: number, p: number): Classification["quality_risk"] {
  if (HIGH_RISK.has(category) || complexity >= 5 || p < 0.72) return "high";
  if (complexity >= 3 || p < 0.9) return "medium";
  return "low";
}

function tierFromP(p: number): Tier {
  if (p >= 0.9) return "economy";
  if (p >= 0.72) return "standard";
  return "frontier";
}

export function difficultyTier(complexity: number): Tier {
  if (complexity <= 2) return "economy";
  if (complexity === 3) return "standard";
  return "frontier";
}
