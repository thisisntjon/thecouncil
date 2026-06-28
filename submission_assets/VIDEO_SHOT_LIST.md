# Video Shot List

Target length: under 5 minutes. Track: Freestyle.

1. Cover/title
   - Use `screenshots/cover.html`.
   - Say the one-sentence pitch.

2. Architecture
   - Use `screenshots/architecture.html`.
   - Point out independent agents, peer critique, hidden cross-vendor verification, and audit export.
   - One line: "live mode is what you'll see; it's also fully reproducible offline with no keys."

3. Live demo (the centerpiece) — drive the React UI (Tailwind + shadcn/ui)
   - Ask a real question; show all four models streaming their answers + reasoning.
   - "Convene the Council" → peer evaluation + consensus score.
   - Round 3: the parallel cross-vendor verification swarm — verdict badges, confidence bars,
     "verified by {vendor}" tags; call out that it even refutes weak claims from the winner.
   - Land on the final verdict.

4. Reproducible offline (no keys)
   - Run `npm run demo:fixture`.
   - Show four agents, 12 verified claims, confidence summary, and
     `sample_outputs/latest_fixture_report.{md,json}`.
   - Say: "live mode needs your own keys; fixture mode reproduces the architecture with none — that's the path in the public repo."

5. Security and reproducibility
   - Run or mention `npm test`, `npm run secret:scan`, and `npm run mcp:self-test`.
   - Show `SECURITY_AND_PRIVACY.md` briefly.

6. Close
   - Limitation: fixture mode demonstrates architecture, not live model quality; MCP is a stub, not a production SDK server.
   - One course-concepts line: multi-agent role separation, tool boundaries, security, reproducibility, agent skills, and auditability.
