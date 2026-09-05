/** RouteLLM-style routing metrics: PGR, APGR, CPT, difficulty buckets. */

/** Break-even escalation rate: routing loses when e > 1 - (Cs + Cj) / Cl. */
export function breakEvenEscalationRate(smallCost: number, frontierCost: number, gateCost = 0) {
  if (!(frontierCost > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - (smallCost + gateCost) / frontierCost));
}

export type DifficultyBucket = "easy" | "medium" | "hard";

export function difficultyBucket(d: number): DifficultyBucket {
  if (d <= 2) return "easy";
  if (d === 3) return "medium";
  return "hard";
}

/** Performance Gap Recovered: (router - weak) / (strong - weak). */
export function pgr(routerQuality: number, weakQuality: number, strongQuality: number) {
  const denom = strongQuality - weakQuality;
  if (Math.abs(denom) < 1e-9) return routerQuality >= strongQuality - 1e-9 ? 1 : 0;
  return (routerQuality - weakQuality) / denom;
}

/**
 * Average PGR across a sweep of frontier-call fractions.
 * points: [{ frontier_call_pct: 0..1, quality }] sorted by frontier_call_pct.
 */
export function apgr(points: Array<{ frontier_call_pct: number; quality: number }>, weak: number, strong: number) {
  if (!points.length) return 0;
  const sorted = [...points].sort((a, b) => a.frontier_call_pct - b.frontier_call_pct);
  let area = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const x0 = sorted[i - 1].frontier_call_pct;
    const x1 = sorted[i].frontier_call_pct;
    const y0 = pgr(sorted[i - 1].quality, weak, strong);
    const y1 = pgr(sorted[i].quality, weak, strong);
    area += ((y0 + y1) / 2) * (x1 - x0);
  }
  return area;
}

/** Minimum frontier-call % needed to recover targetFraction of the quality gap (e.g. 0.5, 0.8). */
export function cpt(
  points: Array<{ frontier_call_pct: number; quality: number }>,
  weak: number,
  strong: number,
  targetFraction: number,
) {
  const sorted = [...points].sort((a, b) => a.frontier_call_pct - b.frontier_call_pct);
  for (const pt of sorted) {
    if (pgr(pt.quality, weak, strong) >= targetFraction) return pt.frontier_call_pct;
  }
  return 1;
}

export function bucketStats(
  rows: Array<{ difficulty: number; quality_routed: number; quality_frontier: number }>,
) {
  const buckets: Record<
    DifficultyBucket,
    { n: number; avg_routed: number; avg_frontier: number; worst_regression: number; deltas: number[] }
  > = {
    easy: { n: 0, avg_routed: 0, avg_frontier: 0, worst_regression: 0, deltas: [] },
    medium: { n: 0, avg_routed: 0, avg_frontier: 0, worst_regression: 0, deltas: [] },
    hard: { n: 0, avg_routed: 0, avg_frontier: 0, worst_regression: 0, deltas: [] },
  };
  for (const row of rows) {
    const b = difficultyBucket(row.difficulty);
    const delta = row.quality_routed - row.quality_frontier;
    buckets[b].n += 1;
    buckets[b].deltas.push(delta);
    buckets[b].avg_routed += row.quality_routed;
    buckets[b].avg_frontier += row.quality_frontier;
  }
  for (const key of Object.keys(buckets) as DifficultyBucket[]) {
    const b = buckets[key];
    if (b.n) {
      b.avg_routed /= b.n;
      b.avg_frontier /= b.n;
      b.worst_regression = Math.min(0, ...b.deltas);
    }
    delete (b as { deltas?: number[] }).deltas;
  }
  return buckets;
}

/** Build frontier curve by mixing weak/strong answers at increasing frontier fractions. */
export function buildFrontierCurve(
  weakScores: number[],
  strongScores: number[],
  steps = 11,
): Array<{ frontier_call_pct: number; quality: number }> {
  const n = Math.min(weakScores.length, strongScores.length);
  if (!n) return [];
  const points: Array<{ frontier_call_pct: number; quality: number }> = [];
  for (let s = 0; s < steps; s += 1) {
    const frac = s / (steps - 1);
    const k = Math.round(frac * n);
    // Use strong for first k (sorted by weak gap), weak for rest — approximate CPT sweep.
    const gaps = weakScores.map((w, i) => ({ i, gap: strongScores[i] - w }));
    gaps.sort((a, b) => b.gap - a.gap);
    const useStrong = new Set(gaps.slice(0, k).map((g) => g.i));
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += useStrong.has(i) ? strongScores[i] : weakScores[i];
    points.push({ frontier_call_pct: frac, quality: sum / n });
  }
  return points;
}
