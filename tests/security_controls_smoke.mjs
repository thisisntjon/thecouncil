#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { ROOT } from "../lib/fixtureCouncil.mjs";

const COUNCIL_TOKEN = "test-council-token";
const SHADOW_TOKEN = "test-shadow-token";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startNode(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.output = "";
  child.stdout.on("data", (chunk) => { child.output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { child.output += chunk.toString(); });
  return child;
}

async function stop(child) {
  if (!child || child.killed) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

async function waitForHealth(url, child) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 8000) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with ${child.exitCode}\n${child.output}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${url}: ${lastError?.message || "no response"}\n${child.output}`);
}

async function postJson(url, body, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

async function withCouncilServer(testFn) {
  const port = await freePort();
  const child = startNode(["server/index.js"], {
    PORT: String(port),
    COUNCIL_HOST: "127.0.0.1",
    COUNCIL_API_TOKEN: COUNCIL_TOKEN,
    SHADOW_COUNCIL_TOKEN: SHADOW_TOKEN,
    SHADOW_COUNCIL_URL: "http://127.0.0.1:65535"
  });
  try {
    await waitForHealth(`http://127.0.0.1:${port}/api/health`, child);
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await stop(child);
  }
}

async function withShadowServer(testFn) {
  const port = await freePort();
  const child = startNode(["shadow-council/index.js"], {
    SHADOW_PORT: String(port),
    SHADOW_HOST: "127.0.0.1",
    SHADOW_COUNCIL_TOKEN: SHADOW_TOKEN
  });
  try {
    await waitForHealth(`http://127.0.0.1:${port}/api/health`, child);
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await stop(child);
  }
}

await withCouncilServer(async (base) => {
  const fixture = await postJson(`${base}/api/fixture/run`, { question: "I want to wash my car. The car wash is 50 meters away. Should I walk or drive?" });
  assert.equal(fixture.status, 200, "offline fixture route should remain public");

  const noAuthConfig = await postJson(`${base}/api/config`, { models: { claude: "claude-sonnet-4-6" } });
  assert.equal(noAuthConfig.status, 401, "live config route must reject missing auth");

  const authConfig = await postJson(`${base}/api/config`, { models: { claude: "claude-sonnet-4-6" } }, COUNCIL_TOKEN);
  assert.equal(authConfig.status, 200, "live config route should accept the local bearer token");

  const noAuthAsk = await postJson(`${base}/api/ask`, { question: "Will this spend keys?", models: [] });
  assert.equal(noAuthAsk.status, 401, "provider-backed ask route must reject missing auth before streaming");
});

await withShadowServer(async (base) => {
  const noAuthVerify = await postJson(`${base}/api/verify`, {
    question_number: 1,
    question: "Will this spend keys?",
    answers: []
  });
  assert.equal(noAuthVerify.status, 401, "Shadow verification route must reject missing auth");

  const authConfig = await postJson(`${base}/api/config`, { model: "claude-sonnet-4-6" }, SHADOW_TOKEN);
  assert.equal(authConfig.status, 200, "Shadow config should accept the shared local bearer token");
});

const dashboard = fs.readFileSync(path.join(ROOT, "shadow-council", "dashboard.html"), "utf8");
assert.match(dashboard, /function escapeHtml/);
assert.match(dashboard, /function safeUrl/);
assert.ok(!dashboard.includes("${q.question}"), "question text must not be interpolated into HTML without escaping");
assert.ok(!dashboard.includes("${q.synthesis.answer}"), "synthesis text must not be interpolated into HTML without escaping");
assert.ok(!dashboard.includes("${claim.text}"), "claim text must not be interpolated into HTML without escaping");
assert.ok(!dashboard.includes("${v.reasoning}"), "verification reasoning must not be interpolated into HTML without escaping");

console.log("Security controls smoke tests passed.");
