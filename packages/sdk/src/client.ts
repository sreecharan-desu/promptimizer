import type {
  ChatCompletion,
  ChatCompletionRequest,
  ConnectOptions,
  PromptimizerOptions,
  SavingsSummary,
  Session,
} from "./types";

export class PromptimizerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "PromptimizerError";
  }
}

export const DEFAULT_GATEWAY = (
  process.env.PROMPTIMIZER_URL || "https://hackathon-omega-liart.vercel.app/api"
).replace(/\/$/, "");

export class Promptimizer {
  readonly gatewayURL: string;
  sessionId?: string;
  apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: PromptimizerOptions = {}) {
    this.gatewayURL = (options.gatewayURL ?? options.baseURL ?? DEFAULT_GATEWAY).replace(/\/$/, "");
    this.sessionId = options.sessionId;
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? fetch;
  }

  static async connect(options: ConnectOptions & { gatewayURL?: string }): Promise<{
    client: Promptimizer;
    session: Session;
  }> {
    const client = new Promptimizer({
      gatewayURL: options.gatewayURL,
      apiKey: options.accountKey,
    });
    const session = await client.connect(options);
    return { client, session };
  }

  async connect(options: ConnectOptions): Promise<Session> {
    const session = await this.request<Session>("/v1/providers/connect", {
      method: "POST",
      body: JSON.stringify({
        mode: options.mode ?? "byok",
        label: options.label,
        provider: options.provider,
        base_url: options.baseURL,
        api_key: options.apiKey,
      }),
    });
    this.sessionId = session.session_id;
    return session;
  }

  async providers() {
    return this.request<{ object: string; data: Array<{ id: string; label: string; base_url: string; env: string }> }>(
      "/v1/providers",
    );
  }

  async savings(): Promise<SavingsSummary> {
    return this.request("/v1/savings");
  }

  async session(): Promise<Session> {
    return this.request("/v1/session");
  }

  async models() {
    return this.request<{ object: string; data: Session["models"]; baseline_model: string | null }>(
      "/v1/models",
    );
  }

  async updateFleet(body: {
    overrides?: Record<string, string>;
    selected?: Record<string, boolean>;
    baseline_model?: string;
  }): Promise<Session> {
    return this.request("/v1/models", { method: "PATCH", body: JSON.stringify(body) });
  }

  async classify(input: { messages?: ChatCompletionRequest["messages"]; prompt?: string }) {
    return this.request("/v1/classify", { method: "POST", body: JSON.stringify(input) });
  }

  async benchmark(compareAlwaysFrontier = true) {
    return this.request("/v1/benchmark/run", {
      method: "POST",
      body: JSON.stringify({ compare_always_frontier: compareAlwaysFrontier }),
    });
  }

  readonly chat = {
    completions: {
      create: (request: ChatCompletionRequest) => this.createChatCompletion(request),
    },
  };

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletion> {
    return this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    } else if (this.sessionId) {
      headers.set("X-Promptimizer-Session", this.sessionId);
      headers.set("Authorization", `Bearer ${this.sessionId}`);
    }
    const response = await this.fetcher(`${this.gatewayURL}${path}`, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        typeof data === "object" && data && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : response.statusText;
      throw new PromptimizerError(detail, response.status, data);
    }
    return data as T;
  }
}
