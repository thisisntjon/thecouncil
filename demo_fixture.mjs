#!/usr/bin/env node
import { runFixtureCouncil, writeReport } from "./lib/fixtureCouncil.mjs";

const args = process.argv.slice(2);
const question = args.length > 0 ? args.join(" ") : undefined;
const report = runFixtureCouncil({ question });
const outputs = writeReport(report);

console.log("The Council fixture demo completed.");
console.log("Mode: fixture/offline/simulated");
console.log(`Question: ${report.question}`);
console.log(`Agents: ${report.agents.length}`);
console.log(`Verified claims: ${report.verifiedClaims.length}`);
console.log(`Average confidence: ${report.final.confidenceSummary.averageConfidence}`);
console.log(`JSON report: ${outputs.jsonPath}`);
console.log(`Markdown report: ${outputs.mdPath}`);
console.log("");
console.log("Final synthesis:");
console.log(report.final.finalAnswer);
