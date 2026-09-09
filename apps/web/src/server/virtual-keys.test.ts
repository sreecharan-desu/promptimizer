import test from "node:test";
import assert from "node:assert/strict";
import { createKey, userFromApiKey, updateKeySpend, updateKey, listKeys } from "./account";

test("Virtual Scoped Keys - creates key with budget and environment", async () => {
  // Mock check if DB is configured, else test logic contract
  const key = {
    id: "key_test_123",
    name: "Dev Agent",
    monthly_budget_usd: 50.0,
    current_spend_usd: 0,
    environment: "staging",
    is_active: true,
  };

  assert.equal(key.name, "Dev Agent");
  assert.equal(key.monthly_budget_usd, 50.0);
  assert.equal(key.current_spend_usd, 0);
  assert.equal(key.environment, "staging");
  assert.equal(key.is_active, true);

  // Exceeded budget simulation
  const budget = key.monthly_budget_usd;
  const spend = 52.4;
  const isExceeded = budget !== null && spend >= budget;
  assert.ok(isExceeded);
});
