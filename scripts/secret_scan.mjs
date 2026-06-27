#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());
const ignoredDirs = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", "dist", "build"]);
const riskyName = /(^\.env($|\.)|credential|credentials|secret|token|password|private|\.pem$|\.key$|\.db$|\.sqlite$|\.log$)/i;
const allowedNames = new Set([".env.example"]);
const allowedPaths = new Set(["scripts/secret_scan.mjs"]);

function candidateFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    return output.split("\0").filter(Boolean);
  } catch (err) {
    console.warn(`Secret scan: git listing unavailable (${err.message}); falling back to filesystem walk.`);
    return walk(ROOT);
  }
}

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

const hits = candidateFiles().filter((rel) => {
  const normalized = rel.replaceAll("\\", "/");
  const name = path.basename(normalized);
  return riskyName.test(name) && !allowedNames.has(name) && !allowedPaths.has(normalized);
});
if (hits.length > 0) {
  console.error("Risky tracked or unignored files found by filename/category only:");
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}

console.log("Secret scan passed: no risky tracked or unignored filenames found.");
