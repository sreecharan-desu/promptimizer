/** Shared scoring used by live gate + benchmark-style checks. */

export function scoreAnswerLike(
  pred: string,
  promptOrGold: string,
  complexity: number,
  threshold = 0.62,
  must: string[] = [],
) {
  const blob = pred.toLowerCase();
  const autoMust =
    must.length > 0
      ? must
      : promptOrGold
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 6)
          .slice(0, 4);
  const coverage = autoMust.length
    ? autoMust.filter((n) => blob.includes(n.toLowerCase())).length / autoMust.length
    : pred.trim().length > 24
      ? 0.75
      : 0.3;
  const thin = complexity >= 4 && pred.trim().length < 80;
  const refusal = /i don't know|too complex|as a small model|can't help|cannot help/i.test(blob);
  const structure = pred.length > 80 ? 0.8 : pred.length > 24 ? 0.55 : 0.3;
  const score = 0.55 * coverage + 0.45 * structure;
  const degraded = thin || refusal || score < threshold;
  return {
    score,
    coverage,
    structure,
    degraded,
    notes: degraded ? ["below quality bar"] : ([] as string[]),
  };
}
