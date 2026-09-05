/** Abortable fetch with a hard timeout (default 55s — under typical gateway limits). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 55_000),
): Promise<Response> {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 55_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const parent = init.signal;
    if (parent) {
      if (parent.aborted) controller.abort();
      else parent.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error(`Upstream timed out after ${ms}ms`), {
        status: 504,
        provider_error: true,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
