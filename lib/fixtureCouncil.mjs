// Deterministic offline replay of the live Council pipeline.
//
// Design intent: the live system (server/ + shadow-council/) calls four vendors and
// cross-verifies claims between them; this engine replays the exact same pipeline
// *shape* — redact -> independent answers -> peer critique -> claim verification ->
// weighted decision scoring -> synthesis -> audit export — from pre-authored fixture
// JSON so the architecture runs with no keys and no network (CI, judges, reviewers).
// Every report is labeled `simulated: true` so fixture output can never pass as live.
//
// Determinism contract: no randomness anywhere. The same question must always produce
// the same report, because tests/capstone_smoke.mjs asserts exact strings and exact
// decision-score orderings, and reports are meant to be diffable across commits.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyInputRisk, redactSensitiveText, TOOL_ALLOWLIST } from "./security.mjs";
import { isReasoningClaim } from "./claims.mjs";
import { writeTextAtomic } from "./ops.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FIXTURE = path.join(ROOT, "fixtures", "council_fixture.json");
const DEFAULT_ALTERNATE_QUESTIONS = [
  "Should a small team use a single powerful AI agent or a council of specialized agents for high-stakes research?"
];
// Scenario registry. Convention: each entry stays in sync with three things —
// fixtures/<name>.json, a tests/capstone_smoke.mjs assertion, and (usually) the demo
// question list. The /add-fixture skill scaffolds all three together.
const SCENARIO_FIXTURES = [
  {
    scenario: "car_wash_50m",
    fixturePath: path.join(ROOT, "fixtures", "car_wash_fixture.json"),
    question: "I want to wash my car. The car wash is 50 meters away. Should I walk or drive?"
  },
  {
    scenario: "car_wash_price_check_50m",
    fixturePath: path.join(ROOT, "fixtures", "car_wash_price_check_fixture.json"),
    question: "I only want to check the price at the car wash. It is 50 meters away. Should I walk or drive?"
  },
  {
    scenario: "car_already_at_wash_50m",
    fixturePath: path.join(ROOT, "fixtures", "car_already_at_wash_fixture.json"),
    question: "My car is already at the car wash. The car wash is 50 meters away. Should I walk or drive?"
  },
  {
    scenario: "car_not_safe_to_drive_50m",
    fixturePath: path.join(ROOT, "fixtures", "car_not_safe_to_drive_fixture.json"),
    question: "I want to wash my car. The car wash is 50 meters away, but the car is not safe to drive. Should I walk or drive?"
  },
  {
    scenario: "coffee_shop_50m",
    fixturePath: path.join(ROOT, "fixtures", "coffee_shop_fixture.json"),
    question: "The coffee shop is 50 meters away. Should I walk or drive?"
  }
];

export function loadFixture(fixturePath = DEFAULT_FIXTURE) {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function normalizeQuestion(question) {
  return String(question ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Route a question to its fixture by *exact* normalized match only. Fuzzy matching is
// deliberately rejected: answering a nearby-but-different question ("the coffee shop is
// 50 meters away") with the car-wash fixture would fabricate evidence for a question
// nobody authored. Unknown questions throw and point the user at the live UI instead.
function selectFixturePath(options = {}) {
  if (options.fixturePath) return options.fixturePath;
  const scenario = SCENARIO_FIXTURES.find((item) => item.scenario === options.scenario);
  if (scenario) return scenario.fixturePath;
  const normalizedQuestion = normalizeQuestion(options.question);
  if (!normalizedQuestion) return DEFAULT_FIXTURE;
  const defaultQuestion = normalizeQuestion(loadFixture(DEFAULT_FIXTURE).question);
  if (normalizedQuestion === defaultQuestion) return DEFAULT_FIXTURE;
  const defaultAlternate = DEFAULT_ALTERNATE_QUESTIONS.some((question) => normalizeQuestion(question) === normalizedQuestion);
  if (defaultAlternate) return DEFAULT_FIXTURE;
  const questionMatch = SCENARIO_FIXTURES.find((item) => normalizeQuestion(item.question) === normalizedQuestion);
  if (questionMatch) return questionMatch.fixturePath;
  throw new Error("No offline fixture is available for that question. Choose one of the listed fixture scenarios, or use the live online UI for arbitrary questions.");
}

function summarizeDisagreements(peerReviews) {
  return peerReviews.map((review) => ({
    reviewer: review.reviewer,
    target: review.target,
    score: review.score,
    strength: review.strength,
    weakness: review.weakness,
    wouldRevise: Boolean(review.wouldRevise)
  }));
}

function verifyClaims(fixture) {
  const evidenceById = Object.fromEntries(fixture.evidence.map((item) => [item.id, item]));

  return Object.entries(fixture.claims).map(([claimId, text]) => {
    // A claim with no mapped evidence is surfaced as "unresolved" at low confidence
    // rather than dropped — the system's core promise is that unverified claims stay
    // visible in the report instead of silently disappearing from the synthesis.
    const check = fixture.verification[claimId] ?? {
      verdict: "unresolved",
      confidence: 0.25,
      evidence: [],
      reasoning: "No fixture evidence was mapped to this claim."
    };

    return {
      id: claimId,
      text,
      verdict: check.verdict,
      confidence: check.confidence,
      evidence: check.evidence.map((id) => evidenceById[id]).filter(Boolean),
      reasoning: check.reasoning,
      roleId: check.roleId,
      claimType: check.claimType,
      ...(check.category ? { category: check.category } : {}),
      // Reasoning vs. evidence routing (shared with the live swarm via lib/claims.mjs):
      // logic/computation claims are verified by independent re-derivation — external
      // evidence can't corroborate a deduction — while factual claims stay on the
      // evidence path. Mirrors the live fix for correct logic scoring zero confidence.
      verificationMethod: isReasoningClaim(check) ? "independent_re_derivation" : "evidence_check",
      roleWeight: check.roleWeight,
      claimWeight: check.claimWeight,
      supports: check.supports,
      appliesWhen: check.appliesWhen
    };
  });
}

// Verdict polarity for decision scoring: a refuted claim actively counts *against*
// the options it supported (-1), not merely zero — evidence that a claim is wrong is
// information, and discarding it would let refuted reasoning still tilt the decision.
// "unresolved"/unknown verdicts contribute 0: no evidence, no influence either way.
function verdictMultiplier(verdict) {
  if (verdict === "supported") return 1;
  if (verdict === "partially_supported") return 0.5;
  if (verdict === "refuted") return -1;
  return 0;
}

// Weighted decision scoring: each claim's contribution to an option is
//   verdict polarity x verifier confidence x roleWeight x claimWeight x effect.
// - confidence scales influence by how sure the verifier was;
// - roleWeight lets a fixture rank agent roles (e.g. the Operator outweighs the
//   contrarian on operational questions);
// - claimWeight ranks claims within an answer (a goal-defining claim like "washing the
//   car requires the car at the wash" outweighs a passing observation);
// - effect (from the fixture's `supports` map) is the claim's direction for that
//   option: positive favors it, negative opposes it.
// Missing weights default to 1 so simple fixtures don't have to specify them.
function computeDecisionScores(verifiedClaims) {
  const scores = {};

  for (const claim of verifiedClaims) {
    const supports = claim.supports || {};
    const multiplier = verdictMultiplier(claim.verdict);
    const confidence = Number.isFinite(claim.confidence) ? claim.confidence : 0;
    const roleWeight = Number.isFinite(claim.roleWeight) ? claim.roleWeight : 1;
    const claimWeight = Number.isFinite(claim.claimWeight) ? claim.claimWeight : 1;

    for (const [option, effect] of Object.entries(supports)) {
      const numericEffect = Number(effect);
      if (!Number.isFinite(numericEffect)) continue;
      scores[option] = (scores[option] || 0) + multiplier * confidence * roleWeight * claimWeight * numericEffect;
    }
  }

  return Object.fromEntries(
    Object.entries(scores).map(([option, score]) => [option, Number(score.toFixed(2))])
  );
}

// Synthesis preserves uncertainty rather than smoothing it away: the confidence
// summary reports supported/partial/unresolved *counts*, and unresolved claims ride
// along in full so a reviewer can see exactly what was never verified. A fixture may
// pin its own finalAnswer/decisionScores; otherwise scores are computed from claims.
function buildSynthesis(verifiedClaims, fixture) {
  const supported = verifiedClaims.filter((claim) => claim.verdict === "supported");
  const partial = verifiedClaims.filter((claim) => claim.verdict === "partially_supported");
  const unresolved = verifiedClaims.filter((claim) => !["supported", "partially_supported"].includes(claim.verdict));
  const avgConfidence = verifiedClaims.reduce((sum, claim) => sum + claim.confidence, 0) / verifiedClaims.length;
  const fixtureSynthesis = fixture.synthesis || {};
  const decisionScores = fixtureSynthesis.decisionScores || computeDecisionScores(verifiedClaims);

  return {
    finalAnswer: fixtureSynthesis.finalAnswer || [
      "A small team should start with a single strong agent when speed, simplicity, and low coordination cost matter.",
      "For high-stakes research or AI-assisted decisions, The Council pattern is stronger: independent agents answer first, peer critique exposes weak assumptions, a verification swarm checks claims against evidence, and final synthesis preserves unresolved claims instead of hiding them.",
      "The practical recommendation is progressive escalation: use one agent for low-risk work, then trigger a council when the decision needs traceability, disagreement analysis, or an audit trail."
    ].join(" "),
    confidenceSummary: {
      averageConfidence: Number(avgConfidence.toFixed(2)),
      supportedClaims: supported.length,
      partiallySupportedClaims: partial.length,
      unresolvedClaims: unresolved.length
    },
    unresolvedClaims: unresolved,
    ...(Object.keys(decisionScores).length > 0 ? { decisionScores } : {}),
    ...(fixture.scenarioInterpretation ? { scenarioInterpretation: fixture.scenarioInterpretation } : {}),
    ...(fixtureSynthesis.assumptionsAndCaveats ? { assumptionsAndCaveats: fixtureSynthesis.assumptionsAndCaveats } : {})
  };
}

// Entry point: one call runs the whole offline pipeline and returns the full report
// object (the JSON "trajectory" — agents, critiques, verdicts, audit steps), mirroring
// the stage order of the live system so both modes produce the same report shape.
export function runFixtureCouncil(options = {}) {
  const fixturePath = selectFixturePath(options);
  const fixture = loadFixture(fixturePath);
  // Redaction/risk-classification runs on the raw user input *before* it is embedded
  // anywhere in the report — same boundary the live server enforces.
  const question = redactSensitiveText(options.question || fixture.question);
  const inputRisk = classifyInputRisk(options.question || fixture.question);
  const verifiedClaims = verifyClaims(fixture);
  const synthesis = buildSynthesis(verifiedClaims, fixture);
  const fixtureRelPath = path.relative(ROOT, fixturePath).replaceAll("\\", "/");

  return {
    project: "The Council: Multi-Agent Verification Swarm",
    mode: "fixture",
    simulated: true,
    fixture: fixtureRelPath,
    scenarioId: fixture.scenarioId,
    label: fixture.label,
    generatedAt: new Date().toISOString(),
    question,
    inputRisk,
    toolAllowlist: TOOL_ALLOWLIST,
    stages: [
      "independent_council_answers",
      "peer_critique",
      "hidden_verification_swarm",
      "evidence_backed_synthesis",
      "audit_export"
    ],
    agents: fixture.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      roleWeight: agent.roleWeight,
      answer: agent.answer,
      claimIds: agent.claims
    })),
    swarmRoles: fixture.swarmRoles || [],
    scenarioInterpretation: fixture.scenarioInterpretation,
    peerReviews: summarizeDisagreements(fixture.peerReviews),
    verifiedClaims,
    final: synthesis,
    auditTrail: [
      { step: "load_fixture", detail: `Loaded public fixture data from ${fixtureRelPath}.` },
      { step: "redact_input", detail: `Input risk level: ${inputRisk.level}.` },
      { step: "extract_claims", detail: `Loaded ${verifiedClaims.length} fixture claims.` },
      {
        step: "verify_claims_against_fixture",
        detail: (() => {
          const reDerived = verifiedClaims.filter((claim) => claim.verificationMethod === "independent_re_derivation").length;
          return reDerived > 0
            ? `Checked ${verifiedClaims.length - reDerived} claims against local fixture evidence; routed ${reDerived} reasoning claims to independent re-derivation.`
            : "Checked each claim against local fixture evidence.";
        })()
      },
      { step: "write_audit_report", detail: "Report can be exported as JSON and Markdown." }
    ]
  };
}

export function reportToMarkdown(report) {
  const lines = [];
  lines.push("# The Council Fixture Report");
  lines.push("");
  lines.push(`Mode: ${report.mode} (simulated/offline)`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Question");
  lines.push("");
  lines.push(report.question);
  lines.push("");
  if (report.scenarioInterpretation) {
    lines.push("## Scenario Interpretation");
    lines.push("");
    lines.push(`Likely intent: ${report.scenarioInterpretation.likelyIntent}`);
    lines.push(`Primary recommendation: ${report.scenarioInterpretation.primaryRecommendation}`);
    lines.push(`Ambiguity: ${report.scenarioInterpretation.ambiguity}`);
    lines.push("");
  }
  lines.push("## Council Agents");
  for (const agent of report.agents) {
    lines.push(`### ${agent.name}`);
    lines.push("");
    lines.push(`Role: ${agent.role}${agent.roleWeight ? ` (weight: ${agent.roleWeight})` : ""}`);
    lines.push("");
    lines.push(agent.answer);
    lines.push("");
  }
  if (report.swarmRoles?.length) {
    lines.push("## Swarm Roles");
    for (const role of report.swarmRoles) {
      lines.push(`- ${role.name}: ${role.checks}`);
    }
    lines.push("");
  }
  lines.push("## Peer Review");
  for (const review of report.peerReviews) {
    lines.push(`- ${review.reviewer} -> ${review.target}: ${review.score}/100. Strength: ${review.strength} Weakness: ${review.weakness}`);
  }
  lines.push("");
  lines.push("## Verified Claims");
  for (const claim of report.verifiedClaims) {
    const weights = claim.roleWeight || claim.claimWeight
      ? ` role weight ${claim.roleWeight ?? 1}, claim weight ${claim.claimWeight ?? 1}`
      : "";
    const method = claim.verificationMethod === "independent_re_derivation" ? " [re-derived independently]" : "";
    lines.push(`- ${claim.id}: ${claim.verdict} (${Math.round(claim.confidence * 100)}%)${weights}${method} - ${claim.text}`);
  }
  lines.push("");
  if (report.final.decisionScores) {
    lines.push("## Decision Scores");
    for (const [option, score] of Object.entries(report.final.decisionScores)) {
      lines.push(`- ${option}: ${score}`);
    }
    lines.push("");
  }
  lines.push("## Final Synthesis");
  lines.push("");
  lines.push(report.final.finalAnswer);
  lines.push("");
  if (report.final.assumptionsAndCaveats?.length) {
    lines.push("## Assumptions And Caveats");
    for (const caveat of report.final.assumptionsAndCaveats) {
      lines.push(`- ${caveat}`);
    }
    lines.push("");
  }
  lines.push("## Audit Trail");
  for (const item of report.auditTrail) {
    lines.push(`- ${item.step}: ${item.detail}`);
  }
  lines.push("");
  return lines.join("\n");
}

// Reports are written atomically (temp file + rename, see ops.mjs) so a crash mid-write
// can never leave a torn half-report — the committed sample_outputs stay diffable.
export function writeReport(report, outputDir = path.join(ROOT, "sample_outputs")) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "latest_fixture_report.json");
  const mdPath = path.join(outputDir, "latest_fixture_report.md");
  writeTextAtomic(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeTextAtomic(mdPath, reportToMarkdown(report));
  return { jsonPath, mdPath };
}

export function listDemoQuestions() {
  const fixture = loadFixture();
  return [
    fixture.question,
    ...SCENARIO_FIXTURES.map((item) => loadFixture(item.fixturePath).question),
    ...DEFAULT_ALTERNATE_QUESTIONS
  ];
}

export { ROOT };
