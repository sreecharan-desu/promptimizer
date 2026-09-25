import { sseComment, sseData, ssePad, sseResponse } from "@/server/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Infrastructure canary for live SSE on Vercel.
 * Emits a stream_open event, then 5 timed ping events ~200ms apart.
 * If Chrome EventStream stays empty here, the platform path is broken —
 * not the chat pipeline.
 */
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(sseData(payload)));
      send({ type: "stream_open", t: Date.now() });
      controller.enqueue(encoder.encode(ssePad()));
      for (let i = 1; i <= 5; i += 1) {
        await new Promise((r) => setTimeout(r, 200));
        send({ type: "ping", i, t: Date.now() });
      }
      send("[DONE]");
      controller.enqueue(encoder.encode(sseComment("done")));
      controller.close();
    },
  });
  return sseResponse(stream);
}
