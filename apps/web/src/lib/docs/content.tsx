import Link from "next/link";
import {
  Accordion,
  Callout,
  Card,
  Cards,
  Endpoint,
  H2,
  P,
  Param,
  Pre,
  Step,
  Steps,
  Table,
} from "@/components/docs/primitives";
import type { ReactNode } from "react";

export type DocBody = {
  title: string;
  description: string;
  headings: { id: string; title: string }[];
  content: ReactNode;
};

export const DOC_CONTENT: Record<string, DocBody> = {
  "/docs": {
    title: "Introduction",
    description: "BYOK router for OpenAI-compatible APIs.",
    headings: [
      { id: "what-you-get", title: "What you get" },
      { id: "quality", title: "Quality is measured" },
      { id: "stack", title: "How it ships" },
    ],
    content: (
      <>
        <P>
          Promptimizer is middleware, not a new model vendor. You bring an OpenAI-compatible key. We classify each
          request, route it to the cheapest adequate tier, cache repeated system and context prefixes, and measure
          cost saved versus always-frontier — with a quality score, so silent degradation is visible.
        </P>
        <Callout kind="note">
          Open the <Link href="/console">console</Link>, connect an OpenAI-compatible key, and start routing.
        </Callout>
        <Cards>
          <Card title="Quickstart" href="/docs/quickstart">
            Create an account, mint an API key, and route your first prompt.
          </Card>
          <Card title="SDK" href="/docs/sdk">
            npm i promptimizer — drop-in chat completions plus an offline classifier.
          </Card>
          <Card title="API" href="/docs/api">
            OpenAI-compatible /v1 endpoints, auth, and error map.
          </Card>
          <Card title="Quality gate" href="/docs/guides/quality">
            Hard questions escalate. A cheap-only router fails the benchmark on purpose.
          </Card>
        </Cards>
        <H2 id="what-you-get">What you get</H2>
        <Table
          headers={["Piece", "Job"]}
          rows={[
            ["Classifier", "Complexity L1–L5, category, quality risk"],
            ["Router", "Cheapest selected model in the adequate tier. Step up, never down"],
            ["Prompt cache", "SHA-256 of system + long context. Repeat prefixes bill at 50% input"],
            ["Quality guard", "Thin or refusing answers on hard tasks retry one tier higher"],
            ["Benchmark", "Fixed 15-task gold set. Cost and quality vs always-frontier"],
          ]}
        />
        <H2 id="quality">Quality is measured</H2>
        <P>
          Each request has a quality gate. The benchmark reports routed quality, frontier quality, and the delta so
          cheap answers that fail are visible.
        </P>
        <H2 id="stack">How it ships</H2>
        <P>
          Create an account, store a provider, mint a <span className="font-mono text-primary">pmz_live_</span> key.
          The TypeScript SDK and any OpenAI-compatible client talk to /api/v1. FastAPI is the self-hosted gateway.
        </P>
      </>
    ),
  },
  "/docs/quickstart": {
    title: "Quickstart",
    description: "Account, API key, first routed prompt.",
    headings: [
      { id: "account", title: "Create an account" },
      { id: "key", title: "Mint an API key" },
      { id: "route", title: "Route a prompt" },
      { id: "byok", title: "Add your provider" },
    ],
    content: (
      <>
        <H2 id="account">1. Create an account</H2>
        <P>
          Open <Link href="/signup">/signup</Link> and confirm the email we send. Then open the{" "}
          <Link href="/console">console</Link> and connect an OpenAI-compatible provider key.
        </P>
        <H2 id="key">2. Mint an API key</H2>
        <P>
          <Link href="/account">/account</Link> creates a <span className="font-mono text-primary">pmz_live_</span> key.
          Copy it once.
        </P>
        <H2 id="route">3. Route a prompt</H2>
          <Pre label="bash">{`curl -s https://hackathon-omega-liart.vercel.app/api/v1/chat/completions \\\n  -H "Authorization: Bearer $PROMPTIMIZER_API_KEY" \\\n  -H 'content-type: application/json' \\\n  -d '{"messages":[{"role":"user","content":"What is the capital of France?"}]}'`}</Pre>
        <P>You should see an economy-tier model when the ask is easy, and saved_pct versus frontier.</P>
        <H2 id="byok">4. Add your provider</H2>
        <P>
          In the console or CLI, pick a known provider — Baseten, Groq, OpenAI — and paste the key. We already have
          the base URL. Custom is the only chip that asks for one. That fleet is stored on your account.
        </P>
      </>
    ),
  },
  "/docs/concepts": {
    title: "Concepts",
    description: "Sessions, fleets, tiers, and the always-frontier baseline.",
    headings: [
      { id: "session", title: "Session" },
      { id: "fleet", title: "Fleet" },
      { id: "tiers", title: "Tiers" },
      { id: "baseline", title: "Baseline" },
      { id: "risk", title: "Quality risk" },
    ],
    content: (
      <>
        <H2 id="session">Session</H2>
        <P>
          A connection to one or more OpenAI-compatible hosts (BYOK). The raw vendor key never lands in
          localStorage. Pass your <span className="font-mono text-primary">pmz_live_</span> key as Authorization:
          Bearer, or a short-lived session id as X-Promptimizer-Session.
        </P>
        <H2 id="fleet">Fleet</H2>
        <Table
          headers={["Field", "Meaning"]}
          rows={[
            ["id", "Provider model id"],
            ["tier", "economy, standard, or frontier"],
            ["input_per_1m / output_per_1m", "USD, when known"],
            ["source", "catalog, heuristic, price, or user"],
            ["selected", "Eligible for routing"],
          ]}
        />
        <H2 id="tiers">Tiers</H2>
        <Accordion title="Economy">Mini, nano, haiku, 8B, instant. L1–L2 factual and short transforms.</Accordion>
        <Accordion title="Standard">Flash, sonnet, 70B. L3 code, analysis, medium reasoning.</Accordion>
        <Accordion title="Frontier">
          GPT-4 class, opus, o-series. L4–L5, plus high quality risk (system design, legal/medical, proofs).
        </Accordion>
        <H2 id="baseline">Baseline</H2>
        <P>
          baseline_model is the expensive comparison. Saved cost uses the same token counts on both models. We do not
          invent a cheaper token count.
        </P>
        <H2 id="risk">Quality risk</H2>
        <P>
          Independent of complexity. system_design, safety_sensitive, code_debug, and reasoning are high risk and
          cannot route to economy even if the prompt is short.
        </P>
      </>
    ),
  },
  "/docs/guides/classification": {
    title: "Classification",
    description: "A transparent heuristic. Not a hidden model.",
    headings: [
      { id: "output", title: "Output" },
      { id: "probability", title: "P(quality | small)" },
      { id: "signals", title: "Signals" },
      { id: "offline", title: "Offline" },
    ],
    content: (
      <>
        <P>Every request is classified before it is routed. The same rules live in Python and in the TypeScript SDK.</P>
        <H2 id="output">Output</H2>
        <Pre label="json">{`{\n  "p_small_quality": 0.43,\n  "recommended_tier": "frontier",\n  "complexity": 5,\n  "category": "system_design"\n}`}</Pre>
        <H2 id="probability">P(quality | small)</H2>
        <P>
          The classifier does not answer easy/hard. It estimates the chance an economy or standard model will clear
          the quality bar. ≥ 0.90 routes economy, ≥ 0.72 standard, below that frontier. Complexity and category are
          features that move the probability — not the routing rule.
        </P>
        <H2 id="signals">Signals</H2>
        <P>
          Length, code fences, language keywords, math, design language, proofs, races, safety terms, and constraint
          words. Categories include factual_recall, math, code_generation, code_debug, system_design, reasoning,
          analysis, and safety_sensitive.
        </P>
        <H2 id="offline">Offline</H2>
        <Pre label="ts">{`import { classifyText } from "promptimizer";\nclassifyText("Design a rate limiter for 1 million QPS");`}</Pre>
        <Callout kind="warning">
          This is a heuristic. It will mis-tag some prompts. The quality guard can still escalate after the first
          answer.
        </Callout>
      </>
    ),
  },
  "/docs/guides/routing": {
    title: "Routing",
    description: "Cheapest adequate model. Step up, never down.",
    headings: [
      { id: "algorithm", title: "Algorithm" },
      { id: "hint", title: "Model hint" },
      { id: "meta", title: "Metadata" },
    ],
    content: (
      <>
        <H2 id="algorithm">Algorithm</H2>
        <Steps>
          <Step n="01" title="Prefix cache">
            Hash system + long context. Hits bill those tokens at 50% input.
          </Step>
          <Step n="02" title="P(quality | small)">
            If the cheap model is likely to pass, pick the cheapest selected model in that tier. Never step down.
          </Step>
          <Step n="03" title="Complete">
            Call the connected provider with that model id.
          </Step>
          <Step n="04" title="Guard">
            If the answer looks degraded, retry one tier higher and mark escalated.
          </Step>
          <Step n="05" title="Price">
            Split savings: routing (cheaper model) plus cache (repeat prefixes).
          </Step>
        </Steps>
        <H2 id="hint">Model hint</H2>
        <P>model: auto uses the classifier. Any other fleet id is an explicit pin — used for the frontier half of the benchmark.</P>
        <H2 id="meta">Metadata</H2>
        <Pre label="json">{`{\n  "p_small_quality": 0.96,\n  "tier": "economy",\n  "escalated": false,\n  "quality_gate": "pass"\n}`}</Pre>
      </>
    ),
  },
  "/docs/guides/caching": {
    title: "Prompt cache",
    description: "Pay full price the first time you send a system block. Half after that.",
    headings: [
      { id: "hash", title: "What is hashed" },
      { id: "exact", title: "Exact cache" },
      { id: "backends", title: "Backends" },
    ],
    content: (
      <>
        <P>Provider prompt caching discounts repeated prefixes. Promptimizer models that on every session.</P>
        <H2 id="hash">What is hashed</H2>
        <P>Every system message, plus the first 800 characters of a long user context. SHA-256 of the canonical JSON. Repeats set prefix_cache_hit and bill those tokens at 50% input.</P>
        <H2 id="exact">Exact cache</H2>
        <P>The full messages + model tuple is stored. An identical retry returns the stored completion.</P>
        <H2 id="backends">Backends</H2>
        <Table
          headers={["Environment", "Backend"]}
          rows={[
            ["Next.js / Vercel", "In-memory Map per instance"],
            ["FastAPI local", "In-memory"],
            ["Docker Compose", "Redis, CACHE_TTL_SECONDS"],
          ]}
        />
        <Callout kind="note">Serverless memory does not survive cold starts. Use Redis when you want hits across instances.</Callout>
      </>
    ),
  },
  "/docs/guides/quality": {
    title: "Quality gate",
    description: "Savings that come from worse hard answers are a product failure.",
    headings: [
      { id: "checks", title: "Two checks" },
      { id: "degraded", title: "What degraded means" },
      { id: "fail", title: "How to fail on purpose" },
    ],
    content: (
      <>
        <P>Savings without a quality score are marketing. Promptimizer measures both.</P>
        <H2 id="checks">Two checks</H2>
        <P>
          Online: after a cheap completion, empty, too-thin L4+, or refusal answers escalate. Benchmark: each of the
          15 gold tasks is scored with required-concept coverage + structure, routed and frontier.
        </P>
        <H2 id="degraded">What degraded means</H2>
        <P>Missing required concepts, a thin outline on system design, or an explicit small-model refusal. Short L1 factual answers are allowed.</P>
        <H2 id="fail">How to fail on purpose</H2>
        <P>Route everything to nano. saved_pct looks heroic. avg_quality_routed collapses on the five hard rows.</P>
        <Callout kind="tip">QUALITY_ESCALATE_THRESHOLD defaults to 0.62.</Callout>
      </>
    ),
  },
  "/docs/guides/byok": {
    title: "Bring your own key",
    description: "Any OpenAI-compatible /v1. We fetch models and route against your prices.",
    headings: [
      { id: "presets", title: "Presets" },
      { id: "store", title: "What we store" },
      { id: "tier", title: "Auto-tiering" },
    ],
    content: (
      <>
        <P>Promptimizer does not sell tokens. You already have a provider.</P>
        <H2 id="presets">Presets</H2>
        <P>
          Known hosts include OpenAI, Groq, Baseten, OpenRouter, Together, Fireworks, DeepSeek, Mistral, Cerebras, xAI,
          Google, Perplexity, NVIDIA NIM, SambaNova, Hyperbolic, Moonshot, and Ollama. We fill the base URL. Custom is
          the only case that asks for one. The endpoint must speak GET /models and POST /chat/completions.
        </P>
        <Pre label="ts">{`await Promptimizer.connect({\n  gatewayURL: process.env.PROMPTIMIZER_URL,\n  provider: "baseten",\n  apiKey: process.env.BASETEN_API_KEY,\n});`}</Pre>
        <H2 id="store">What we store</H2>
        <Callout kind="warning">
          Keys never go in git, logs, or localStorage. FastAPI encrypts them with SESSION_SECRET and expires the session.
        </Callout>
        <H2 id="tier">Auto-tiering</H2>
        <P>Known catalog, then name heuristics, then price blend. Override any row in the console or PATCH /v1/models. Embeddings, whisper, TTS, and image models are dropped.</P>
      </>
    ),
  },
  "/docs/guides/benchmark": {
    title: "Benchmark",
    description: "Four policies. Same gold set. Cost and quality on the same rows.",
    headings: [
      { id: "mix", title: "Mix" },
      { id: "policies", title: "Policies" },
      { id: "summary", title: "What to read" },
    ],
    content: (
      <>
        <P>The task file is versioned at apps/api/app/data/benchmark.json.</P>
        <H2 id="mix">Mix</H2>
        <Table
          headers={["Band", "Count", "Examples"]}
          rows={[
            ["Easy L1–L2", "5", "France, HTTP, 17×24, REST"],
            ["Medium L3", "5", "Merge lists, TCP vs UDP, coin flips"],
            ["Hard L4–L5", "5", "1M QPS limiter, Euclid, Go race, peeked A/B"],
          ]}
        />
        <H2 id="policies">Policies</H2>
        <Table
          headers={["Policy", "What it is"]}
          rows={[
            ["always_frontier", "Baseline. Every row on the expensive model"],
            ["difficulty", "Naive: complexity < 3 cheap, else expensive. No escalation"],
            ["quality", "P(quality|small) plus the guard"],
            ["quality_cache", "The product: quality-aware plus prefix cache"],
          ]}
        />
        <H2 id="summary">What to read</H2>
        <Table
          headers={["Field", "Good look"]}
          rows={[
            ["saved_pct", "High because easy work left economy"],
            ["avg_quality / worst_quality", "Close to frontier, worst case does not collapse"],
            ["quality_delta", "Near 0"],
            ["routing_saved vs cache_saved", "Two independent mechanisms"],
            ["escalation_rate", "Some hard rows recovered after a cheap miss"],
          ]}
        />
        <Callout kind="tip">
          Run it from the <Link href="/console">console Benchmark tab</Link>.
        </Callout>
      </>
    ),
  },
  "/docs/sdk": {
    title: "SDK",
    description: "TypeScript client for the hosted API.",
    headings: [{ id: "install", title: "Install" }],
    content: (
      <>
        <H2 id="install">Install</H2>
        <Pre label="bash">npm install promptimizer</Pre>
        <Pre label="ts">{`import { Promptimizer } from "promptimizer";\n\nconst client = new Promptimizer({\n  apiKey: process.env.PROMPTIMIZER_API_KEY,\n});\n\nconst res = await client.chat.completions.create({\n  messages: [{ role: "user", content: "What is 17 * 24?" }],\n});`}</Pre>
        <Cards>
          <Card title="Client" href="/docs/sdk/client">
            Methods mapped to /v1 endpoints.
          </Card>
          <Card title="Classifier" href="/docs/sdk/classifier">
            Offline classification, no network.
          </Card>
          <Card title="OpenAI drop-in" href="/docs/sdk/openai">
            Point the official OpenAI SDK at /api/v1.
          </Card>
        </Cards>
      </>
    ),
  },
  "/docs/sdk/client": {
    title: "Client",
    description: "Promptimizer.connect, then chat.completions.create.",
    headings: [{ id: "methods", title: "Methods" }],
    content: (
      <>
        <Pre label="ts">{`import { Promptimizer } from "promptimizer";\n\nconst client = new Promptimizer({\n  gatewayURL: process.env.PROMPTIMIZER_URL,\n  apiKey: process.env.PROMPTIMIZER_API_KEY,\n});\n\nconst res = await client.chat.completions.create({\n  messages: [{ role: "user", content: "What is 17 * 24?" }],\n});`}</Pre>
        <H2 id="methods">Methods</H2>
        <Table
          headers={["Method", "Maps to"]}
          rows={[
            ["connect", "POST /v1/providers/connect"],
            ["providers", "GET /v1/providers"],
            ["savings", "GET /v1/savings"],
            ["chat.completions.create", "POST /v1/chat/completions"],
            ["classify", "POST /v1/classify"],
            ["benchmark", "POST /v1/benchmark/run"],
            ["updateFleet", "PATCH /v1/models"],
          ]}
        />
      </>
    ),
  },
  "/docs/sdk/classifier": {
    title: "Offline classifier",
    description: "Same rules as the gateway. No API key.",
    headings: [],
    content: (
      <>
        <Pre label="ts">{`import { classifyText } from "promptimizer";\n\nclassifyText("What is the capital of France?");\n// recommended_tier: "economy"`}</Pre>
        <P>Use it in an agent loop to log difficulty before you pay for a completion, or to pre-label a dataset.</P>
      </>
    ),
  },
  "/docs/sdk/openai": {
    title: "OpenAI drop-in",
    description: "Keep the official client. Change baseURL.",
    headings: [],
    content: (
      <>
        <Pre label="ts">{`import OpenAI from "openai";\n\nconst openai = new OpenAI({\n  apiKey: process.env.PROMPTIMIZER_API_KEY,\n  baseURL: "https://hackathon-omega-liart.vercel.app/api/v1",\n});\n\nawait openai.chat.completions.create({\n  model: "auto",\n  messages: [{ role: "user", content: "Explain REST in two sentences." }],\n});`}</Pre>
        <P>Works with LangChain, the Vercel AI SDK, and any agent that already speaks OpenAI chat completions. Streaming is not enabled yet.</P>
      </>
    ),
  },
  "/docs/console": {
    title: "Console",
    description: "Connect, inspect the fleet, route a prompt, run the benchmark.",
    headings: [],
    content: (
      <>
        <Steps>
          <Step n="01" title="Connect">
            Simulator, or a provider chip + key. Base URL only for Custom.
          </Step>
          <Step n="02" title="Fleet">
            Every chat model with a tier dropdown. Set the baseline.
          </Step>
          <Step n="03" title="Playground">
            One prompt. The side rail shows model, tier, cache, quality, saved %.
          </Step>
          <Step n="04" title="Benchmark">
            The 15-row table. Gold savings, near-zero quality delta.
          </Step>
        </Steps>
        <Callout kind="note">
          Sign in first. Connected providers are stored on the account.
        </Callout>
      </>
    ),
  },
  "/docs/cli": {
    title: "CLI",
    description: "Install, flags, and common commands.",
    headings: [
      { id: "install", title: "Install" },
      { id: "help", title: "Help" },
      { id: "commands", title: "Commands" },
    ],
    content: (
      <>
        <H2 id="install">Install</H2>
        <Pre label="bash">{`npm install -g promptimizer-cli\n# or\nnpx promptimizer-cli`}</Pre>
        <H2 id="help">Help</H2>
        <Pre label="bash">{`promptimizer --help\npromptimizer login --help\npromptimizer connect --help`}</Pre>
        <H2 id="commands">Commands</H2>
        <Pre label="bash">{`promptimizer login --key pmz_live_…\npromptimizer connect baseten --key $BASETEN_API_KEY\npromptimizer chat "What is 17 * 24?"\npromptimizer models\npromptimizer savings`}</Pre>
        <P>
          Known providers do not take --base-url. Custom does. Vendor keys may also come from the matching env var
          (BASETEN_API_KEY, GROQ_API_KEY, …). Override the gateway with --url or PROMPTIMIZER_URL.
        </P>
      </>
    ),
  },
  "/docs/portal": {
    title: "Savings portal",
    description: "Account-level spend versus always-frontier.",
    headings: [],
    content: (
      <>
        <P>
          <Link href="/portal">/portal</Link> sums every completion on the account: estimated API spend, frontier
          baseline, savings from cheaper models, and cache discounts. There is no routing fee — Promptimizer only
          estimates provider cost. The console playground and the CLI both write receipts.
        </P>
        <P>GET /v1/savings with a pmz_live_ key returns the same totals.</P>
      </>
    ),
  },
  "/docs/api": {
    title: "API overview",
    description: "OpenAI-compatible chat completions, plus receipts.",
    headings: [
      { id: "hosts", title: "Hosts" },
      { id: "flow", title: "Typical flow" },
    ],
    content: (
      <>
        <H2 id="hosts">Hosts</H2>
        <Table
          headers={["Host", "Base"]}
          rows={[
            ["Hosted", "https://hackathon-omega-liart.vercel.app/api"],
            ["Local Next.js", "http://localhost:3000/api"],
            ["FastAPI", "http://localhost:8000"],
          ]}
        />
        <P>POST /v1/chat/completions accepts the usual OpenAI body. model defaults to auto. Extra response fields: usage.cost and promptimizer. Streaming is not enabled.</P>
        <H2 id="flow">Typical flow</H2>
        <Steps>
          <Step n="01" title="Account">
            Create an account and mint a pmz_live_ key
          </Step>
          <Step n="02" title="Provider">
            Connect an OpenAI-compatible BYOK host in the console
          </Step>
          <Step n="03" title="Route">
            POST /v1/chat/completions with Authorization: Bearer pmz_live_…
          </Step>
          <Step n="04" title="Measure">
            POST /v1/benchmark/run
          </Step>
        </Steps>
      </>
    ),
  },
  "/docs/api/authentication": {
    title: "Authentication",
    description: "A Promptimizer API key. Your provider key never comes back.",
    headings: [],
    content: (
      <>
        <Pre>{`Authorization: Bearer pmz_live_...`}</Pre>
        <P>Create keys in the account page after you sign up. The raw key is shown once.</P>
        <Callout kind="warning">401 — missing or revoked key. Signed-in console requests use the account cookie instead.</Callout>
      </>
    ),
  },
  "/docs/api/errors": {
    title: "Errors",
    description: "OpenAI-shaped enough. FastAPI uses detail.",
    headings: [],
    content: (
      <>
        <Pre label="json">{`{ "detail": "Provider rejected the key: ..." }`}</Pre>
        <Table
          headers={["Status", "When"]}
          rows={[
            ["400", "Bad body, no models, streaming requested"],
            ["401", "Missing or expired session"],
            ["4xx/5xx", "Passed through from the BYOK provider"],
          ]}
        />
      </>
    ),
  },
  "/docs/api/providers": {
    title: "Provider catalog",
    description: "Known OpenAI-compatible base URLs.",
    headings: [],
    content: (
      <>
        <Endpoint method="GET" path="/v1/providers" />
        <P>Public. Each row is id, label, base_url, and the env var we read for a key. Unknown hosts still work if you pass base_url on connect.</P>
      </>
    ),
  },
  "/docs/api/connect": {
    title: "Connect a provider",
    description: "Connect a BYOK host and receive a tiered fleet.",
    headings: [],
    content: (
      <>
        <Endpoint method="POST" path="/v1/providers/connect" />
        <Param name="mode" type="string" required>
          byok (required).
        </Param>
        <Param name="provider" type="string">
          Known id such as baseten or groq. Fills base_url.
        </Param>
        <Param name="label" type="string">
          Human name. Defaults to the provider label.
        </Param>
        <Param name="base_url" type="string">
          Only required for an unknown provider.
        </Param>
        <Param name="api_key" type="string">
          Required for byok. Sent only to the provider.
        </Param>
        <Pre label="bash">{`curl -s http://localhost:3000/api/v1/providers/connect \\\n  -H 'content-type: application/json' \\\n  -d '{"mode":"byok","provider":"baseten","api_key":"$BASETEN_API_KEY"}'`}</Pre>
      </>
    ),
  },
  "/docs/api/session": {
    title: "Session",
    description: "Public session plus cumulative savings. Never the raw key.",
    headings: [],
    content: (
      <>
        <Endpoint method="GET" path="/v1/session" />
        <P>DELETE /v1/session drops it. stats includes requests, actual_usd, baseline_usd, saved_usd, cache_hits, escalations, quality_fails.</P>
      </>
    ),
  },
  "/docs/api/models": {
    title: "Models",
    description: "OpenAI-shaped list with tier, price, and selection.",
    headings: [{ id: "patch", title: "Patch" }],
    content: (
      <>
        <Endpoint method="GET" path="/v1/models" />
        <H2 id="patch">Patch</H2>
        <Endpoint method="PATCH" path="/v1/models" />
        <Param name="overrides" type="object">
          Model id → economy | standard | frontier.
        </Param>
        <Param name="selected" type="object">
          Model id → boolean.
        </Param>
        <Param name="baseline_model" type="string">
          Always-expensive comparison model.
        </Param>
      </>
    ),
  },
  "/docs/api/classify": {
    title: "Classify",
    description: "Difficulty without spending a completion.",
    headings: [],
    content: (
      <>
        <Endpoint method="POST" path="/v1/classify" />
        <Param name="prompt" type="string">
          Raw text. Use this or messages.
        </Param>
        <Param name="messages" type="array">
          OpenAI chat messages.
        </Param>
        <P>Does not require a session. Safe to call from CI.</P>
      </>
    ),
  },
  "/docs/api/chat": {
    title: "Chat completions",
    description: "The drop-in. Routes, caches, maybe escalates.",
    headings: [{ id: "extra", title: "Extra response" }],
    content: (
      <>
        <Endpoint method="POST" path="/v1/chat/completions" />
        <Param name="messages" type="array" required>
          OpenAI messages.
        </Param>
        <Param name="model" type="string">
          auto (default) or a fleet id.
        </Param>
        <Param name="level_override" type="integer">
          Force complexity 1–5.
        </Param>
        <Param name="stream" type="boolean">
          Must be false.
        </Param>
        <H2 id="extra">Extra response</H2>
        <P>usage.cost holds actual, baseline, saved, cache discount. promptimizer holds classification, tier, cache flags, escalated, quality_gate.</P>
      </>
    ),
  },
  "/docs/api/benchmark": {
    title: "Benchmark",
    description: "The fixed task set, and a scored run.",
    headings: [],
    content: (
      <>
        <Endpoint method="GET" path="/v1/benchmark" />
        <P>Name, version, gold tasks. No session required.</P>
        <Endpoint method="POST" path="/v1/benchmark/run" />
        <Param name="compare_always_frontier" type="boolean">
          Default true. Also scores the baseline model on every row.
        </Param>
      </>
    ),
  },
  "/docs/api/analytics": {
    title: "Analytics",
    description: "Session totals and cache hit rate.",
    headings: [],
    content: (
      <>
        <Endpoint method="GET" path="/v1/analytics" />
        <P>Requires a session. Returns the public session, saved_pct, and cache stats when FastAPI is the gateway.</P>
      </>
    ),
  },
  "/docs/api/savings": {
    title: "Savings",
    description: "Account totals versus always-frontier.",
    headings: [],
    content: (
      <>
        <Endpoint method="GET" path="/v1/savings" />
        <P>Requires a pmz_live_ key or a signed-in session. Same numbers as /portal.</P>
      </>
    ),
  },
};
