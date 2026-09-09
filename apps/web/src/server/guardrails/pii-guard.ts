/**
 * High-performance inline PII masking and redaction guardrail.
 * Scrubs sensitive entities (emails, credit cards, phones, secrets, SSNs)
 * before forwarding prompts upstream to third-party LLM providers, and restores
 * them upon response delivery.
 */

export interface PIIScrubResult {
  maskedText: string;
  redactedCount: number;
  entityMap: Map<string, string>;
  typesFound: string[];
}

// Regex patterns for sensitive entities
const PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: "EMAIL",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "CARD",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4})\b/g,
  },
  {
    type: "SECRET",
    regex: /\b(?:sk-[a-zA-Z0-9-_]{20,}|ghp_[a-zA-Z0-9]{20,}|pmz?_[a-zA-Z0-9-_]{20,}|(?:ey[a-zA-Z0-9-_=]+\.ey[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+))\b/g,
  },
  {
    type: "SSN",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: "PHONE",
    regex: /\b(?:\+?\d{1,3}[ -.]?)?\(?\d{3}\)?[ -.]?\d{3}[ -.]?\d{4}\b/g,
  },
];

/**
 * Mask PII within arbitrary text, returning placeholders and a map to reverse it.
 */
export function maskPII(text: string, existingMap?: Map<string, string>): PIIScrubResult {
  const entityMap = existingMap ?? new Map<string, string>();
  const reverseMap = new Map<string, string>();
  for (const [placeholder, original] of entityMap.entries()) {
    reverseMap.set(original, placeholder);
  }

  let masked = text;
  let count = 0;
  const typesFound = new Set<string>();

  for (const { type, regex } of PATTERNS) {
    masked = masked.replace(regex, (match) => {
      // Check if already mapped
      if (reverseMap.has(match)) {
        return reverseMap.get(match)!;
      }
      count += 1;
      typesFound.add(type);
      const placeholder = `[${type}_${entityMap.size + 1}]`;
      entityMap.set(placeholder, match);
      reverseMap.set(match, placeholder);
      return placeholder;
    });
  }

  return {
    maskedText: masked,
    redactedCount: count,
    entityMap,
    typesFound: Array.from(typesFound),
  };
}

/**
 * Mask PII across an array of chat messages.
 */
export function maskMessages(
  messages: Array<{ role: string; content: string }>,
): {
  maskedMessages: Array<{ role: string; content: string }>;
  redactedCount: number;
  entityMap: Map<string, string>;
  typesFound: string[];
} {
  const entityMap = new Map<string, string>();
  let totalRedacted = 0;
  const allTypes = new Set<string>();

  const maskedMessages = messages.map((msg) => {
    if (!msg.content || typeof msg.content !== "string") return msg;
    const { maskedText, redactedCount, typesFound } = maskPII(msg.content, entityMap);
    totalRedacted += redactedCount;
    for (const t of typesFound) allTypes.add(t);
    return { ...msg, content: maskedText };
  });

  return {
    maskedMessages,
    redactedCount: totalRedacted,
    entityMap,
    typesFound: Array.from(allTypes),
  };
}

/**
 * Restore original values from placeholders in LLM responses or deltas.
 */
export function unmaskText(text: string, entityMap: Map<string, string>): string {
  if (!text || entityMap.size === 0) return text;
  let unmasked = text;
  for (const [placeholder, original] of entityMap.entries()) {
    unmasked = unmasked.replaceAll(placeholder, original);
  }
  return unmasked;
}
