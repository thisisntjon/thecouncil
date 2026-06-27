#!/usr/bin/env node
// Offline, non-circular proof of the reasoning-mode ROUTING (P1, criteria 1 + 7).
// We can't run the live LLM verifiers here, but routing is what the fix turns on:
// reasoning claims must go to the re-derivation verifier, and factual claims must NOT
// be poached away from evidence verification (the factual-regression guard).
import assert from "node:assert/strict";
import { isReasoningClaim, claimAuthorId, REASONING_CATEGORIES } from "../lib/claims.mjs";

// Reasoning claims (the kind that scored 0.0 live) route to re-derivation.
for (const category of ["computation", "logical_deduction", "derivation"]) {
  assert.equal(isReasoningClaim({ id: "gpt-1", text: "the ball costs $0.10", category }), true, `${category} should route to reasoning`);
}

// Factual claims keep the evidence path — no mis-routing (criterion 7).
for (const category of ["statistic", "attribution", "causal", "definition", "comparison", "temporal", "other"]) {
  assert.equal(isReasoningClaim({ id: "claude-2", text: "Donald Trump is president", category }), false, `${category} must stay on the evidence path`);
}

// Robustness: missing/empty/unknown category is NOT treated as reasoning (conservative).
assert.equal(isReasoningClaim({ id: "gpt-3", text: "x" }), false);
assert.equal(isReasoningClaim({ id: "gpt-3", text: "x", category: "" }), false);
assert.equal(isReasoningClaim({ id: "gpt-3", text: "x", category: "unknown" }), false);
assert.equal(isReasoningClaim(null), false);
assert.equal(isReasoningClaim(undefined), false);

// The category set is exactly the three reasoning kinds.
assert.deepEqual([...REASONING_CATEGORIES].sort(), ["computation", "derivation", "logical_deduction"]);

// Author id (for independent verifier selection) parses the model prefix.
assert.equal(claimAuthorId({ id: "gpt-3" }), "gpt");
assert.equal(claimAuthorId({ id: "claude-12" }), "claude");
assert.equal(claimAuthorId({ id: "nodash" }), null);
assert.equal(claimAuthorId({}), null);

console.log("claims smoke tests passed.");
