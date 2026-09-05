"use client";

const PROVIDER_ICONS: Record<string, string> = {
  openai: "openai",
  groq: "groq",
  baseten: "baseten",
  openrouter: "openrouter",
  together: "together",
  fireworks: "fireworks",
  deepseek: "deepseek",
  mistral: "mistral",
  cerebras: "cerebras",
  xai: "xai",
  google: "google",
  perplexity: "perplexity",
  nvidia: "nvidia",
  sambanova: "sambanova",
  hyperbolic: "hyperbolic",
  moonshot: "moonshot",
  ollama: "ollama",
};

const LABEL_TO_ICON: Record<string, string> = {
  openai: "openai",
  groq: "groq",
  baseten: "baseten",
  openrouter: "openrouter",
  together: "together",
  fireworks: "fireworks",
  deepseek: "deepseek",
  mistral: "mistral",
  cerebras: "cerebras",
  xai: "xai",
  "x.ai": "xai",
  google: "google",
  gemini: "gemini",
  perplexity: "perplexity",
  nvidia: "nvidia",
  "nvidia nim": "nvidia",
  sambanova: "sambanova",
  hyperbolic: "hyperbolic",
  moonshot: "moonshot",
  ollama: "ollama",
  anthropic: "anthropic",
  claude: "claude",
  meta: "meta",
  qwen: "qwen",
  zhipu: "zhipu",
  glm: "zhipu",
};

/** Map host id / label / connection id → brand asset slug. */
export function resolveProviderIconSlug(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw || raw === "custom") return null;
  if (PROVIDER_ICONS[raw]) return PROVIDER_ICONS[raw];
  if (LABEL_TO_ICON[raw]) return LABEL_TO_ICON[raw];
  // connection ids sometimes look like "baseten" or hostnames
  for (const [key, slug] of Object.entries(PROVIDER_ICONS)) {
    if (raw === key || raw.includes(key)) return slug;
  }
  for (const [key, slug] of Object.entries(LABEL_TO_ICON)) {
    if (raw.includes(key)) return slug;
  }
  return null;
}

/** Infer model-family brand from a model id like `deepseek-ai/DeepSeek-V4-Flash`. */
export function resolveModelIconSlug(modelId?: string | null): string | null {
  if (!modelId) return null;
  const id = modelId.toLowerCase();
  if (id.includes("claude") || id.includes("anthropic")) return "anthropic";
  if (id.includes("gpt") || id.includes("o1") || id.includes("o3") || id.includes("o4") || id.includes("openai")) return "openai";
  if (id.includes("gemini") || id.includes("gemma")) return "gemini";
  if (id.includes("deepseek")) return "deepseek";
  if (id.includes("mistral") || id.includes("mixtral") || id.includes("codestral")) return "mistral";
  if (id.includes("llama") || id.includes("meta-llama") || id.includes("llama3")) return "meta";
  if (id.includes("qwen")) return "qwen";
  if (id.includes("glm") || id.includes("chatglm") || id.includes("zai-org") || id.includes("zhipu")) return "zhipu";
  if (id.includes("kimi") || id.includes("moonshot")) return "moonshot";
  if (id.includes("grok") || id.includes("xai")) return "xai";
  if (id.includes("nvidia") || id.includes("nemotron")) return "nvidia";
  if (id.includes("perplexity") || id.includes("sonar")) return "perplexity";
  if (id.includes("command") || id.includes("cohere")) return null;
  // org prefix before /
  const org = id.split("/")[0];
  return resolveProviderIconSlug(org);
}

function Monogram({ label, className }: { label: string; className?: string }) {
  const letter = (label.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-[4px] bg-primary/10 font-medium text-primary ${className ?? "size-4 text-[10px]"}`}
    >
      {letter}
    </span>
  );
}

type IconProps = {
  /** Provider id, label, or connection id */
  provider?: string | null;
  /** Model id for family icon */
  model?: string | null;
  className?: string;
  /** Invert for use on dark (active) chips */
  invert?: boolean;
  title?: string;
};

export function BrandIcon({ provider, model, className, invert, title }: IconProps) {
  const slug =
    (provider ? resolveProviderIconSlug(provider) : null) ??
    (model ? resolveModelIconSlug(model) : null);
  const sizeClass = className ?? "size-4";
  if (!slug) {
    return <Monogram label={provider || model || "?"} className={sizeClass} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/${slug}.svg`}
      alt=""
      title={title}
      aria-hidden
      className={`shrink-0 object-contain ${sizeClass} ${invert ? "brightness-0 invert" : ""}`}
      loading="lazy"
      decoding="async"
    />
  );
}

export function ProviderIcon({
  id,
  className,
  invert,
}: {
  id: string;
  className?: string;
  invert?: boolean;
}) {
  return <BrandIcon provider={id} className={className} invert={invert} title={id} />;
}

export function ModelIcon({
  modelId,
  providerId,
  className,
  invert,
}: {
  modelId: string;
  providerId?: string | null;
  className?: string;
  invert?: boolean;
}) {
  // Prefer model-family mark; fall back to host brand.
  const family = resolveModelIconSlug(modelId);
  if (family) return <BrandIcon model={modelId} className={className} invert={invert} title={modelId} />;
  return <BrandIcon provider={providerId} className={className} invert={invert} title={modelId} />;
}
