import test from "node:test";
import assert from "node:assert/strict";
import { accountMismatch } from "./source-identity.mjs";

test("the selected account must match before a source read can continue", () => {
  assert.equal(accountMismatch(" OWNER@example.com ", "owner@example.com"), null);
  const result = accountMismatch("personal@example.com", "work@example.com");
  assert.equal(result.status, "account_mismatch");
  assert.equal(result.reportedAccount, "personal@example.com");
  assert.equal(result.expectedAccount, "work@example.com");
});

test("missing or malformed provider identity never verifies an account", () => {
  for (const identity of [undefined, null, "", "  ", {}, 42]) {
    assert.equal(accountMismatch(identity, "work@example.com").status, "account_mismatch");
  }
});
