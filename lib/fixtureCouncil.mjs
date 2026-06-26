import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyInputRisk, redactSensitiveText, TOOL_ALLOWLIST } from "./security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FIXTURE = path.join(ROOT, "fixtures", "council_fixture.json");

export function loadFixture(fixturePath = DEFAULT_FIXTURE) {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
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
      reasoning: check.reasoning
    };
  });
}

function buildSynthesis(verifiedClaims) {
  const supported = verifiedClaims.filter((claim) => claim.verdict === "supported");
  const partial = verifiedClaims.filter((claim) => claim.verdict === "partially_supported");
  const unresolved = verifiedClaims.filter((claim) => !["supported", "partially_supported"].includes(claim.verdict));
  const avgConfidence = verifiedClaims.reduce((sum, claim) => sum + claim.confidence, 0) / verifiedClaims.length;

  return {
    finalAnswer: [
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
    unresolvedClaims: unresolved
  };
}

export function runFixtureCouncil(options = {}) {
  const fixture = loadFixture(options.fixturePath);
  const question = redactSensitiveText(options.question || fixture.question);
  const inputRisk = classifyInputRisk(options.question || fixture.question);
  const verifiedClaims = verifyClaims(fixture);
  const synthesis = buildSynthesis(verifiedClaims);

  return {
    project: "The Council: Multi-Agent Verification Swarm",
    mode: "fixture",
    simulated: true,
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
      answer: agent.answer,
      claimIds: agent.claims
    })),
    peerReviews: summarizeDisagreements(fixture.peerReviews),
    verifiedClaims,
    final: synthesis,
    auditTrail: [
      { step: "load_fixture", detail: "Loaded public fixture data from fixtures/council_fixture.json." },
      { step: "redact_input", detail: `Input risk level: ${inputRisk.level}.` },
      { step: "extract_claims", detail: `Loaded ${verifiedClaims.length} fixture claims.` },
      { step: "verify_claims_against_fixture", detail: "Checked each claim against local fixture evidence." },
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
  lines.push("## Council Agents");
  for (const agent of report.agents) {
    lines.push(`### ${agent.name}`);
    lines.push("");
    lines.push(`Role: ${agent.role}`);
    lines.push("");
    lines.push(agent.answer);
    lines.push("");
  }
  lines.push("## Peer Review");
  for (const review of report.peerReviews) {
    lines.push(`- ${review.reviewer} -> ${review.target}: ${review.score}/100. Strength: ${review.strength} Weakness: ${review.weakness}`);
  }
  lines.push("");
  lines.push("## Verified Claims");
  for (const claim of report.verifiedClaims) {
    lines.push(`- ${claim.id}: ${claim.verdict} (${Math.round(claim.confidence * 100)}%) - ${claim.text}`);
  }
  lines.push("");
  lines.push("## Final Synthesis");
  lines.push("");
  lines.push(report.final.finalAnswer);
  lines.push("");
  lines.push("## Audit Trail");
  for (const item of report.auditTrail) {
    lines.push(`- ${item.step}: ${item.detail}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function writeReport(report, outputDir = path.join(ROOT, "sample_outputs")) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "latest_fixture_report.json");
  const mdPath = path.join(outputDir, "latest_fixture_report.md");
  writeTextAtomic(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeTextAtomic(mdPath, reportToMarkdown(report));
  return { jsonPath, mdPath };
}

function writeTextAtomic(targetPath, contents) {
  const tempPath = `${targetPath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, targetPath);
}

export function listDemoQuestions() {
  const fixture = loadFixture();
  return [
    fixture.question,
    "Should a small team use a single powerful AI agent or a council of specialized agents for high-stakes research?"
  ];
}

export { ROOT };
