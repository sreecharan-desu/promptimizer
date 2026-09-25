/**
 * Canonical SSE helpers for Next.js App Router on Vercel.
 *
 * Sources of truth:
 * - Next.js Route Handler streaming: return `new Response(ReadableStream)`
 *   https://nextjs.org/docs/app/guides/streaming
 * - Vercel AI SDK (proxied/deployed streaming):
 *   Content-Encoding: none; Cache-Control: no-cache; Transfer-Encoding: chunked;
 *   Connection: keep-alive
 *   https://ai-sdk.dev/docs/troubleshooting/streaming-not-working-when-proxied
 *   https://ai-sdk.dev/docs/troubleshooting/streaming-not-working-when-deployed
 * - Nginx/Vercel proxies: X-Accel-Buffering: no
 */

export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-store, no-transform",
  Connection: "keep-alive",
  "Transfer-Encoding": "chunked",
  "X-Accel-Buffering": "no",
  // Browsers send Accept-Encoding: gzip — compression buffers the entire body.
  "Content-Encoding": "none",
};

export function sseData(payload: unknown): string {
  return `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;
}

export function sseComment(text: string): string {
  return `: ${text}\n\n`;
}

/** ~2KB padding comment — flushes intermediary proxy buffers that wait for a threshold. */
export function ssePad(): string {
  return sseComment(" ".repeat(2048));
}

export function sseResponse(stream: ReadableStream<Uint8Array>, init?: ResponseInit): Response {
  const headers = new Headers(SSE_HEADERS);
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }
  return new Response(stream, {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers,
  });
}

/**
 * Build an SSE ReadableStream that emits immediately, then runs `run`.
 * Guarantees the Response body starts flowing before any slow work.
 */
export function createSseStream(
  run: (emit: (payload: unknown) => void, enc: TextEncoder) => Promise<void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (payload: unknown) => {
        controller.enqueue(encoder.encode(sseData(payload)));
      };
      try {
        // Immediate open + pad so browsers/DevTools see the EventStream instantly.
        emit({ type: "stream_open" });
        controller.enqueue(encoder.encode(ssePad()));
        await run(emit, encoder);
      } catch (error) {
        const message = error instanceof Error ? error.message : "stream failed";
        emit({ error: { message, type: "server_error" } });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
}
