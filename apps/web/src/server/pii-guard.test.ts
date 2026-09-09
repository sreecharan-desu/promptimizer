import test from "node:test";
import assert from "node:assert/strict";
import { maskPII, maskMessages, unmaskText } from "./guardrails/pii-guard";

test("PII Guardrail - masks emails, credit cards, phones, and secrets", () => {
  const input =
    "Contact john.doe@example.com or call 555-123-4567. Card: 4111-2222-3333-4444, Secret: sk-abc1234567890abcdef12345";
  const { maskedText, redactedCount, entityMap, typesFound } = maskPII(input);

  assert.equal(redactedCount, 4);
  assert.ok(typesFound.includes("EMAIL"));
  assert.ok(typesFound.includes("PHONE"));
  assert.ok(typesFound.includes("CARD"));
  assert.ok(typesFound.includes("SECRET"));

  assert.ok(!maskedText.includes("john.doe@example.com"));
  assert.ok(!maskedText.includes("4111-2222-3333-4444"));
  assert.ok(!maskedText.includes("sk-abc1234567890abcdef12345"));

  // Restore original
  const restored = unmaskText(maskedText, entityMap);
  assert.equal(restored, input);
});

test("PII Guardrail - masks across chat messages and unmasks response", () => {
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "My email is support@acme.corp. What is your refund policy?" },
  ];

  const { maskedMessages, redactedCount, entityMap } = maskMessages(messages);
  assert.equal(redactedCount, 1);
  assert.ok(maskedMessages[1].content.includes("[EMAIL_1]"));
  assert.ok(!maskedMessages[1].content.includes("support@acme.corp"));

  // Simulate LLM response mentioning the placeholder
  const llmResponse = "We have sent a refund receipt to [EMAIL_1].";
  const finalDelivered = unmaskText(llmResponse, entityMap);
  assert.equal(finalDelivered, "We have sent a refund receipt to support@acme.corp.");
});
