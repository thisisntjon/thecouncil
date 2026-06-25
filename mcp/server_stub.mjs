#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import { listDemoQuestions, runFixtureCouncil, ROOT } from "../lib/fixtureCouncil.mjs";

let latestReport = null;

const tools = [
  {
    name: "list_demo_questions",
    description: "List public-safe fixture questions for The Council demo.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "run_fixture_council",
    description: "Run the offline fixture Council pipeline with no provider calls.",
    inputSchema: { type: "object", properties: { question: { type: "string" } } }
  },
  {
    name: "get_latest_report",
    description: "Return the latest fixture report produced by this MCP stub process.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_verified_claims",
    description: "Return verified claims from the latest report or a fresh fixture run.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_architecture_summary",
    description: "Return a concise architecture summary for the capstone.",
    inputSchema: { type: "object", properties: {} }
  }
];

function jsonResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function jsonError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

function callTool(name, args = {}) {
  if (name === "list_demo_questions") return { questions: listDemoQuestions() };
  if (name === "run_fixture_council") {
    latestReport = runFixtureCouncil({ question: args.question });
    return latestReport;
  }
  if (name === "get_latest_report") {
    latestReport ||= runFixtureCouncil();
    return latestReport;
  }
  if (name === "list_verified_claims") {
    latestReport ||= runFixtureCouncil();
    return { verifiedClaims: latestReport.verifiedClaims };
  }
  if (name === "get_architecture_summary") {
    return {
      summary: "Visible Council agents answer independently, peer reviewers critique, a hidden verification swarm checks fixture claims, and a synthesis stage exports an audit trail.",
      docs: ["ARCHITECTURE.md", "docs/architecture.mmd"],
      root: ROOT
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}

if (process.argv.includes("--self-test")) {
  latestReport = runFixtureCouncil();
  fs.writeSync(1, `${JSON.stringify({ ok: true, tools: tools.map((tool) => tool.name), claims: latestReport.verifiedClaims.length })}\n`);
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    jsonError(null, -32700, "Expected one JSON-RPC message per line.");
    return;
  }

  try {
    if (msg.method === "initialize") {
      jsonResult(msg.id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "the-council-fixture-stub", version: "1.0.0" },
        capabilities: { tools: {} }
      });
    } else if (msg.method === "tools/list") {
      jsonResult(msg.id, { tools });
    } else if (msg.method === "tools/call") {
      const name = msg.params?.name;
      const args = msg.params?.arguments || {};
      const result = callTool(name, args);
      jsonResult(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } else if (msg.method === "resources/list") {
      jsonResult(msg.id, { resources: [] });
    } else if (msg.method === "shutdown") {
      jsonResult(msg.id, {});
      process.exit(0);
    } else {
      jsonError(msg.id, -32601, `Unsupported method: ${msg.method}`);
    }
  } catch (error) {
    jsonError(msg.id, -32000, error.message);
  }
});
