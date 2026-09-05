# promptimizer

OpenAI-compatible TypeScript SDK for [Promptimizer](https://www.promptimizer.site). Route each request to the cheapest adequate model, cache repeated prefixes, and keep a quality gate so savings do not silently degrade hard answers.

```bash
npm install promptimizer
```

## Account + BYOK

Create a `pmz_live_` key at `/account`, connect a provider in the console or CLI, then:

```ts
import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});

const completion = await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});

console.log(completion.choices[0].message.content);
console.log(completion.promptimizer);
console.log(completion.usage.cost);
```

The default gateway is the hosted app. Override with `gatewayURL` or `PROMPTIMIZER_URL`.

Connect a provider from code if it is not already saved on the account:

```ts
await client.connect({
  provider: "baseten",
  apiKey: process.env.BASETEN_API_KEY,
});
```

## Drop-in with the official OpenAI SDK

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.PROMPTIMIZER_API_KEY,
  baseURL: "https://www.promptimizer.site/api/v1",
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
