import type { Metadata } from "next";
import { CodePanel } from "@/components/code-panel";

export const metadata: Metadata = { title: "SDK" };

export default function SdkDocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="text-xs font-medium tracking-wide text-accent">SDK</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">
        npm i promptimizer
      </h1>
      <p className="mt-6 text-lg text-secondary">
        TypeScript client for the gateway, plus an offline classifier you can run in any Node or edge process.
      </p>
      <div className="mt-10">
        <CodePanel />
      </div>
      <h2 className="mt-16 font-display text-3xl tracking-tight text-primary">Drop-in OpenAI client</h2>
      <p className="mt-4 leading-relaxed text-secondary">
        After you connect, the session id is a bearer token. Point the official OpenAI SDK at the Promptimizer
        base URL and keep calling <span className="font-mono text-sm text-primary">chat.completions.create</span>.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-xl bg-codeblock p-4 font-mono text-[13px] text-primary/80">
        {`import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.PROMPTIMIZER_SESSION_ID,
  baseURL: "https://your-app.vercel.app/api/v1",
});`}
      </pre>
    </article>
  );
}
