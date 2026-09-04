import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, recordUsage, saveProvider, savingsForUser, userFromApiKey } from "@/server/account";
import { authConfigured } from "@/server/db";
import { classifyText, publicCatalog, resolveBaseURL } from "promptimizer";
import {
  accountSessionId,
  createByokSession,
  createMockSession,
  getSession,
  patchFleet,
  publicSession,
  routeChat,
  runBenchmark,
  sessionForUser,
} from "@/server/engine";
import { BENCHMARK } from "@/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Benchmark runs many live completions; keep the function alive on Vercel. */
export const maxDuration = 300;

function bearer(request: NextRequest) {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-promptimizer-session") ??
    null
  );
}

async function accountFromRequest(request: NextRequest) {
  const token = bearer(request);
  if (token?.startsWith("pmz_")) return userFromApiKey(token);
  if (authConfigured()) return getCurrentUser();
  return null;
}

function connectPayload(body: {
  mode?: string;
  provider?: string;
  label?: string;
  base_url?: string;
  api_key?: string;
}) {
  if (body.mode === "mock") {
    return { mode: "mock" as const, label: body.label || "Promptimizer simulator" };
  }
  const { baseURL, provider } = resolveBaseURL({ provider: body.provider, baseURL: body.base_url });
  if (!baseURL) {
    throw Object.assign(new Error("Unknown provider. Pass base_url for a custom OpenAI-compatible /v1."), {
      status: 400,
    });
  }
  let apiKey = body.api_key?.trim() ?? "";
  if (!apiKey && provider?.id === "ollama") apiKey = "ollama";
  if (!apiKey) throw Object.assign(new Error("api_key is required."), { status: 400 });
  return {
    mode: "byok" as const,
    label: body.label || provider?.label || "BYOK",
    base_url: baseURL,
    api_key: apiKey,
  };
}

async function resolve(request: NextRequest) {
  const token = bearer(request);
  if (token?.startsWith("pmz_")) {
    const user = await userFromApiKey(token);
    if (!user) {
      return { error: NextResponse.json({ detail: "Invalid API key." }, { status: 401 }) };
    }
    return { user, session: await sessionForUser(user.id) };
  }
  if (token) {
    const session = getSession(token);
    if (session) {
      const user = authConfigured() ? await getCurrentUser() : null;
      return { user, session };
    }
  }
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) return { user, session: await sessionForUser(user.id) };
  }
  return { user: null, session: null };
}

async function handle(request: NextRequest, path: string[]) {
  const joined = path.join("/");
  const url = process.env.PROMPTIMIZER_API_URL;
  const token = bearer(request);

  if (url && !authConfigured() && !token?.startsWith("pmz_")) {
    const target = `${url.replace(/\/$/, "")}/v1/${joined}${request.nextUrl.search}`;
    const headers = new Headers(request.headers);
    headers.delete("host");
    const body = request.method === "GET" || request.method === "DELETE" ? undefined : await request.text();
    const upstream = await fetch(target, { method: request.method, headers, body });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  try {
    if (joined === "providers" && request.method === "GET") {
      return NextResponse.json({ object: "list", data: publicCatalog() });
    }

    if (joined === "providers/connect" && request.method === "POST") {
      const body = await request.json();
      const user = await accountFromRequest(request);
      const sid = user ? accountSessionId(user.id) : undefined;
      const payload = connectPayload(body);
      const published =
        payload.mode === "mock"
          ? createMockSession(payload.label, sid)
          : await createByokSession(payload, sid);
      if (user) {
        const session = getSession(accountSessionId(user.id));
        if (session) await saveProvider(user.id, session);
      }
      return NextResponse.json(published);
    }

    if (joined === "classify" && request.method === "POST") {
      const body = await request.json();
      const prompt =
        body.prompt ??
        (Array.isArray(body.messages) ? body.messages.map((m: { content: string }) => m.content).join("\n") : "");
      if (!prompt) return NextResponse.json({ detail: "Provide messages or prompt." }, { status: 400 });
      return NextResponse.json(classifyText(prompt));
    }

    if (joined === "benchmark" && request.method === "GET") {
      return NextResponse.json({ name: "Promptimizer Fixed Task Set", tasks: BENCHMARK });
    }

    const actor = await resolve(request);
    if ("error" in actor && actor.error) return actor.error;
    if (!actor.session) {
      return NextResponse.json({ detail: "Sign in or pass a Promptimizer API key." }, { status: 401 });
    }
    const session = actor.session;

    if (joined === "session" && request.method === "GET") return NextResponse.json(publicSession(session));
    if (joined === "session" && request.method === "DELETE") {
      return NextResponse.json({ ok: true });
    }
    if (joined === "models" && request.method === "GET") {
      return NextResponse.json({ object: "list", data: session.models, baseline_model: session.baseline_model });
    }
    if (joined === "models" && request.method === "PATCH") {
      const next = patchFleet(session, await request.json());
      if (actor.user) await saveProvider(actor.user.id, session);
      return NextResponse.json(next);
    }
    if (joined === "savings" && request.method === "GET") {
      if (!actor.user) {
        return NextResponse.json({ detail: "Sign in or pass a Promptimizer API key." }, { status: 401 });
      }
      return NextResponse.json(await savingsForUser(actor.user.id));
    }
    if (joined === "chat/completions" && request.method === "POST") {
      const result = await routeChat(session, await request.json());
      if (actor.user) {
        const cost = result.usage.cost;
        const meta = result.promptimizer;
        if (cost && meta) {
          try {
            await recordUsage(actor.user.id, {
              model: String(meta.model ?? result.model),
              tier: String(meta.tier ?? ""),
              actual_usd: cost.actual_usd,
              baseline_usd: cost.baseline_usd,
              saved_usd: cost.saved_usd,
              routing_saved_usd: cost.routing_saved_usd,
              cache_saved_usd: cost.cache_discount_usd,
              cache_hit: Boolean(meta.cache_hit),
              escalated: Boolean(meta.escalated),
              quality:
                typeof meta.quality === "object" && meta.quality && "score" in meta.quality
                  ? Number((meta.quality as { score: number }).score)
                  : null,
            });
          } catch {
            /* receipts should not fail the completion */
          }
        }
      }
      return NextResponse.json(result);
    }
    if (joined === "benchmark/run" && request.method === "POST") {
      return NextResponse.json(await runBenchmark(session));
    }
    if (joined === "analytics" && request.method === "GET") {
      const stats = session.stats;
      return NextResponse.json({
        session: publicSession(session),
        saved_pct: stats.baseline_usd ? (stats.saved_usd / stats.baseline_usd) * 100 : 0,
      });
    }

    return NextResponse.json({ detail: `Unknown route /v1/${joined}` }, { status: 404 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ detail: message }, { status: status || 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await ctx.params).path);
}
