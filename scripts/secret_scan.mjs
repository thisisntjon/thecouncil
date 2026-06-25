#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const ignoredDirs = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", "dist", "build"]);
const riskyName = /(^\.env($|\.)|credential|credentials|secret|token|password|private|\.pem$|\.key$|\.db$|\.sqlite$|\.log$)/i;
const allowedNames = new Set([".env.example"]);
const allowedPaths = new Set(["scripts/secret_scan.mjs"]);

function walk(dir, hits = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
    } else {
      const rel = path.relative(ROOT, full).replaceAll("\\", "/");
      if (riskyName.test(entry.name) && !allowedNames.has(entry.name) && !allowedPaths.has(rel)) {
        hits.push(rel);
      }
    }
  }
  return hits;
}

const hits = walk(ROOT);
if (hits.length > 0) {
  console.error("Risky files found by filename/category only:");
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}

console.log("Secret scan passed: no risky committed filenames found.");
