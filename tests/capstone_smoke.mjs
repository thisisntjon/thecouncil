#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFixtureCouncil, writeReport, ROOT } from "../lib/fixtureCouncil.mjs";

const report = runFixtureCouncil();
assert.equal(report.mode, "fixture");
assert.equal(report.simulated, true);
assert.equal(report.agents.length, 4);
assert.ok(report.verifiedClaims.length >= 10);
assert.ok(report.final.finalAnswer.includes("single strong agent"));

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "council-fixture-"));
const outputs = writeReport(report, tempDir);
assert.ok(fs.existsSync(outputs.jsonPath));
assert.ok(fs.existsSync(outputs.mdPath));

for (const required of [
  "README.md",
  "CAPSTONE.md",
  "KAGGLE_WRITEUP_DRAFT.md",
  "VIDEO_SCRIPT.md",
  "ARCHITECTURE.md",
  "COURSE_CONCEPTS.md",
  "SECURITY_AND_PRIVACY.md",
  "DEMO_GUIDE.md",
  "RELEASE_CHECKLIST.md",
  "LICENSE_REVIEW.md",
  "docs/architecture.mmd",
  "docs/demo-flow.md",
  "skills/council-verification/SKILL.md",
  "mcp/README.md",
  "mcp/server_stub.mjs"
]) {
  assert.ok(fs.existsSync(path.join(ROOT, required)), `missing ${required}`);
}

function walk(dir, hits = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".venv", "venv", "__pycache__", ".pytest_cache", "dist", "build"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, hits);
    else if (/^\.env($|\.)/i.test(entry.name) && entry.name !== ".env.example") hits.push(path.relative(ROOT, full));
  }
  return hits;
}

assert.deepEqual(walk(ROOT), []);
console.log("Capstone smoke tests passed.");
