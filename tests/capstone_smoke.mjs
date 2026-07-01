#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listDemoQuestions, runFixtureCouncil, writeReport, ROOT } from "../lib/fixtureCouncil.mjs";
import { buildFixtureUiHtml } from "../scripts/fixture_ui_server.mjs";
import { formatLivePreflight, getLivePreflightStatus } from "../scripts/live_preflight.mjs";

const report = runFixtureCouncil();
assert.equal(report.mode, "fixture");
assert.equal(report.simulated, true);
assert.equal(report.agents.length, 4);
assert.ok(report.verifiedClaims.length >= 10);
assert.ok(report.final.finalAnswer.includes("single strong agent"));

const carWashQuestion = "I want to wash my car. The car wash is 50 meters away. Should I walk or drive?";
const carWashReport = runFixtureCouncil({ question: carWashQuestion });
assert.equal(carWashReport.scenarioId, "car_wash_50m");
assert.equal(carWashReport.question, carWashQuestion);
assert.equal(carWashReport.agents.length, 4);
assert.ok(carWashReport.agents.every((agent) => typeof agent.roleWeight === "number"));
assert.ok(carWashReport.swarmRoles.length >= 4);
assert.ok(carWashReport.verifiedClaims.length >= 5);
assert.ok(carWashReport.verifiedClaims.every((claim) => claim.id.startsWith("cw")));
assert.ok(!carWashReport.final.finalAnswer.includes("single strong agent"));
assert.match(carWashReport.final.finalAnswer, /drive the car/i);
assert.match(carWashReport.final.finalAnswer, /walking is reasonable/i);
assert.match(carWashReport.final.finalAnswer, /if the car is already at the wash/i);
assert.ok(carWashReport.final.decisionScores.drive > carWashReport.final.decisionScores.walk);
assert.ok(carWashReport.final.unresolvedClaims.some((claim) => claim.id === "cw6"));

// Reasoning vs. evidence routing (lib/claims.mjs, shared with the live swarm): the two
// pure deductions are re-derived independently; factual claims stay on the evidence path.
const cwById = Object.fromEntries(carWashReport.verifiedClaims.map((claim) => [claim.id, claim]));
assert.equal(cwById.cw2.verificationMethod, "independent_re_derivation");
assert.equal(cwById.cw4.verificationMethod, "independent_re_derivation");
assert.equal(cwById.cw1.verificationMethod, "evidence_check");
assert.equal(cwById.cw3.verificationMethod, "evidence_check");
assert.ok(
  carWashReport.auditTrail.some((item) => item.step === "verify_claims_against_fixture" && item.detail.includes("independent re-derivation")),
  "audit trail should record the reasoning-claim routing"
);
assert.ok(report.verifiedClaims.every((claim) => claim.verificationMethod === "evidence_check"));

const guardrailScenarios = [
  {
    question: "I only want to check the price at the car wash. It is 50 meters away. Should I walk or drive?",
    scenarioId: "car_wash_price_check_50m",
    claimPrefix: "pc",
    answerPattern: /walk/i,
    preferredOption: "walk",
    lowerOption: "drive"
  },
  {
    question: "My car is already at the car wash. The car wash is 50 meters away. Should I walk or drive?",
    scenarioId: "car_already_at_wash_50m",
    claimPrefix: "aw",
    answerPattern: /walk/i,
    preferredOption: "walk",
    lowerOption: "drive"
  },
  {
    question: "I want to wash my car. The car wash is 50 meters away, but the car is not safe to drive. Should I walk or drive?",
    scenarioId: "car_not_safe_to_drive_50m",
    claimPrefix: "ns",
    answerPattern: /do not drive/i,
    preferredOption: "do_not_drive",
    lowerOption: "drive"
  },
  {
    question: "The coffee shop is 50 meters away. Should I walk or drive?",
    scenarioId: "coffee_shop_50m",
    claimPrefix: "cf",
    answerPattern: /walk/i,
    preferredOption: "walk",
    lowerOption: "drive"
  }
];

for (const scenario of guardrailScenarios) {
  const scenarioReport = runFixtureCouncil({ question: scenario.question });
  assert.equal(scenarioReport.scenarioId, scenario.scenarioId);
  assert.match(scenarioReport.final.finalAnswer, scenario.answerPattern);
  assert.ok(!scenarioReport.final.finalAnswer.includes("single strong agent"));
  assert.ok(scenarioReport.verifiedClaims.every((claim) => claim.id.startsWith(scenario.claimPrefix)));
  assert.ok(
    scenarioReport.final.decisionScores[scenario.preferredOption] > (scenarioReport.final.decisionScores[scenario.lowerOption] || 0),
    `${scenario.scenarioId} expected ${scenario.preferredOption} to beat ${scenario.lowerOption}`
  );
}

const demoQuestions = listDemoQuestions();
for (const scenario of [carWashQuestion, ...guardrailScenarios.map((item) => item.question)]) {
  assert.ok(demoQuestions.includes(scenario), `missing demo question: ${scenario}`);
}
assert.throws(
  () => runFixtureCouncil({ question: "who is the president?" }),
  /No offline fixture is available/
);

const fixtureUiHtml = buildFixtureUiHtml();
assert.match(fixtureUiHtml, /Offline fixture UI/);
assert.match(fixtureUiHtml, /arbitrary live questions/);
assert.match(fixtureUiHtml, /Verification Swarm/);
assert.match(fixtureUiHtml, /Decision Scores/);
assert.match(fixtureUiHtml, /Audit Export/);
assert.ok(!fixtureUiHtml.includes("Final Rankings"));
assert.ok(!fixtureUiHtml.includes("scoreboard"));

const livePreflight = getLivePreflightStatus();
assert.ok(livePreflight.dependencies.some((item) => item.path === "server/node_modules"));
assert.ok(livePreflight.dependencies.some((item) => item.path === "client/node_modules"));
assert.equal(livePreflight.commands.publicFixtureUi, "launch.bat ui");
assert.match(formatLivePreflight(livePreflight), /Public fixture UI remains available/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "council-fixture-"));
const outputs = writeReport(report, tempDir);
assert.ok(fs.existsSync(outputs.jsonPath));
assert.ok(fs.existsSync(outputs.mdPath));

const carWashOutputs = writeReport(carWashReport, tempDir);
const carWashMarkdown = fs.readFileSync(carWashOutputs.mdPath, "utf8");
assert.match(carWashMarkdown, /Decision Scores/);
assert.match(carWashMarkdown, /Assumptions And Caveats/);

const ignoredPublishableDirs = new Set([
  "node_modules",
  ".git",
  "runs",
  "generated-runs",
  "_private_course_alignment",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "dist",
  "build"
]);

function walkPublishableFiles(dir, root = dir, hits = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredPublishableDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPublishableFiles(full, root, hits);
    } else {
      hits.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  }
  return hits;
}

function listPublishableFiles(root) {
  try {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    return walkPublishableFiles(root);
  }
}

for (const required of [
  "README.md",
  "CAPSTONE.md",
  "KAGGLE_WRITEUP.md",
  "VIDEO_SCRIPT.md",
  "ARCHITECTURE.md",
  "COURSE_CONCEPTS.md",
  "SECURITY_AND_PRIVACY.md",
  "DEMO_GUIDE.md",
  "RELEASE_CHECKLIST.md",
  "LICENSE_REVIEW.md",
  "docs/architecture.mmd",
  "docs/mode-matrix.md",
  "docs/demo-flow.md",
  "skills/council-verification/SKILL.md",
  ".claude/skills/add-fixture/SKILL.md",
  "mcp/README.md",
  "mcp/server_stub.mjs"
]) {
  assert.ok(fs.existsSync(path.join(ROOT, required)), `missing ${required}`);
}

const publishableFiles = listPublishableFiles(ROOT);
assert.deepEqual(publishableFiles.filter((item) => /^\.env($|\.)/i.test(item) && item !== ".env.example"), []);
console.log("Capstone smoke tests passed.");
