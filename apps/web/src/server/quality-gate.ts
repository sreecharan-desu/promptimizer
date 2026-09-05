import { scoreAnswerLike, stage1Deterministic } from "./quality";

export { scoreAnswerLike };
export {
  evaluateQualityGate,
  stage1Deterministic,
  pickJudgeModel,
  judgeSampleRate,
  meanPairwiseSimilarity,
} from "./quality";
export type { QualityVerdict, QualityStage } from "./quality";

/** Env QUALITY_ESCALATE_THRESHOLD (default 0.62). */
export function qualityEscalateThreshold() {
  const n = Number(process.env.QUALITY_ESCALATE_THRESHOLD ?? 0.62);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.62;
}

export function qualityGuardEnabled() {
  const raw = (process.env.QUALITY_GUARD ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/** Run a deeper accuracy audit every N live requests (default 5). */
export function qualityAuditEvery() {
  const n = Number(process.env.QUALITY_AUDIT_EVERY ?? 5);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

const counters = new Map<string, number>();

export function nextRequestOrdinal(sessionId: string) {
  const next = (counters.get(sessionId) ?? 0) + 1;
  counters.set(sessionId, next);
  return next;
}

export function shouldRunAccuracyAudit(ordinal: number) {
  return ordinal % qualityAuditEvery() === 0;
}

export type QualityGateResult = {
  score: number;
  coverage: number;
  structure: number;
  degraded: boolean;
  notes: string[];
  gate: "pass" | "fail";
  audit: boolean;
  audit_pass: boolean | null;
  audit_notes: string[];
};

/**
 * Live quality gate + optional periodic accuracy audit (stage 1).
 */
export function runQualityGate(input: {
  answer: string;
  prompt: string;
  complexity: number;
  audit?: boolean;
  must_include?: string[];
  must_not_include?: string[];
}): QualityGateResult {
  const base = stage1Deterministic({
    answer: input.answer,
    prompt: input.prompt,
    complexity: input.complexity,
    must_include: input.must_include,
    must_not_include: input.must_not_include,
  });
  const audit = Boolean(input.audit);
  let audit_pass: boolean | null = null;
  const audit_notes: string[] = [];

  if (audit) {
    const must = input.must_include?.length ? input.must_include : extractMustFromPrompt(input.prompt);
    const auditScore = stage1Deterministic({
      answer: input.answer,
      prompt: input.prompt,
      complexity: input.complexity,
      must_include: must,
      must_not_include: input.must_not_include,
    });
    audit_pass = auditScore.gate === "pass";
    if (!audit_pass) {
      audit_notes.push(...auditScore.reasons.map((r) => `audit_${r}`));
    } else {
      audit_notes.push("audit_ok");
    }
  }

  const gate: "pass" | "fail" = base.gate === "fail" || audit_pass === false ? "fail" : "pass";

  return {
    score: base.score,
    coverage: base.coverage,
    structure: base.structure,
    degraded: base.degraded || audit_pass === false,
    notes: base.reasons,
    gate,
    audit,
    audit_pass,
    audit_notes,
  };
}

function extractMustFromPrompt(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);
  const stop = new Set([
    "about",
    "would",
    "could",
    "should",
    "please",
    "explain",
    "describe",
    "write",
    "using",
    "with",
    "from",
    "that",
    "this",
    "these",
    "those",
    "which",
    "where",
    "when",
    "what",
    "your",
    "have",
    "there",
    "their",
    "provide",
    "answer",
    "question",
  ]);
  const uniq: string[] = [];
  for (const w of words) {
    if (stop.has(w)) continue;
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= 6) break;
  }
  return uniq;
}
