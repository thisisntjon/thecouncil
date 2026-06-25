# Course Concepts

## 1. Agent / Multi-Agent System

- Code: `fixtures/council_fixture.json`, `lib/fixtureCouncil.mjs`, existing `client/src/App.jsx`, existing `server/index.js`
- Video: show four Council agents, peer critique, hidden verification swarm, final synthesis
- Docs: `README.md`, `CAPSTONE.md`, `ARCHITECTURE.md`

## 2. MCP Server or MCP Stub

- Code: `mcp/server_stub.mjs`
- Video: show `npm run mcp:self-test` or `node mcp/server_stub.mjs --self-test`
- Docs: `mcp/README.md`, `ARCHITECTURE.md`
- Boundary: this is a small read-only MCP-style stub, not a production MCP SDK server

## 3. Security Features

- Code: `.gitignore`, `.env.example`, `lib/security.mjs`, `scripts/secret_scan.mjs`
- Video: show fixture mode and secret scan
- Docs: `SECURITY_AND_PRIVACY.md`, `RELEASE_CHECKLIST.md`, `README.md`
- Boundary: fixture mode is the public path; live provider mode is optional and disabled by default

## 4. Deployability

- Code: root `package.json` scripts
- Video: run `npm run demo:fixture`
- Docs: `DEMO_GUIDE.md`, `README.md`

## 5. Agent Skills / Reusable Agent Capabilities

- Code: `skills/council-verification/SKILL.md`
- Video: show the skill workflow briefly
- Docs: `README.md`, `CAPSTONE.md`, this file

## Extra Concept: Evaluation and Audit Trail

- Code: `lib/fixtureCouncil.mjs`, `sample_outputs/latest_fixture_report.json`
- Video: show verified claims and confidence summary
- Docs: `KAGGLE_WRITEUP_DRAFT.md`, `ARCHITECTURE.md`
- Output: JSON/Markdown reports preserve agent answers, peer critiques, verified claims, confidence, unresolved claims, and final synthesis
