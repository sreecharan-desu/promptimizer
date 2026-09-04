import { scoreAnswerLike } from "./quality-gate-score";

export { scoreAnswerLike };

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
 * Live quality gate + optional periodic accuracy audit.
 * Audit re-checks length, refusal, and keyword coverage extracted from the prompt.
 */
export function runQualityGate(input: {
  answer: string;
  prompt: string;
  complexity: number;
  audit?: boolean;
}): QualityGateResult {
  const threshold = qualityEscalateThreshold();
  const base = scoreAnswerLike(input.answer, input.prompt, input.complexity, threshold);
  const audit = Boolean(input.audit);
  let audit_pass: boolean | null = null;
  const audit_notes: string[] = [];

  if (audit) {
    const must = extractMustFromPrompt(input.prompt);
    const auditScore = scoreAnswerLike(input.answer, input.prompt, input.complexity, threshold, must);
    const thin = input.answer.trim().length < Math.max(40, input.complexity * 20);
    const refusal = /i don't know|too complex|as a small model|can't help|cannot help/i.test(input.answer);
    audit_pass = !auditScore.degraded && !thin && !refusal && auditScore.score >= threshold;
    if (!audit_pass) {
      if (thin) audit_notes.push("audit_thin_answer");
      if (refusal) audit_notes.push("audit_refusal");
      if (auditScore.degraded) audit_notes.push("audit_below_threshold");
      if (must.length && auditScore.coverage < 0.5) audit_notes.push("audit_missing_prompt_concepts");
    } else {
      audit_notes.push("audit_ok");
    }
  }

  const gate: "pass" | "fail" = base.degraded || audit_pass === false ? "fail" : "pass";

  return {
    ...base,
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
