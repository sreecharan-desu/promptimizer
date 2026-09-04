# SDK (`promptimizer`)

```bash
npm install promptimizer
# this monorepo: pnpm --filter promptimizer build
```

## Client

```ts
import { Promptimizer } from "promptimizer";

const { client, session } = await Promptimizer.connect({
  gatewayURL: "http://localhost:3000/api",
  mode: "byok",
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});

await client.classify({ prompt: "Prove there are infinitely many primes" });
await client.benchmark();
```

## Offline classifier

```ts
import { classifyText } from "promptimizer";

classifyText("Design a rate limiter for 1 million QPS");
```

The heuristic is intentionally boring and inspectable. It is not a hidden model. Hard / high-risk prompts recommend `frontier`.

## OpenAI drop-in

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: session.session_id,
  baseURL: "http://localhost:3000/api/v1",
});
```
