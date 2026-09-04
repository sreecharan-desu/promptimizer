# promptimizer

OpenAI-compatible TypeScript SDK for [Promptimizer](https://github.com). Route each request to the cheapest adequate model, cache repeated system/context prefixes, and keep a quality gate so you do not buy savings by silently degrading hard answers.

```bash
npm install promptimizer
```

## BYOK (Bring Your Own Key)

Any OpenAI-compatible endpoint works: OpenAI, Groq, OpenRouter, Together, Fireworks, DeepSeek, Ollama, Azure-compatible proxies.

```ts
import { Promptimizer } from "promptimizer";

const { client, session } = await Promptimizer.connect({
  gatewayURL: process.env.PROMPTIMIZER_URL, // your deployed API
  mode: "byok",
  label: "Groq",
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

console.log(session.models.map((m) => [m.id, m.tier]));

const completion = await client.chat.completions.create({
  messages: [{ role: "user", content: "What is the capital of France?" }],
});

console.log(completion.choices[0].message.content);
console.log(completion.promptimizer);
console.log(completion.usage.cost);
```

## Drop-in with the official OpenAI SDK

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.PROMPTIMIZER_SESSION_ID,
  baseURL: "https://your-promptimizer.example/v1",
});

await openai.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Explain REST in two sentences." }],
});
```

## Local classification (no network)

```ts
import { classifyText } from "promptimizer";

classifyText("Design a rate limiter for 1 million QPS");
// recommended_tier: "frontier"
```

## Simulator (no vendor key)

```ts
const { client } = await Promptimizer.connect({
  gatewayURL: "http://localhost:8000",
  mode: "mock",
});
```
