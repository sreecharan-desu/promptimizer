export type ProviderPreset = {
  id: string;
  label: string;
  baseURL: string;
  env: string;
  hint: string;
};

export const PROVIDERS: ProviderPreset[] = [
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", env: "OPENAI_API_KEY", hint: "sk-..." },
  { id: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1", env: "GROQ_API_KEY", hint: "gsk_..." },
  { id: "baseten", label: "Baseten", baseURL: "https://inference.baseten.co/v1", env: "BASETEN_API_KEY", hint: "baseten key" },
  { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", env: "OPENROUTER_API_KEY", hint: "sk-or-..." },
  { id: "together", label: "Together", baseURL: "https://api.together.xyz/v1", env: "TOGETHER_API_KEY", hint: "together key" },
  { id: "fireworks", label: "Fireworks", baseURL: "https://api.fireworks.ai/inference/v1", env: "FIREWORKS_API_KEY", hint: "fw_..." },
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", env: "DEEPSEEK_API_KEY", hint: "sk-..." },
  { id: "mistral", label: "Mistral", baseURL: "https://api.mistral.ai/v1", env: "MISTRAL_API_KEY", hint: "mistral key" },
  { id: "cerebras", label: "Cerebras", baseURL: "https://api.cerebras.ai/v1", env: "CEREBRAS_API_KEY", hint: "csk-..." },
  { id: "xai", label: "xAI", baseURL: "https://api.x.ai/v1", env: "XAI_API_KEY", hint: "xai-..." },
  { id: "google", label: "Google", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", env: "GOOGLE_API_KEY", hint: "AIza..." },
  { id: "perplexity", label: "Perplexity", baseURL: "https://api.perplexity.ai", env: "PERPLEXITY_API_KEY", hint: "pplx-..." },
  { id: "nvidia", label: "NVIDIA NIM", baseURL: "https://integrate.api.nvidia.com/v1", env: "NVIDIA_API_KEY", hint: "nvapi-..." },
  { id: "sambanova", label: "SambaNova", baseURL: "https://api.sambanova.ai/v1", env: "SAMBANOVA_API_KEY", hint: "samba key" },
  { id: "hyperbolic", label: "Hyperbolic", baseURL: "https://api.hyperbolic.xyz/v1", env: "HYPERBOLIC_API_KEY", hint: "hyperbolic key" },
  { id: "moonshot", label: "Moonshot", baseURL: "https://api.moonshot.ai/v1", env: "MOONSHOT_API_KEY", hint: "sk-..." },
];

export function findProvider(input: string) {
  const needle = input.trim().toLowerCase();
  return PROVIDERS.find((p) => p.id === needle || p.label.toLowerCase() === needle) ?? null;
}

export function publicCatalog() {
  return PROVIDERS.map(({ id, label, baseURL, env }) => ({
    id,
    label,
    base_url: baseURL,
    env,
  }));
}

export function resolveBaseURL(input: { provider?: string; baseURL?: string }) {
  if (input.baseURL?.trim()) return { baseURL: input.baseURL.trim().replace(/\/$/, ""), provider: findProvider(input.provider ?? "") };
  if (input.provider) {
    const provider = findProvider(input.provider);
    if (provider) return { baseURL: provider.baseURL, provider };
  }
  return { baseURL: null, provider: null };
}
