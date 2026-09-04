import { NextRequest, NextResponse } from "next/server";
import {
  createByokSession,
  createMockSession,
  getSession,
  patchFleet,
  publicSession,
  routeChat,
  runBenchmark,
} from "@/server/engine";
import { classifyText } from "promptimizer";
import { BENCHMARK } from "@/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionFrom(request: NextRequest) {
  return request.headers.get("x-promptimizer-session") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
}

function needSession(request: NextRequest) {
  const session = getSession(sessionFrom(request));
  if (!session) {
    return { error: NextResponse.json({ detail: "Missing session. Connect a provider or use the simulator." }, { status: 401 }) };
  }
  return { session };
}

async function handle(request: NextRequest, path: string[]) {
  const joined = path.join("/");
  const url = process.env.PROMPTIMIZER_API_URL;

  if (url) {
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
    if (joined === "providers/connect" && request.method === "POST") {
      const body = await request.json();
      if (body.mode === "mock") return NextResponse.json(createMockSession(body.label));
      if (!body.base_url || !body.api_key) {
        return NextResponse.json({ detail: "base_url and api_key are required for BYOK." }, { status: 400 });
      }
      return NextResponse.json(await createByokSession(body));
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

    const gated = needSession(request);
    if ("error" in gated && gated.error) return gated.error;
    const session = gated.session!;

    if (joined === "session" && request.method === "GET") return NextResponse.json(publicSession(session));
    if (joined === "session" && request.method === "DELETE") {
      return NextResponse.json({ ok: true });
    }
    if (joined === "models" && request.method === "GET") {
      return NextResponse.json({ object: "list", data: session.models, baseline_model: session.baseline_model });
    }
    if (joined === "models" && request.method === "PATCH") {
      return NextResponse.json(patchFleet(session, await request.json()));
    }
    if (joined === "chat/completions" && request.method === "POST") {
      return NextResponse.json(await routeChat(session, await request.json()));
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
