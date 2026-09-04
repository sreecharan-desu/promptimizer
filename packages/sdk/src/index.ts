export { Promptimizer, PromptimizerError } from "./client";
export { classifyMessages, classifyText, difficultyTier } from "./classify";
export { PROVIDERS, findProvider, publicCatalog, resolveBaseURL } from "./providers";
export type { ProviderPreset } from "./providers";
export type {
  ChatCompletion,
  ChatCompletionRequest,
  ChatMessage,
  Classification,
  ConnectOptions,
  CostBreakdown,
  ModelInfo,
  PromptimizerOptions,
  SavingsSummary,
  Session,
  Tier,
} from "./types.js";
