import type { ChatMessage, Classification, Tier } from "./types";

const HIGH_RISK = new Set(["system_design", "safety_sensitive", "code_debug", "reasoning"]);

const TIER_RANK: Record<Tier, number> = { economy: 0, standard: 1, frontier: 2 };

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

/** Production classifier — prefer over-routing hard work over silent quality loss. */
export function classifyText(text: string): Classification {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split("\n").length;
  const numbered =
    (text.match(/\(\s*\d+\s*\)/g) ?? []).length +
    (text.match(/^\s*\d+[\).:]/gm) ?? []).length +
    (text.match(/\b\d+\.\s+[A-Za-z]/g) ?? []).length;
  const constraintWords = (
    text.match(
      /\b(must|include|constraint|requirement|requirements|need to|ensure|exactly-once|idempotent)\b/gi,
    ) ?? []
  ).length;

  const features = {
    code_fence: /```/.test(text),
    code_kw:
      /\b(def |class |function |import |fn |pub |async |goroutine|mutex|traceback)\b/i.test(text) ||
      /\b(SELECT\b.+\bFROM\b|\bJOIN\b.+\bON\b|postgresql|\bpsql\b)/i.test(text),
    math: /(\$\$|\\frac|prove that|expected value|O\([nN]\)|\d+\s*[\*\^×x]\s*\d+|infinitely many|factorial|prime)/i.test(
      text,
    ),
    design:
      /\b(design(?:ing)?|architect(?:ure|ing)?|rate[\s-]?limiter|distributed|consistency|shard(?:ing)?|multi-?region|multi-?tenant|qps|edge regions?|data[\s-]?plane|failure modes?|outbox|ledger|webhook|saas|billing pipeline|consensus|raft|paxos|quorum|leader election|log replication|network partition|cap theorem|eventual consistency|token bucket|sliding window)\b/i.test(
        text,
      ),
    reason:
      /\b(prove|proof|theorem|lemma|why does|walk through|step by step|derive|contradiction|p-value|induction|euclid|sketch (?:a |the )?proof)\b/i.test(
        text,
      ),
    debug:
      /\b(bug|race|panic|fails on|diagnose|deadlock|concurrency hazard|code review|correctness)\b/i.test(
        text,
      ),
    summarize: /\b(summarize|tl;dr|in two sentences|eli5)\b/i.test(text),
    translate: /\b(translate|traduce)\b/i.test(text),
    creative: /\b(write a (poem|story|song)|haiku)\b/i.test(text),
    safety:
      /\b(refund|legal|medical|hipaa|lawsuit|diagnosis|gdpr|erasure|pii|compliance|audit trail)\b/i.test(
        text,
      ),
    analysis:
      /\b(compare|trade-?off|versus|analyse|analyze|evaluate|should we|outline architecture)\b/i.test(
        text,
      ),
    multi_part: numbered >= 3 || (numbered >= 2 && constraintWords >= 1),
    constraints: constraintWords + Math.min(4, numbered),
    words,
    lines,
    question_marks: (text.match(/\?/g) ?? []).length,
    long_form: words >= 55 || lines >= 8,
  };

  const category = categoryOf(features);
  const complexity = complexityOf(features, category);
  const p_small_quality = pSmallQuality(features, category, complexity);
  const quality_risk = riskOf(category, complexity, p_small_quality);
  const recommended_tier = recommendTier(p_small_quality, complexity, category, quality_risk);
  const signals = [
    features.code_fence,
    features.code_kw,
    features.math,
    features.design,
    features.reason,
    features.debug,
    features.safety,
    features.multi_part,
  ].filter(Boolean).length;
  const confidence =
    category === "factual_recall" && words < 16 ? 0.92 : Math.min(0.96, 0.55 + 0.1 * signals);

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
  // Architecture / distributed systems win over incidental compliance keywords (e.g. GDPR in a design brief).
  if (h.design) return "system_design";
  if (h.safety && !h.design) return "safety_sensitive";
  if (h.debug && (h.code_fence || h.code_kw)) return "code_debug";
  if (h.debug && h.long_form) return "code_debug";
  // Pure proofs before code heuristics — "from Euclid" must not look like SQL.
  if (h.math && h.reason) return "reasoning";
  if (h.reason) return "reasoning";
  if (h.code_fence || h.code_kw) return "code_generation";
  if (h.math) return "math";
  if (h.safety) return "safety_sensitive";
  if (h.translate) return "translation";
  if (h.summarize) return "summarization";
  if (h.creative) return "creative";
  if (h.analysis || h.multi_part) return "analysis";
  if ((h.words as number) < 28 && (h.question_marks as number) >= 1) return "factual_recall";
  return (h.words as number) > 80 ? "analysis" : "factual_recall";
}

function complexityOf(h: Record<string, unknown>, category: string): number {
  let score = 1;
  if ((h.words as number) > 35) score += 1;
  if ((h.words as number) > 90) score += 1;
  if ((h.lines as number) > 10 || h.code_fence) score += 1;
  if ((h.constraints as number) >= 2) score += 1;
  if ((h.constraints as number) >= 4 || h.multi_part) score += 1;
  if (h.design) score += 1;
  if (h.reason) score += 1;
  if (h.debug) score += 1;
  if (h.safety && (h.design || h.multi_part)) score += 1;

  // Hard floors — paid traffic must not under-route these.
  if (category === "system_design") score = Math.max(score, 4);
  if (category === "reasoning") score = Math.max(score, 4);
  if (category === "safety_sensitive") score = Math.max(score, 4);
  if (category === "code_debug") score = Math.max(score, 4);
  if (category === "code_generation") score = Math.max(score, 3);
  if (category === "analysis" && (h.multi_part || h.long_form)) score = Math.max(score, 3);
  if (h.multi_part && (h.design || h.safety || h.analysis)) score = Math.max(score, 4);

  // Keep trivial Q&A / chitchat cheap.
  if (category === "factual_recall" && (h.words as number) < 28 && !h.design && !h.reason && !h.debug) {
    score = Math.min(score, 2);
  }
  if (
    (h.words as number) <= 8 &&
    !h.design &&
    !h.reason &&
    !h.debug &&
    !h.code_fence &&
    !h.code_kw &&
    !h.safety &&
    !h.multi_part
  ) {
    score = Math.min(score, 2);
  }
  if (category === "math" && (h.words as number) < 24 && !h.reason) {
    score = Math.min(Math.max(score, 1), 2);
  }

  return Math.max(1, Math.min(5, score));
}

function pSmallQuality(h: Record<string, unknown>, category: string, complexity: number): number {
  let p = 0.96;
  if (h.design || category === "system_design") p -= 0.3;
  if (h.safety || category === "safety_sensitive") p -= 0.32;
  if (h.debug || category === "code_debug") p -= 0.24;
  if (h.reason || category === "reasoning") p -= 0.22;
  if (h.multi_part) p -= 0.1;
  if (complexity >= 5) p -= 0.24;
  else if (complexity >= 4) p -= 0.16;
  else if (complexity === 3) p -= 0.07;
  if ((h.words as number) > 100) p -= 0.07;
  if ((h.constraints as number) >= 3) p -= 0.08;
  if (category === "code_generation") p -= 0.06;
  if (category === "analysis" && complexity >= 3) p -= 0.08;
  if (category === "factual_recall" && (h.words as number) < 28) p = Math.max(p, 0.94);
  if (category === "math" && (h.words as number) < 24 && !h.reason) p = Math.max(p, 0.9);
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

/** Never recommend below the complexity floor — under-routing is the expensive failure mode. */
function recommendTier(
  p: number,
  complexity: number,
  category: string,
  risk: Classification["quality_risk"],
): Tier {
  const fromP = tierFromP(p);
  const fromComplexity = difficultyTier(complexity);
  let tier = maxTier(fromP, fromComplexity);
  if (risk === "high") tier = maxTier(tier, "standard");
  if (["system_design", "reasoning", "safety_sensitive"].includes(category) && complexity >= 4) {
    tier = maxTier(tier, complexity >= 5 ? "frontier" : "standard");
  }
  if (category === "system_design" && complexity >= 4) tier = maxTier(tier, "frontier");
  if (category === "reasoning" && complexity >= 4) tier = maxTier(tier, "standard");
  return tier;
}

function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function difficultyTier(complexity: number): Tier {
  if (complexity <= 2) return "economy";
  if (complexity === 3) return "standard";
  return "frontier";
}
