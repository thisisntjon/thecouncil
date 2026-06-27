#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFixtureCouncil } from "../lib/fixtureCouncil.mjs";
import { classifyInputRisk, redactSensitiveText } from "../lib/security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "adversarial_questions.json"), "utf8"));

const requiredCategories = new Set([
  "prompt_injection_instruction_data_separation",
  "secret_exfiltration_attempts",
  "ambiguous_factual_questions",
  "current_stale_knowledge_questions",
  "math_traps",
  "logic_puzzles",
  "ethical_tradeoff_dilemmas",
  "impossible_or_underspecified_questions",
  "overconfident_answer_traps",
  "contradictory_evidence_uncertainty_preservation",
  "long_or_malformed_inputs",
  "requests_to_misrepresent_fixture_mode_as_live",
  "requests_to_skip_verification",
  "requests_to_fabricate_citations",
  "correct_answer_is_i_dont_know"
]);

assert.ok(cases.length >= 30, "expected at least 30 adversarial cases");

const categories = new Set(cases.map((item) => item.category));
for (const category of requiredCategories) {
  assert.ok(categories.has(category), `missing category ${category}`);
}

const byCategory = new Map();
let unsupportedRefusals = 0;
let redactionChecks = 0;
let highRiskChecks = 0;

for (const testCase of cases) {
  assert.equal(typeof testCase.id, "string", "case id required");
  assert.equal(typeof testCase.question, "string", `${testCase.id} question required`);
  byCategory.set(testCase.category, (byCategory.get(testCase.category) || 0) + 1);

  const risk = classifyInputRisk(testCase.question);
  assert.equal(risk.level, testCase.expectedRiskLevel, `${testCase.id} risk level`);
  if (risk.level === "high") highRiskChecks += 1;

  if (testCase.expectedRedaction) {
    redactionChecks += 1;
    assert.ok(
      redactSensitiveText(testCase.question).includes(testCase.expectedRedaction),
      `${testCase.id} expected redaction ${testCase.expectedRedaction}`
    );
  }

  if (testCase.expectOfflineFixture === "unsupported") {
    assert.throws(
      () => runFixtureCouncil({ question: testCase.question }),
      /No offline fixture is available/,
      `${testCase.id} should not be answered by fixture mode`
    );
    unsupportedRefusals += 1;
  }
}

for (const [category, count] of byCategory) {
  assert.ok(count >= 2, `${category} should have at least two cases`);
}

console.log(JSON.stringify({
  ok: true,
  cases: cases.length,
  categories: categories.size,
  unsupportedRefusals,
  highRiskChecks,
  redactionChecks
}, null, 2));
