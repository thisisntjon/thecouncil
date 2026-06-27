#!/usr/bin/env node
// Offline fixture demo for The Council. Runs the deterministic fixture council
// and writes a JSON + Markdown audit report. No API keys or network required.
import { runFixtureCouncil, writeReport } from "./lib/fixtureCouncil.mjs";
import { makeRunId, EXIT } from "./lib/ops.mjs";

const HELP = `The Council — offline fixture demo

Usage: node demo_fixture.mjs [options] [question words...]
       npm run demo:fixture -- [options] "question"

Options:
  --output DIR     Write the report to DIR instead of sample_outputs/
  --dry-run        Run the council but write no files (preview only)
  --json           Emit a machine-readable JSON summary (and JSON errors) on stdout
  -h, --help       Show this help

With no question, the default fixture question is used. Exit codes: 0 ok, 2 usage, 1 error.
`;

function parseArgs(argv) {
  const opts = { output: undefined, dryRun: false, json: false, help: false, words: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--output") {
      if (i + 1 >= argv.length) { const e = new Error("--output requires a directory"); e.exitCode = EXIT.USAGE; throw e; }
      opts.output = argv[i + 1]; i += 1;
    } else if (arg.startsWith("--")) {
      const e = new Error(`unknown option: ${arg}`); e.exitCode = EXIT.USAGE; throw e;
    } else {
      opts.words.push(arg);
    }
  }
  return opts;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    process.exit(EXIT.OK);
  }

  const runId = makeRunId();
  const question = opts.words.length > 0 ? opts.words.join(" ") : undefined;
  const report = runFixtureCouncil({ question });

  let outputs = null;
  if (opts.dryRun) {
    if (!opts.json) console.log("[DRY-RUN] no files written.");
  } else {
    outputs = opts.output ? writeReport(report, opts.output) : writeReport(report);
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({
      runId,
      mode: "fixture",
      dryRun: opts.dryRun,
      question: report.question,
      agents: report.agents.length,
      verifiedClaims: report.verifiedClaims.length,
      averageConfidence: report.final.confidenceSummary.averageConfidence,
      outputs
    }, null, 2)}\n`);
  } else {
    console.log("The Council fixture demo completed.");
    console.log("Mode: fixture/offline/simulated");
    console.log(`Run ID: ${runId}`);
    console.log(`Question: ${report.question}`);
    console.log(`Agents: ${report.agents.length}`);
    console.log(`Verified claims: ${report.verifiedClaims.length}`);
    console.log(`Average confidence: ${report.final.confidenceSummary.averageConfidence}`);
    if (outputs) {
      console.log(`JSON report: ${outputs.jsonPath}`);
      console.log(`Markdown report: ${outputs.mdPath}`);
    }
    console.log("");
    console.log("Final synthesis:");
    console.log(report.final.finalAnswer);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json")) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  } else {
    console.error("The Council fixture demo failed.");
    console.error(message);
  }
  process.exit(error?.exitCode || 1);
}
