import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** User-supplied provider hosts must be public HTTPS. Blocks metadata and private targets. */
export async function assertPublicProviderUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw Object.assign(new Error("Provider URL is not valid."), { status: 400 });
  }
  if (url.username || url.password) {
    throw Object.assign(new Error("Provider URL cannot include credentials."), { status: 400 });
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  const devLocal =
    process.env.NODE_ENV !== "production" &&
    (host === "localhost" || host === "127.0.0.1" || host === "::1");
  if (url.protocol !== "https:" && !(devLocal && url.protocol === "http:")) {
    throw Object.assign(new Error("Provider URL must use https."), { status: 400 });
  }
  if (!devLocal && (isBlockedHost(host) || isPrivateAddress(host))) {
    throw Object.assign(new Error("Provider URL must be a public https host."), { status: 400 });
  }
  if (!devLocal && !isIP(host) && !skipDnsCheck()) {
    let records: Array<{ address: string }>;
    try {
      records = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw Object.assign(new Error("Provider host could not be resolved."), { status: 400 });
    }
    if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
      throw Object.assign(new Error("Provider URL must be a public https host."), { status: 400 });
    }
  }
  return url.toString().replace(/\/$/, "").toLowerCase();
}

function skipDnsCheck() {
  return process.env.NODE_TEST_CONTEXT != null || process.env.NODE_ENV === "test";
}

function isBlockedHost(host: string) {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host === "metadata.google.com"
  );
}

function isPrivateAddress(address: string): boolean {
  const raw = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (raw === "::1" || raw === "0:0:0:0:0:0:0:1") return true;
  if (raw.startsWith("fe80:") || raw.startsWith("fc") || raw.startsWith("fd")) return true;
  const mapped = raw.startsWith("::ffff:") ? raw.slice("::ffff:".length) : raw;
  if (/^\d+$/.test(mapped)) {
    const n = Number(mapped);
    if (Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) return isPrivateV4(n);
  }
  const parts = mapped.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 255)) return false;
  const n = parts.reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
  return isPrivateV4(n);
}

function isPrivateV4(n: number) {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}
