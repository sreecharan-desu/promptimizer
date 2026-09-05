import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  accountSessionId,
  createByokSession,
  disconnectProvider,
  getSession,
  routeChat,
  userIdFromSessionId,
} from "./engine";

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockModelsFetch(ids: string[]) {
  (globalThis as any).fetch = async () => jsonResponse({ object: "list", data: ids.map((id) => ({ id })) });
}

afterEach(() => {
  (globalThis as any).fetch = realFetch;
});

describe("fleet hygiene", () => {
  it("userIdFromSessionId inverts accountSessionId and rejects anonymous ids", () => {
    assert.equal(userIdFromSessionId(accountSessionId("usr_1")), "usr_1");
    assert.equal(userIdFromSessionId("sess_abc123"), null);
    assert.equal(userIdFromSessionId(null), null);
    assert.equal(userIdFromSessionId("acct_"), null);
  });

  it("disconnect removes the host and its models", async () => {
    mockModelsFetch(["m-8b", "m-70b"]);
    const sid = `acct_hyg_${Date.now()}`;
    const s = await createByokSession({ base_url: "https://a.test/v1", api_key: "k" }, sid);
    assert.equal(s.connections.length, 1);
    assert.equal(s.models.length, 2);
    const session: any = await getSession(sid);
    const { session: after } = await disconnectProvider(session, session.connections[0].id);
    assert.equal(after.connections.length, 0);
    assert.equal(after.models.length, 0);
  });

  it("drops orphan models whose host is no longer connected", async () => {
    mockModelsFetch(["m-8b", "m-70b"]);
    const sid = `acct_orph_${Date.now()}`;
    await createByokSession({ base_url: "https://a.test/v1", api_key: "k" }, sid);
    const session: any = await getSession(sid);
    // Simulate a resurrected stale host's model surviving in the fleet.
    session.models.push({
      id: "stale/glm-5",
      owned_by: "baseten",
      input_per_1m: 1,
      output_per_1m: 2,
      tier: "frontier",
      source: "catalog",
      selected: true,
      provider_id: "ghost",
      provider_label: "Ghost",
    });
    const merged = await createByokSession({ base_url: "https://a.test/v1", api_key: "k" }, sid);
    assert.ok(
      !merged.models.some((m: { provider_id: string }) => m.provider_id === "ghost"),
      "orphan model must be pruned on fleet dedupe",
    );
    assert.equal(merged.models.length, 2);
  });

  it("fails over to another host when a provider rejects a model as not configured (400)", async () => {
    const sid = `acct_fail_${Date.now()}`;
    const chats: Array<{ host: string; model: string; status: number }> = [];
    (globalThis as any).fetch = async (url: unknown, init?: { body?: string }) => {
      const u = String(url);
      if (u.endsWith("/models")) {
        const ids = u.includes("broken.test") ? ["f-405b"] : ["g-70b"];
        return jsonResponse({ object: "list", data: ids.map((id) => ({ id })) });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      chats.push({
        host: u.includes("broken.test") ? "broken" : "good",
        model: String(body.model),
        status: u.includes("broken.test") ? 400 : 200,
      });
      if (u.includes("broken.test")) {
        return jsonResponse({ detail: `Model ${body.model} is not configured for this account.` }, 400);
      }
      return jsonResponse({
        id: "cmpl-test",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "A detailed multi-region rate limiter design answer. ".repeat(6),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    };

    await createByokSession({ base_url: "https://broken.test/v1", api_key: "k", provider: "broken" }, sid);
    await createByokSession({ base_url: "https://good.test/v1", api_key: "k", provider: "good" }, sid);
    const session: any = await getSession(sid);
    const result: any = await routeChat(
      session,
      {
        messages: [
          {
            role: "user",
            content:
              "Design a rate limiter for 1 million QPS across 50 regions. Discuss Redis and failure modes.",
          },
        ],
      },
      { cacheOwner: sid },
    );

    // The router first picked the cheapest frontier model on the broken host…
    assert.ok(chats.some((c) => c.host === "broken" && c.status === 400), "broken host tried first");
    // …and instead of surfacing the raw 400, the request failed over to the good host.
    assert.equal(result.model, "g-70b");
    assert.ok(
      chats.some((c) => c.host === "good" && c.model === "g-70b" && c.status === 200),
      "must complete on the good host",
    );
  });

  it("escalations fail over instead of surfacing raw 'not configured' errors", async () => {
    const sid = `acct_esc_${Date.now()}`;
    const chats: Array<{ host: string; model: string; status: number }> = [];
    (globalThis as any).fetch = async (url: unknown, init?: { body?: string }) => {
      const u = String(url);
      if (u.endsWith("/models")) {
        // frontier tier only exists on the broken host; the good host has a standard model.
        const ids = u.includes("broken.test") ? ["f-405b"] : ["g-70b"];
        return jsonResponse({ object: "list", data: ids.map((id) => ({ id })) });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      chats.push({
        host: u.includes("broken.test") ? "broken" : "good",
        model: String(body.model),
        status: u.includes("broken.test") ? 400 : 200,
      });
      if (u.includes("broken.test")) {
        return jsonResponse({ detail: `Model ${body.model} is not configured for this account.` }, 400);
      }
      // The good host "refuses" — a confident gate failure that triggers escalation.
      return jsonResponse({
        id: "cmpl-test",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          { index: 0, message: { role: "assistant", content: "I don't know, I cannot help with that." }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    };

    await createByokSession({ base_url: "https://good.test/v1", api_key: "k", provider: "good" }, sid);
    await createByokSession({ base_url: "https://broken.test/v1", api_key: "k", provider: "broken" }, sid);
    const session: any = await getSession(sid);
    const result: any = await routeChat(
      session,
      {
        messages: [
          {
            role: "user",
            content:
              "Design a rate limiter for 1 million QPS across 50 regions. Discuss Redis and failure modes.",
          },
        ],
      },
      { cacheOwner: sid },
    );

    // The escalation target (cheapest frontier, on the broken host) was tried…
    assert.ok(chats.some((c) => c.host === "broken" && c.status === 400), "escalation tried broken host");
    // …but the raw 400 must NOT fail the request — it completes on the good host.
    assert.ok(
      chats.some((c) => c.host === "good" && c.status === 200),
      "escalation must fail over to the good host",
    );
    assert.ok(result?.choices?.[0]?.message?.content, "request must complete with an answer");
  });
});
