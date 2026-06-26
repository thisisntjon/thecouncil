# Video Shot List

Target length: under 5 minutes.

1. Cover/title
   - Use `screenshots/cover.html`.
   - Say the one-sentence pitch.

2. Architecture
   - Use `screenshots/architecture.html`.
   - Point out independent agents, peer critique, hidden verification, and audit export.

3. Fixture demo command
   - Run `npm run demo:fixture`.
   - Show that the mode is fixture/offline/simulated.

4. Report outputs
   - Show `sample_outputs/latest_fixture_report.md`.
   - Highlight four agents, 12 verified claims, confidence summary, and final synthesis.

5. Security and reproducibility
   - Run or mention `npm test`, `npm run secret:scan`, and `npm run mcp:self-test`.
   - Show `SECURITY_AND_PRIVACY.md` briefly.

6. Close
   - State the limitation: fixture mode demonstrates architecture, not live model quality.
   - Use one short course-concepts line: The Council demonstrates multi-agent role separation, tool boundaries, security, reproducibility, agent skills, and auditability.
   - Mention next steps only if there is time: official MCP SDK server, richer evidence sets, one-click fixture UI.
