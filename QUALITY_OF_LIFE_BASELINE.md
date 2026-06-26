# Quality of Life Baseline

This public-safe checklist maps the capstone demo to a practical operational-readiness baseline. The goal is not to turn the project into a production platform; it is to show that the official fixture path is easy to run, safe to interrupt, reproducible, and auditable.

## Scope

Execution model: small Node.js fixture CLI plus preserved optional app surfaces.

Tier: Standard for the fixture demo, Heavy features considered but mostly documented or out of scope.

Official path:

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

## Checklist

| # | Feature | Verdict | Project status |
| --- | --- | --- | --- |
| 1 | Robust error handling | Implemented lightly | `demo_fixture.mjs` reports fixture failures clearly and exits non-zero. |
| 2 | Preflight validation | Documented | README and release docs call out dependency install and validation commands. |
| 3 | Structured logging | Not applicable | The public demo is a short CLI run; human console output plus JSON report is enough. |
| 4 | Clear status summaries | Implemented | Demo prints mode, question, agent count, verified claim count, confidence, and output paths. |
| 5 | Graceful cancellation | Documented | The demo writes reports atomically; long-running provider workflows are not part of the public path. |
| 6 | Timeout controls | Not applicable | Fixture mode makes no network calls or unbounded waits. |
| 7 | Retries with backoff | Not applicable | Fixture mode is deterministic local work; live provider retries remain out of scope for the public demo. |
| 8 | Config/env support | Implemented | `.env.example` exists for optional live mode; fixture mode needs no keys. |
| 9 | Dry-run / preview mode | Not applicable | Fixture mode is already a safe simulated run that only writes local reports. |
| 10 | Idempotency safeguards | Implemented | Re-running overwrites stable `latest_fixture_report.*` files; writes are atomic. |
| 11 | Machine-readable output | Implemented | JSON report is generated under `sample_outputs/`. |
| 12 | Test/sample mode | Implemented | Fixture mode is the sample/test mode and is documented as the official public path. |
| 13 | Progress indicators | Not applicable | The fixture demo completes quickly; no spinner or progress UI is needed. |
| 14 | Checkpoints | Not applicable | The public demo is short and deterministic. |
| 15 | Resume support | Not applicable | No long-running public workload exists to resume. |
| 16 | Rate-limit awareness | Not applicable | Fixture mode avoids provider APIs and rate limits. |
| 17 | Batching controls | Not applicable | Public demo uses one deterministic fixture. |
| 18 | ETA/throughput metrics | Not applicable | Runtime is short and workload size is fixed. |
| 19 | Audit trail | Implemented | Reports include stages, verified claims, confidence summary, unresolved claims, and audit trail. |
| 20 | Fallback strategies | Implemented | No-key fixture mode is the safe fallback and primary public demo path. |
| 21 | Profiling hooks | Not applicable | Performance is not a submission risk for the fixture demo. |
| 22 | Parallelization | Not applicable | The fixture run is small; parallelism would add complexity without benefit. |

## Safety Notes

- Live-provider mode remains optional and disabled by default.
- The MCP surface is a read-only fixture stub, not a production MCP SDK server.
- The secret scan reports only risky path/category matches and does not print secret values.
- Private research notes belong only under `_private_course_alignment/`, which is ignored by Git.
