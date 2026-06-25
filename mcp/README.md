# MCP Stub

This folder contains a small read-only MCP-style stub for the capstone demo.

It is dependency-free and fixture-only. It does not call live model providers, search APIs, private files, or the network.

## Run

```bash
npm run mcp:stub
```

The stub accepts one JSON-RPC message per line over stdio. It implements:

- `initialize`
- `tools/list`
- `tools/call`
- `shutdown`

## Tools

- `list_demo_questions`
- `run_fixture_council`
- `get_latest_report`
- `list_verified_claims`
- `get_architecture_summary`

## Self-Test

```bash
npm run mcp:self-test
```

Direct equivalent:

```bash
node mcp/server_stub.mjs --self-test
```

This is a public-safe MCP interface sketch for the Kaggle/Google AI Agents capstone. A production MCP server should use the official MCP SDK framing and transport.
