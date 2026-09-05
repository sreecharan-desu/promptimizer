import { cosineSimilarity, embedText } from "./semantic-cache";

/** Env helpers inlined to avoid circular import with quality-gate.ts */

function qualityEscalateThreshold() {
  const n = Number(process.env.QUALITY_ESCALATE_THRESHOLD ?? 0.62);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.62;
}

function qualityGuardEnabled() {
  const raw = (process.env.QUALITY_GUARD ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export type QualityStage = 1 | 2 | 3;

export type QualityVerdict = {
  score: number;
  coverage: number;
  structure: number;
  degraded: boolean;
  gate: "pass" | "fail";
  confident: boolean;
  escalate: boolean;
  stage: QualityStage;
  reasons: string[];
  self_consistency: number | null;
  judge: {
    correctness: number;
    completeness: number;
    usefulness: number;
    weighted: number;
    model: string;
    order?: string;
  } | null;
  stage2_skipped?: boolean;
  stage3_skipped?: boolean;
};

const REFUSAL_RE =
  /i don't know|too complex|as a small model|can't help|cannot help|i'm unable|i am unable|as an ai/i;
const HEDGE_RE = /\b(maybe|perhaps|not sure|i think|might be|possibly)\b/i;

function threshold() {
  return qualityEscalateThreshold();
}

function selfConsistencyFloor() {
  const n = Number(process.env.QUALITY_SELF_CONSISTENCY ?? 0.75);
  return Number.isFinite(n) ? Math.max(0.1, Math.min(1, n)) : 0.75;
}

export function judgeSampleRate() {
  const n = Number(process.env.QUALITY_JUDGE_RATE ?? 0.1);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.1;
}

function includesNeedle(blob: string, needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  // Regex needles: cap length to avoid ReDoS; substring fallback otherwise.
  if (n.startsWith("/") && n.lastIndexOf("/") > 0 && n.length <= 120) {
    try {
      const last = n.lastIndexOf("/");
      const body = n.slice(1, last);
      if (body.length > 80) return blob.includes(n);
      const re = new RegExp(body, (n.slice(last + 1) || "i").slice(0, 5));
      return re.test(blob);
    } catch {
      return blob.includes(n.replace(/^\/|\/[a-z]*$/gi, ""));
    }
  }
  return blob.includes(n.startsWith("/") ? n.replace(/^\/|\/[a-z]*$/gi, "") : n);
}

function promptLooksLikeCode(prompt: string) {
  return /```|write (a |an )?(python|ts|typescript|javascript|sql|function|class)|def |SELECT /i.test(prompt);
}

function promptLooksNumeric(prompt: string) {
  return /\b(number only|only the number|what is \d|compute|calculate|\d\s*[\*\^×x\/]\s*\d)/i.test(prompt);
}

function promptLooksList(prompt: string) {
  return /\b(list|bullet|numbered|enumerate|steps?:)\b/i.test(prompt);
}

function answerHasCode(text: string) {
  return /```|^\s*(def |function |class |const |let |import |SELECT )/m.test(text);
}

function answerHasNumber(text: string) {
  return /\d/.test(text);
}

function answerHasList(text: string) {
  return /^(\s*[-*•]|\s*\d+[\).])/m.test(text) || text.split("\n").filter((l) => l.trim()).length >= 3;
}

/**
 * Stage 1 — deterministic checks. Cheap, always runs.
 * Short answers are only penalized when coverage is also incomplete.
 */
export function stage1Deterministic(input: {
  answer: string;
  prompt: string;
  complexity: number;
  must_include?: string[];
  must_not_include?: string[];
}): Omit<QualityVerdict, "escalate" | "self_consistency" | "judge" | "stage2_skipped" | "stage3_skipped"> {
  const text = input.answer.trim();
  const blob = text.toLowerCase();
  const reasons: string[] = [];
  const must = input.must_include ?? [];
  const mustNot = input.must_not_include ?? [];
  const thr = threshold();

  if (!text) {
    return {
      score: 0.05,
      coverage: 0,
      structure: 0,
      degraded: true,
      gate: "fail",
      confident: true,
      stage: 1,
      reasons: ["empty_answer"],
    };
  }

  if (REFUSAL_RE.test(blob)) {
    return {
      score: 0.12,
      coverage: 0,
      structure: 0.1,
      degraded: true,
      gate: "fail",
      confident: true,
      stage: 1,
      reasons: ["refusal"],
    };
  }

  let coverage = 1;
  if (must.length > 0) {
    const hits = must.filter((n) => includesNeedle(blob, n)).length;
    coverage = hits / must.length;
    if (coverage < 1) reasons.push(`must_include_${hits}/${must.length}`);
  }

  let forbiddenHit = false;
  for (const bad of mustNot) {
    if (includesNeedle(blob, bad)) {
      forbiddenHit = true;
      reasons.push(`must_not_include:${bad.slice(0, 40)}`);
    }
  }

  let structure = 0.7;
  if (promptLooksLikeCode(input.prompt)) {
    if (answerHasCode(text)) structure = 0.9;
    else {
      structure = 0.25;
      reasons.push("expected_code");
    }
  } else if (promptLooksNumeric(input.prompt)) {
    if (answerHasNumber(text)) structure = 0.92;
    else {
      structure = 0.2;
      reasons.push("expected_number");
    }
  } else if (promptLooksList(input.prompt)) {
    if (answerHasList(text)) structure = 0.85;
    else {
      structure = 0.4;
      reasons.push("expected_list");
    }
  } else if (text.length > 80) {
    structure = 0.85;
  } else if (text.length > 24) {
    structure = 0.75;
  } else {
    structure = 0.7;
  }

  if (HEDGE_RE.test(blob) && input.complexity >= 3) {
    structure = Math.min(structure, 0.55);
    reasons.push("hedging");
  }

  if (/```[^`]*$/.test(text) || (/\b[a-z]{1,2}$/i.test(text) && text.length > 200 && !/[.!?)]$/.test(text))) {
    structure = Math.min(structure, 0.45);
    reasons.push("truncation");
  }

  const minLen = input.complexity >= 4 ? 80 : input.complexity >= 3 ? 36 : 1;
  const thin = text.length < minLen;
  if (thin && coverage < 0.85) {
    structure = Math.min(structure, 0.35);
    reasons.push("thin_with_incomplete_coverage");
  }

  let score = 0.55 * coverage + 0.45 * structure;
  if (forbiddenHit) score = Math.min(score, 0.25);

  if (input.complexity <= 2 && must.length === 0 && !forbiddenHit && !reasons.includes("expected_code")) {
    score = Math.max(score, 0.82);
  }
  if (must.length > 0 && coverage >= 0.99 && !forbiddenHit) {
    score = Math.max(score, 0.88);
  }

  const degraded =
    forbiddenHit ||
    coverage < 0.5 ||
    score < thr ||
    reasons.includes("expected_code") ||
    reasons.includes("expected_number");
  const gate: "pass" | "fail" = degraded ? "fail" : "pass";

  const confident =
    Boolean(text) &&
    (forbiddenHit ||
      (must.length > 0 && (coverage >= 0.99 || coverage < 0.34)) ||
      reasons.includes("expected_code") ||
      reasons.includes("expected_number") ||
      (input.complexity <= 2 && gate === "pass" && !thin) ||
      (gate === "pass" && must.length > 0 && coverage >= 0.99) ||
      reasons.includes("refusal"));

  if (gate === "pass" && reasons.length === 0) reasons.push("stage1_ok");

  return {
    score: Number(score.toFixed(4)),
    coverage: Number(coverage.toFixed(4)),
    structure: Number(structure.toFixed(4)),
    degraded,
    gate,
    confident,
    stage: 1,
    reasons,
  };
}

export function meanPairwiseSimilarity(texts: string[]): number {
  if (texts.length < 2) return 1;
  const embeds = texts.map((t) => embedText(t));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < embeds.length; i += 1) {
    for (let j = i + 1; j < embeds.length; j += 1) {
      sum += cosineSimilarity(embeds[i], embeds[j]);
      n += 1;
    }
  }
  return n ? sum / n : 1;
}

function parseJudgeScores(raw: string): { correctness: number; completeness: number; usefulness: number } | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Record<string, unknown>;
    const correctness = Number(obj.correctness ?? obj.Correctness);
    const completeness = Number(obj.completeness ?? obj.Completeness);
    const usefulness = Number(obj.usefulness ?? obj.Usefulness);
    if (![correctness, completeness, usefulness].every((x) => Number.isFinite(x))) return null;
    return {
      correctness: Math.max(0, Math.min(5, correctness)),
      completeness: Math.max(0, Math.min(5, completeness)),
      usefulness: Math.max(0, Math.min(5, usefulness)),
    };
  } catch {
    return null;
  }
}

export function pickJudgeModel(
  fleet: Array<{ id: string; provider_id?: string; tier?: string }>,
  routedId: string,
): string | null {
  const forced = process.env.QUALITY_JUDGE_MODEL?.trim();
  if (forced) return forced;
  const family = (id: string) => id.split("/")[0]?.toLowerCase() || id.split("-")[0]?.toLowerCase() || id;
  const routedFamily = family(routedId);
  const other = fleet.find((m) => family(m.id) !== routedFamily);
  return other?.id ?? fleet.find((m) => m.id !== routedId)?.id ?? null;
}

export type SampleFn = (args: { temperature: number; max_tokens?: number }) => Promise<string>;

export type JudgeFn = (args: { prompt: string; answer: string; judgeModel: string }) => Promise<string>;

/**
 * Full three-stage gate. Stages 2–3 only run when needed / sampled.
 */
export async function evaluateQualityGate(input: {
  answer: string;
  prompt: string;
  complexity: number;
  must_include?: string[];
  must_not_include?: string[];
  allow_expensive?: boolean;
  session_mode?: string;
  routed_model?: string;
  fleet?: Array<{ id: string; provider_id?: string; tier?: string }>;
  sample?: SampleFn;
  judge?: JudgeFn;
  force_no_judge?: boolean;
  random?: () => number;
}): Promise<QualityVerdict> {
  const s1 = stage1Deterministic(input);
  const baseEscalate = s1.gate === "fail";

  if (s1.confident || input.allow_expensive === false) {
    return {
      ...s1,
      escalate: baseEscalate,
      self_consistency: null,
      judge: null,
      stage2_skipped: !s1.confident && input.allow_expensive === false ? true : undefined,
      stage3_skipped: s1.confident ? true : undefined,
    };
  }

  let stage: QualityStage = 1;
  let selfConsistency: number | null = null;
  let score = s1.score;
  let reasons = [...s1.reasons];
  let escalate = baseEscalate;
  let gate = s1.gate;
  let degraded = s1.degraded;
  let stage2_skipped = false;

  const canSample = Boolean(input.sample);
  if (canSample && input.sample) {
    try {
      const a = await input.sample({ temperature: 0.8, max_tokens: 400 });
      const b = await input.sample({ temperature: 0.8, max_tokens: 400 });
      selfConsistency = meanPairwiseSimilarity([input.answer, a, b]);
      stage = 2;
      reasons.push(`self_consistency:${selfConsistency.toFixed(3)}`);
      if (selfConsistency < selfConsistencyFloor()) {
        escalate = true;
        gate = "fail";
        degraded = true;
        score = Math.min(score, 0.4);
        reasons.push("low_self_consistency");
      } else if (!escalate) {
        score = Math.max(score, 0.7);
        reasons.push("self_consistency_ok");
      }
    } catch {
      stage2_skipped = true;
      reasons.push("stage2_error");
    }
  } else {
    stage2_skipped = true;
    reasons.push("stage2_skipped");
  }

  const stillUncertain = escalate || selfConsistency == null || selfConsistency < 0.9;
  const rand = input.random ?? Math.random;
  const sampleJudge = !input.force_no_judge && stillUncertain && rand() < judgeSampleRate();

  let judge: QualityVerdict["judge"] = null;
  let stage3_skipped = !sampleJudge;

  if (sampleJudge && input.judge && input.fleet && input.routed_model) {
    const judgeModel = pickJudgeModel(input.fleet, input.routed_model);
    if (judgeModel) {
      try {
        const raw = await input.judge({
          prompt: input.prompt,
          answer: input.answer,
          judgeModel,
        });
        const parsed = parseJudgeScores(raw);
        if (parsed) {
          const weighted = (2 * parsed.correctness + parsed.completeness + parsed.usefulness) / 20;
          judge = { ...parsed, weighted, model: judgeModel };
          stage = 3;
          score = weighted;
          reasons.push(`judge_weighted:${weighted.toFixed(3)}`);
          if (weighted < threshold()) {
            escalate = true;
            gate = "fail";
            degraded = true;
            reasons.push("judge_below_threshold");
          } else {
            escalate = false;
            gate = "pass";
            degraded = false;
            reasons.push("judge_pass");
          }
          stage3_skipped = false;
        } else {
          reasons.push("judge_parse_failed");
        }
      } catch {
        reasons.push("judge_error");
      }
    } else {
      reasons.push("no_judge_model");
    }
  }

  return {
    score: Number(score.toFixed(4)),
    coverage: s1.coverage,
    structure: s1.structure,
    degraded,
    gate,
    confident: s1.confident,
    escalate: qualityGuardEnabled() ? escalate : false,
    stage,
    reasons,
    self_consistency: selfConsistency,
    judge,
    stage2_skipped: stage2_skipped || undefined,
    stage3_skipped: stage3_skipped || undefined,
  };
}

/** Sync helper for benchmarks / simple callers (stage 1 only). */
export function scoreAnswerLike(
  pred: string,
  promptOrGold: string,
  complexity: number,
  thr = 0.62,
  must: string[] = [],
  mustNot: string[] = [],
) {
  const prev = process.env.QUALITY_ESCALATE_THRESHOLD;
  process.env.QUALITY_ESCALATE_THRESHOLD = String(thr);
  try {
    const v = stage1Deterministic({
      answer: pred,
      prompt: promptOrGold,
      complexity,
      must_include: must,
      must_not_include: mustNot,
    });
    return {
      score: v.score,
      coverage: v.coverage,
      structure: v.structure,
      degraded: v.degraded,
      notes: v.reasons,
    };
  } finally {
    if (prev === undefined) delete process.env.QUALITY_ESCALATE_THRESHOLD;
    else process.env.QUALITY_ESCALATE_THRESHOLD = prev;
  }
}
