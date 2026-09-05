export type PriceRow = {
  input: number;
  output: number;
  tier: string;
  /** Cached input $/1M when known. Missing ⇒ estimate at 50% of input. */
  cached_input?: number;
};

export const PRICING: Record<string, PriceRow> = {
  "gpt-4o": { input: 2.5, output: 10, tier: "frontier", cached_input: 0.25 },
  "gpt-4.1": { input: 2, output: 8, tier: "frontier", cached_input: 0.2 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, tier: "economy", cached_input: 0.04 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, tier: "economy", cached_input: 0.015 },
  "claude-opus-4": { input: 15, output: 75, tier: "frontier", cached_input: 1.5 },
  "claude-sonnet-4": { input: 3, output: 15, tier: "standard", cached_input: 0.3 },
  "claude-haiku-4": { input: 0.8, output: 4, tier: "economy", cached_input: 0.08 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6, tier: "economy", cached_input: 0.0375 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08, tier: "economy", cached_input: 0.025 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79, tier: "standard", cached_input: 0.295 },
  "deepseek-chat": { input: 0.27, output: 1.1, tier: "economy", cached_input: 0.027 },
  "promptimizer-nano": { input: 0.05, output: 0.1, tier: "economy", cached_input: 0.025 },
  "promptimizer-flash": { input: 0.3, output: 0.9, tier: "standard", cached_input: 0.15 },
  "promptimizer-frontier": { input: 5, output: 15, tier: "frontier", cached_input: 2.5 },
  "thinkingmachines/inkling-small": { input: 0.1, output: 0.4, tier: "economy" },
  "thinkingmachines/inkling": { input: 0.4, output: 1.6, tier: "standard" },
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6, tier: "standard", cached_input: 0.015 },
  "zai-org/GLM-4.7": { input: 0.4, output: 1.5, tier: "standard" },
  "zai-org/GLM-5.2": { input: 0.6, output: 2.2, tier: "standard" },
  "zai-org/GLM-5.2-Fast": { input: 0.35, output: 1.4, tier: "standard" },
  "zai-org/GLM-5.3": { input: 0.8, output: 3.2, tier: "frontier" },
  "zai-org/GLM-5.3-Flash": { input: 0.45, output: 1.8, tier: "standard" },
  "zai-org/GLM-5.3-Fast": { input: 0.5, output: 2.0, tier: "standard" },
  "moonshotai/Kimi-K2.6": { input: 0.55, output: 2.2, tier: "standard" },
  "moonshotai/Kimi-K2.7-Code": { input: 0.55, output: 2.2, tier: "standard" },
  "moonshotai/Kimi-K3": { input: 0.9, output: 3.5, tier: "frontier" },
  "deepseek-ai/DeepSeek-V4-Flash-0731": { input: 0.2, output: 0.8, tier: "standard", cached_input: 0.02 },
  "deepseek-ai/DeepSeek-V4-Pro": { input: 0.7, output: 2.8, tier: "standard", cached_input: 0.07 },
  "deepseek-ai/DeepSeek-V4-Pro-0813": { input: 0.7, output: 2.8, tier: "standard", cached_input: 0.07 },
  "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B": { input: 1.2, output: 4.8, tier: "frontier" },
};

export const BENCHMARK = [
  { id: "e01", difficulty: 1, category: "factual_recall", prompt: "What is the capital of France?", must_include: ["Paris"], must_not_include: ["London", "Berlin"], gold: "Paris is the capital of France." },
  { id: "e02", difficulty: 1, category: "factual_recall", prompt: "Convert 100 degrees Fahrenheit to Celsius. Give the number only.", must_include: ["37"], must_not_include: ["212"], gold: "37.8" },
  { id: "e03", difficulty: 1, category: "factual_recall", prompt: "What does HTTP stand for?", must_include: ["HyperText Transfer Protocol", "Hypertext Transfer Protocol"], must_not_include: [], gold: "HyperText Transfer Protocol" },
  { id: "e04", difficulty: 1, category: "math", prompt: "What is 17 * 24?", must_include: ["408"], must_not_include: ["401", "418"], gold: "408" },
  { id: "e05", difficulty: 2, category: "summarization", prompt: "In two sentences, explain what a REST API is.", must_include: ["HTTP", "resource"], must_not_include: [], gold: "A REST API is an HTTP interface that exposes resources through uniform methods like GET and POST." },
  { id: "m01", difficulty: 3, category: "code_generation", prompt: "Write a Python function that returns the nth Fibonacci number iteratively.", must_include: ["def", "fib"], must_not_include: [], gold: "def fib(n):\n    a,b=0,1\n    for _ in range(n): a,b=b,a+b\n    return a" },
  { id: "m02", difficulty: 3, category: "analysis", prompt: "Compare B-trees and LSM trees for write-heavy workloads in three bullets.", must_include: ["LSM", "write"], must_not_include: [], gold: "LSM trees absorb writes into memtables; B-trees update pages in place; write amplification differs." },
  { id: "m03", difficulty: 3, category: "code_generation", prompt: "Write SQL to count orders per user email joining users and orders.", must_include: ["JOIN", "COUNT"], must_not_include: [], gold: "SELECT u.email, COUNT(o.id) FROM users u JOIN orders o ON o.user_id=u.id GROUP BY u.email;" },
  { id: "m04", difficulty: 3, category: "reasoning", prompt: "A bat and ball cost $1.10. The bat costs $1 more than the ball. How much is the ball?", must_include: ["0.05", "5 cents", "$0.05"], must_not_include: ["0.10", "10 cents"], gold: "The ball costs $0.05." },
  { id: "m05", difficulty: 3, category: "code_debug", prompt: "This Python dict cache has a race under threads. Name the hazard in one sentence.\n\ncache={}\ndef get(k):\n  if k in cache: return cache[k]\n  v=load(k); cache[k]=v; return v", must_include: ["race", "thread"], must_not_include: [], gold: "Check-then-act on a shared dict races between threads." },
  { id: "h01", difficulty: 5, category: "system_design", prompt: "Design a rate limiter that supports 1 million QPS across 50 edge regions, per-API-key quotas, and burst tokens. Discuss consistency, failure modes, and a concrete Redis/data-plane sketch.", must_include: ["token bucket", "Redis", "eventual"], must_not_include: ["single global lock"], gold: "Distributed token bucket on Redis with eventual refill." },
  { id: "h02", difficulty: 5, category: "reasoning", prompt: "Give a short proof sketch that there are infinitely many primes (Euclid).", must_include: ["prime", "product", "1"], must_not_include: [], gold: "Assume finite primes, form N=product+1, contradiction." },
  { id: "h03", difficulty: 4, category: "system_design", prompt: "Explain Raft leader election and log replication for a 5-node cluster under a 2 vs 3 partition.", must_include: ["quorum", "term", "leader"], must_not_include: [], gold: "Majority quorum; minority cannot commit." },
  { id: "h04", difficulty: 4, category: "safety_sensitive", prompt: "What is your refund policy for medical device purchases over $500?", must_include: ["refund", "policy"], must_not_include: ["guaranteed full refund always"], gold: "Follow published policy; escalate medical/legal cases." },
  { id: "h05", difficulty: 5, category: "analysis", prompt: "To cut cloud costs 60% we'll move all workloads to spot instances and delete anything untouched for 30 days. Critique this plan.", must_include: ["compliance", "spot", "risk"], must_not_include: ["great plan", "do it"], gold: "Spot eviction + deleting cold compliance data is dangerous." },
];
