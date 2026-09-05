import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  deleteProviderConnection,
  loadQualityProfiles,
  persistMultiProviderSession,
  recordRoutingEvent,
  recordUsage,
  saveQualityProfiles,
  savingsForUser,
  usageDetailFromMeta,
  userFromApiKey,
} from "@/server/account";
import { authConfigured } from "@/server/db";
import { classifyText, publicCatalog, resolveBaseURL } from "promptimizer";
import {
  accountSessionId,
  createByokSession,
  destroySession,
  disconnectProvider,
  getSession,
  invalidateOwnerCaches,
  patchFleet,
  publicSession,
  routeChat,
  routeChatStream,
  runBenchmark,
  sessionForUser,
} from "@/server/engine";
import { BENCHMARK } from "@/server/data";
import { clientIp, rateLimit } from "@/server/rate-limit";

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
  if (body.mode === "mock" || body.provider === "simulator" || body.provider === "mock") {
    throw Object.assign(new Error("Simulator mode was removed. Connect a real OpenAI-compatible provider."), {
      status: 400,
    });
  }
  const { baseURL, provider } = resolveBaseURL({ provider: body.provider, baseURL: body.base_url });
  if (!baseURL) {
    throw Object.assign(new Error("Unknown provider. Pass base_url for a custom OpenAI-compatible /v1."), {
      status: 400,
    });
  }
  let apiKey = body.api_key?.trim() ?? "";
  if (!apiKey) throw Object.assign(new Error("api_key is required."), { status: 400 });
  return {
    mode: "byok" as const,
    label: body.label || provider?.label || "BYOK",
    base_url: baseURL,
    api_key: apiKey,
    provider: provider?.id,
  };
}

function promptFromBody(body: { messages?: Array<{ role?: string; content?: unknown }> }) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }
  return messages
    .map((m) => (typeof m?.content === "string" ? m.content : ""))
    .filter(Boolean)
    .join("\n");
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
    const session = await getSession(token);
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
      const limited = await rateLimit("connect", clientIp(request));
      if (limited) return limited;
      const body = await request.json();
      const user = await accountFromRequest(request);
      const allowAnon = (process.env.ALLOW_ANON_CONNECT ?? "").trim() === "1";
      if (!user && !allowAnon) {
        return NextResponse.json(
          { detail: "Sign in or pass a Promptimizer API key to connect a provider." },
          { status: 401 },
        );
      }
      const sid = user ? accountSessionId(user.id) : undefined;
      const payload = connectPayload(body);
      const published = await createByokSession(payload, sid);
      if (user) {
        const session = await getSession(accountSessionId(user.id));
        if (session && session.mode === "byok") {
          await persistMultiProviderSession(user.id, session);
        }
        // Refresh models / reconnect — drop stale completion cache for this account.
        await invalidateOwnerCaches(user.id);
      }
      return NextResponse.json(published);
    }

    if (joined === "providers/disconnect" && request.method === "POST") {
      const limited = await rateLimit("connect", clientIp(request));
      if (limited) return limited;
      const body = await request.json().catch(() => ({}));
      const needle = String(body.provider ?? body.id ?? body.host ?? "").trim();
      const actor = await resolve(request);
      if ("error" in actor && actor.error) return actor.error;
      if (!actor.session) {
        return NextResponse.json({ detail: "Sign in or pass a Promptimizer API key." }, { status: 401 });
      }
      const { session: published, removed } = disconnectProvider(actor.session, needle);
      const owner = actor.user?.id ?? actor.session.id;
      await invalidateOwnerCaches(owner);
      if (actor.user) {
        await deleteProviderConnection(actor.user.id, removed.base_url);
        const live = await getSession(accountSessionId(actor.user.id));
        if (live && live.mode === "byok" && live.connections.length) {
          await persistMultiProviderSession(actor.user.id, live);
        }
      }
      return NextResponse.json({ ...published, removed: { id: removed.id, label: removed.label } });
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
      const owner = actor.user?.id ?? session.id;
      await destroySession(session.id, owner);
      return NextResponse.json({ ok: true, cleared_cache: true });
    }
    if (joined === "models" && request.method === "GET") {
      return NextResponse.json({ object: "list", data: session.models, baseline_model: session.baseline_model });
    }
    if (joined === "models" && request.method === "PATCH") {
      const next = patchFleet(session, await request.json());
      if (actor.user && session.mode === "byok") await persistMultiProviderSession(actor.user.id, session);
      return NextResponse.json(next);
    }
    if (joined === "savings" && request.method === "GET") {
      if (!actor.user) {
        return NextResponse.json({ detail: "Sign in or pass a Promptimizer API key." }, { status: 401 });
      }
      return NextResponse.json(await savingsForUser(actor.user.id));
    }
    if (joined === "chat/completions" && request.method === "POST") {
      const limited = await rateLimit("chat", actor.user?.id ?? clientIp(request));
      if (limited) return limited;
      const profiles = actor.user ? await loadQualityProfiles(actor.user.id) : [];
      const body = await request.json();
      const cacheOwner = actor.user?.id ?? session.id;
      if (body.stream) {
        const record = async (result: Awaited<ReturnType<typeof routeChat>>) => {
          if (!actor.user) return;
          const cost = result.usage.cost;
          const meta = result.promptimizer;
          if (!cost || !meta) return;
          try {
            const metaRec = meta as unknown as Record<string, unknown>;
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
              semantic_hit: Boolean(meta.semantic_cache_hit),
              semantic_similarity:
                meta.semantic_similarity == null ? null : Number(meta.semantic_similarity),
              quality_gate: meta.quality_gate ? String(meta.quality_gate) : "",
              quality_audit: Boolean(meta.quality_audit),
              quality_audit_pass:
                meta.quality_audit_pass == null ? null : Boolean(meta.quality_audit_pass),
              prompt: promptFromBody(body),
              detail: usageDetailFromMeta(metaRec, cost),
            });
            await recordRoutingEvent(actor.user.id, {
              request_id: String(meta.request_id ?? ""),
              policy: String(meta.routing_policy ?? "bootstrap_heuristic"),
              selected_model: String(meta.initial_model ?? meta.model ?? ""),
              final_model: String(meta.final_model ?? meta.model ?? ""),
              estimated_cost_usd: meta.estimated_cost_usd == null ? null : Number(meta.estimated_cost_usd),
              actual_cost_usd: cost.actual_usd,
              estimated_quality: meta.estimated_quality == null ? null : Number(meta.estimated_quality),
              cache_hit: Boolean(meta.cache_hit),
              escalated: Boolean(meta.escalated),
              escalation_reason: meta.escalation_reason ? String(meta.escalation_reason) : null,
              rejected: meta.rejected,
              rationale: meta.rationale ? String(meta.rationale) : null,
            });
          } catch {
            /* receipts should not fail the completion */
          }
        };
        const stream = routeChatStream(
          session,
          body,
          { qualityProfiles: profiles, cacheOwner },
          { onComplete: record },
        );
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }
      const result = await routeChat(session, body, { qualityProfiles: profiles, cacheOwner });
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
              semantic_hit: Boolean(meta.semantic_cache_hit),
              semantic_similarity:
                meta.semantic_similarity == null ? null : Number(meta.semantic_similarity),
              quality_gate: meta.quality_gate ? String(meta.quality_gate) : "",
              quality_audit: Boolean(meta.quality_audit),
              quality_audit_pass:
                meta.quality_audit_pass == null ? null : Boolean(meta.quality_audit_pass),
              prompt: promptFromBody(body),
              detail: usageDetailFromMeta(meta as unknown as Record<string, unknown>, cost),
            });
            await recordRoutingEvent(actor.user.id, {
              request_id: String(meta.request_id ?? ""),
              policy: String(meta.routing_policy ?? "bootstrap_heuristic"),
              selected_model: String(meta.initial_model ?? meta.model ?? ""),
              final_model: String(meta.final_model ?? meta.model ?? ""),
              estimated_cost_usd: meta.estimated_cost_usd == null ? null : Number(meta.estimated_cost_usd),
              actual_cost_usd: cost.actual_usd,
              estimated_quality: meta.estimated_quality == null ? null : Number(meta.estimated_quality),
              cache_hit: Boolean(meta.cache_hit),
              escalated: Boolean(meta.escalated),
              escalation_reason: meta.escalation_reason ? String(meta.escalation_reason) : null,
              rejected: meta.rejected,
              rationale: meta.rationale ? String(meta.rationale) : null,
            });
          } catch {
            /* receipts should not fail the completion */
          }
        }
      }
      return NextResponse.json(result);
    }
    if (joined === "benchmark/run" && request.method === "POST") {
      const bench = await runBenchmark(session);
      if (actor.user && Array.isArray(bench.quality_profiles) && bench.quality_profiles.length) {
        try {
          await saveQualityProfiles(actor.user.id, bench.quality_profiles, bench.benchmark_id);
          if (session.mode === "byok") await persistMultiProviderSession(actor.user.id, session);
        } catch {
          /* profile persistence is best-effort */
        }
      }
      return NextResponse.json(bench);
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
