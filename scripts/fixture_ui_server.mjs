#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { listDemoQuestions, runFixtureCouncil, writeReport } from "../lib/fixtureCouncil.mjs";
import { onCancel, EXIT } from "../lib/ops.mjs";

const DEFAULT_PORT = 4173;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(html);
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Expected JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function reportStats(report) {
  const summary = report.final.confidenceSummary;
  return {
    agents: report.agents.length,
    claims: report.verifiedClaims.length,
    supported: summary.supportedClaims,
    partial: summary.partiallySupportedClaims,
    unresolved: summary.unresolvedClaims,
    confidence: summary.averageConfidence
  };
}

function publicReport(report) {
  return {
    ...report,
    stats: reportStats(report),
    reportPaths: {
      json: "sample_outputs/latest_fixture_report.json",
      markdown: "sample_outputs/latest_fixture_report.md"
    }
  };
}

export function buildFixtureUiHtml() {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Council - Fixture UI</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7fb;
      --surface: #ffffff;
      --surface-muted: #f0f3f7;
      --border: #d8dee8;
      --text: #172033;
      --muted: #657187;
      --blue: #2556a3;
      --green: #16835c;
      --amber: #9c6b12;
      --red: #b13a30;
      --shadow: 0 16px 40px rgba(23, 32, 51, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    button, textarea, select { font: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px 20px 56px; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 50px); line-height: 1; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 21px; }
    h3 { margin: 0 0 8px; font-size: 16px; }
    p { margin: 0; }
    .subtitle { max-width: 760px; margin-top: 12px; color: var(--muted); font-size: 17px; }
    .badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .badge {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 999px;
      padding: 7px 11px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .status {
      min-width: 210px;
      border: 1px solid #c9d8f0;
      background: #eef5ff;
      color: var(--blue);
      border-radius: 8px;
      padding: 12px 14px;
      font-weight: 700;
      text-align: center;
    }
    .grid { display: grid; gap: 16px; }
    .two { grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); align-items: start; }
    .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      box-shadow: var(--shadow);
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .scenario-list { display: grid; gap: 8px; margin-top: 12px; }
    .scenario-button {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 8px;
      padding: 11px 12px;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .scenario-button:hover, .scenario-button.active { border-color: var(--blue); background: #f4f8ff; }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      color: var(--text);
      background: #fff;
    }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; align-items: center; }
    .primary {
      border: 1px solid var(--blue);
      background: var(--blue);
      color: #fff;
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: 700;
    }
    .secondary {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .metric { border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #fbfcfe; }
    .metric strong { display: block; font-size: 28px; line-height: 1.1; }
    .metric span { color: var(--muted); font-size: 13px; }
    .pipeline { display: grid; gap: 10px; }
    .stage {
      display: grid;
      grid-template-columns: 30px 1fr;
      gap: 10px;
      align-items: start;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 11px;
      background: #fbfcfe;
    }
    .stage-number {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #e4edfb;
      color: var(--blue);
      font-weight: 800;
      font-size: 13px;
    }
    .muted { color: var(--muted); }
    .answer { margin-top: 8px; color: #2d374d; }
    .claims { display: grid; gap: 10px; }
    .claim {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfe;
    }
    .claim-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .verdict {
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 14px;
      font-weight: 800;
      white-space: nowrap;
      border: 1px solid transparent;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .supported { color: var(--green); background: #ecf8f2; border-color: #bce8d2; }
    .partially_supported { color: var(--amber); background: #fff7e8; border-color: #ecd196; }
    .unresolved, .refuted { color: var(--red); background: #fff0ef; border-color: #efbbb5; }
    .evidence { margin: 8px 0 0; padding: 8px 10px; background: #f5f8fc; border-left: 3px solid var(--blue); border-radius: 4px; }
    .evidence-title { font-weight: 700; font-size: 13px; color: #13203a; }
    .evidence-summary { font-size: 13px; color: #2d374d; margin-top: 2px; }
    .peer { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #fbfcfe; }
    .peer-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .peer-score { font-size: 20px; font-weight: 800; color: var(--blue); }
    .peer-revise { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
    .peer-revise.yes { color: var(--amber); background: #fff7e8; border: 1px solid #ecd196; }
    .peer-revise.no { color: var(--green); background: #ecf8f2; border: 1px solid #bce8d2; }
    .score-row { display: grid; grid-template-columns: 140px 1fr 54px; gap: 10px; align-items: center; margin-top: 10px; }
    .bar { height: 10px; border-radius: 999px; background: var(--surface-muted); overflow: hidden; }
    .bar > span { display: block; height: 100%; background: var(--blue); border-radius: 999px; }
    .synthesis {
      font-size: 20px;
      line-height: 1.5;
      color: #13203a;
      background: #eef4fc;
      border: 1px solid #d9e3f2;
      border-left: 6px solid var(--blue);
      border-radius: 8px;
      padding: 18px;
    }
    .list { margin: 0; padding-left: 18px; }
    .list li { margin: 6px 0; }
    .footer-note { margin-top: 24px; color: var(--muted); font-size: 13px; }
    .error { color: var(--red); font-weight: 700; }
    @media (max-width: 880px) {
      .topbar, .two { grid-template-columns: 1fr; display: grid; }
      .three, .four { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .shell { padding: 20px 12px 40px; }
      .three, .four { grid-template-columns: 1fr; }
      .score-row { grid-template-columns: 1fr; }
      .status { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div>
        <h1>The Council</h1>
        <p class="subtitle">Offline fixture UI for a multi-agent verification capstone. It runs the public-safe evaluator, shows role-separated agents, verifies claims against fixture evidence, and exports an audit trail without API keys.</p>
        <div class="badge-row">
          <span class="badge">fixture/offline</span>
          <span class="badge">simulated public data</span>
          <span class="badge">no provider keys</span>
          <span class="badge">audit-oriented</span>
        </div>
      </div>
      <div id="runStatus" class="status">Ready</div>
    </header>

    <section class="grid two">
      <div class="card">
        <h2>Run A Public Scenario</h2>
        <p class="muted">Choose one of the supported offline fixture scenarios. For arbitrary live questions, use the optional live provider UI (launch.bat ui-live), which requires provider keys.</p>
        <div id="scenarioList" class="scenario-list"></div>
      </div>
      <div class="card">
        <h2>Question</h2>
        <textarea id="questionInput" aria-label="Question"></textarea>
        <div class="actions">
          <button id="runButton" class="primary" type="button">Run Fixture Evaluation</button>
          <a class="secondary" href="/api/health" target="_blank" rel="noreferrer">Health</a>
        </div>
        <p id="message" class="footer-note"></p>
      </div>
    </section>

    <section id="results" class="grid" style="margin-top: 16px;"></section>
  </div>

  <script>
    const scenarioList = document.getElementById('scenarioList');
    const questionInput = document.getElementById('questionInput');
    const runButton = document.getElementById('runButton');
    const runStatus = document.getElementById('runStatus');
    const message = document.getElementById('message');
    const results = document.getElementById('results');
    let questions = [];

    const stageLabels = {
      independent_council_answers: 'Independent Council answers',
      peer_critique: 'Peer critique',
      hidden_verification_swarm: 'Hidden verification swarm',
      evidence_backed_synthesis: 'Evidence-backed synthesis',
      audit_export: 'Audit export'
    };

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
    }

    function pct(value) {
      return Math.round(Number(value || 0) * 100);
    }

    function scoreWidth(score, scores) {
      const values = Object.values(scores || {}).map(Number).filter(Number.isFinite);
      const max = Math.max(1, ...values.map((value) => Math.abs(value)));
      return Math.max(4, Math.round((Math.abs(Number(score) || 0) / max) * 100));
    }

    function setStatus(text) {
      runStatus.textContent = text;
    }

    function renderQuestions() {
      scenarioList.innerHTML = questions.map((question, index) => (
        '<button type="button" class="scenario-button" data-index="' + index + '">' +
        escapeHtml(question) +
        '</button>'
      )).join('');
      scenarioList.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          questionInput.value = questions[Number(button.dataset.index)];
          scenarioList.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
        });
      });
      if (questions[0]) {
        questionInput.value = questions[0];
        const first = scenarioList.querySelector('button');
        if (first) first.classList.add('active');
      }
    }

    function renderReport(report) {
      const stats = report.stats || {};
      const summary = report.final.confidenceSummary || {};
      const scores = report.final.decisionScores || {};
      const caveats = report.final.assumptionsAndCaveats || [];
      const unresolved = report.final.unresolvedClaims || [];
      const sections = [];

      sections.push(
        '<section class="grid four">' +
          '<div class="metric"><strong>' + escapeHtml(stats.agents) + '</strong><span>Council agents</span></div>' +
          '<div class="metric"><strong>' + escapeHtml(stats.claims) + '</strong><span>Claims checked</span></div>' +
          '<div class="metric"><strong>' + pct(summary.averageConfidence) + '%</strong><span>Average confidence</span></div>' +
          '<div class="metric"><strong>' + escapeHtml(summary.unresolvedClaims || 0) + '</strong><span>Unresolved claims</span></div>' +
        '</section>'
      );

      const pipeline = (report.stages || []).map((stage, index) => (
        '<div class="stage">' +
          '<div class="stage-number">' + (index + 1) + '</div>' +
          '<div><strong>' + escapeHtml(stageLabels[stage] || stage) + '</strong>' +
          '<p class="muted">' + escapeHtml(stage) + '</p></div>' +
        '</div>'
      )).join('');

      const scoreRows = Object.entries(scores).map(([option, score]) => (
        '<div class="score-row">' +
          '<strong>' + escapeHtml(option) + '</strong>' +
          '<div class="bar"><span style="width: ' + scoreWidth(score, scores) + '%"></span></div>' +
          '<span>' + escapeHtml(score) + '</span>' +
        '</div>'
      )).join('');

      sections.push(
        '<section class="grid two">' +
          '<div class="card"><h2>Evaluation Pipeline</h2><div class="pipeline">' + pipeline + '</div></div>' +
          '<div class="card"><h2>Final Synthesis</h2><div class="synthesis">' + escapeHtml(report.final.finalAnswer) + '</div>' +
          (scoreRows ? '<h3 style="margin-top: 16px;">Decision Scores</h3>' + scoreRows : '') +
          '</div>' +
        '</section>'
      );

      if (report.scenarioInterpretation) {
        sections.push(
          '<section class="card"><h2>Scenario Interpretation</h2><div class="grid three">' +
            '<div class="panel"><h3>Likely Intent</h3><p>' + escapeHtml(report.scenarioInterpretation.likelyIntent) + '</p></div>' +
            '<div class="panel"><h3>Primary Recommendation</h3><p>' + escapeHtml(report.scenarioInterpretation.primaryRecommendation) + '</p></div>' +
            '<div class="panel"><h3>Ambiguity</h3><p>' + escapeHtml(report.scenarioInterpretation.ambiguity) + '</p></div>' +
          '</div></section>'
        );
      }

      sections.push(
        '<section class="card"><h2>Council Roles</h2><div class="grid two">' +
        (report.agents || []).map((agent) => (
          '<div class="panel"><h3>' + escapeHtml(agent.name) + '</h3>' +
          '<p class="muted">' + escapeHtml(agent.role) + (agent.roleWeight ? ' - role weight ' + escapeHtml(agent.roleWeight) : '') + '</p>' +
          '<p class="answer">' + escapeHtml(agent.answer) + '</p></div>'
        )).join('') +
        '</div></section>'
      );

      if ((report.peerReviews || []).length) {
        sections.push(
          '<section class="card"><h2>Peer Reviews</h2>' +
          '<p class="muted">Each agent critiques a peer answer — exposing weak assumptions before synthesis.</p>' +
          '<div class="grid two">' +
          report.peerReviews.map((review) => (
            '<div class="peer"><div class="peer-head"><strong>' + escapeHtml(review.reviewer) + ' → ' + escapeHtml(review.target) +
            '</strong><span class="peer-score">' + escapeHtml(review.score) + '</span></div>' +
            '<p><strong>Strength:</strong> ' + escapeHtml(review.strength) + '</p>' +
            '<p><strong>Weakness:</strong> ' + escapeHtml(review.weakness) + '</p>' +
            '<span class="peer-revise ' + (review.wouldRevise ? 'yes' : 'no') + '">' +
            (review.wouldRevise ? 'Would revise' : 'Stands by answer') + '</span></div>'
          )).join('') +
          '</div></section>'
        );
      }

      if ((report.swarmRoles || []).length) {
        sections.push(
          '<section class="card"><h2>Verification Swarm</h2><div class="grid two">' +
          report.swarmRoles.map((role) => (
            '<div class="panel"><h3>' + escapeHtml(role.name) + '</h3><p>' + escapeHtml(role.checks) + '</p></div>'
          )).join('') +
          '</div></section>'
        );
      }

      sections.push(
        '<section class="card"><h2>Verified Claims</h2><div class="claims">' +
        (report.verifiedClaims || []).map((claim) => (
          '<article class="claim">' +
            '<div class="claim-head"><strong>' + escapeHtml(claim.id) + ' - ' + escapeHtml(claim.text) + '</strong>' +
            '<span class="verdict ' + escapeHtml(claim.verdict) + '">' + escapeHtml(claim.verdict) + ' ' + pct(claim.confidence) + '%</span></div>' +
            '<p>' + escapeHtml(claim.reasoning) + '</p>' +
            (claim.appliesWhen ? '<p class="muted">Applies when: ' + escapeHtml(claim.appliesWhen) + '</p>' : '') +
            (claim.evidence || []).map((ev) => (
              '<div class="evidence"><div class="evidence-title">' + escapeHtml(ev.title) + '</div>' +
              '<div class="evidence-summary">' + escapeHtml(ev.summary) + '</div></div>'
            )).join('') +
          '</article>'
        )).join('') +
        '</div></section>'
      );

      if (caveats.length || unresolved.length) {
        sections.push(
          '<section class="card"><h2>Assumptions And Caveats</h2><ul class="list">' +
          caveats.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') +
          unresolved.map((claim) => '<li>Unresolved: ' + escapeHtml(claim.text) + '</li>').join('') +
          '</ul></section>'
        );
      }

      sections.push(
        '<section class="card"><h2>Audit Export</h2><div class="grid two">' +
          '<div class="panel"><h3>Report Paths</h3><p>' + escapeHtml(report.reportPaths.json) + '</p><p>' + escapeHtml(report.reportPaths.markdown) + '</p></div>' +
          '<div class="panel"><h3>Audit Trail</h3><ul class="list">' +
          (report.auditTrail || []).map((item) => '<li>' + escapeHtml(item.step) + ': ' + escapeHtml(item.detail) + '</li>').join('') +
          '</ul></div>' +
        '</div></section>'
      );

      results.innerHTML = sections.join('');
    }

    async function loadQuestions() {
      const response = await fetch('/api/questions');
      if (!response.ok) throw new Error('Could not load fixture scenarios.');
      const data = await response.json();
      questions = data.questions || [];
      renderQuestions();
    }

    async function runFixture() {
      const question = questionInput.value.trim();
      if (!question) return;
      setStatus('Running');
      runButton.disabled = true;
      message.textContent = '';
      try {
        const response = await fetch('/api/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Fixture run failed.');
        renderReport(data.report);
        setStatus('Complete');
        message.textContent = 'Generated sample_outputs/latest_fixture_report.json and .md';
      } catch (error) {
        setStatus('Needs attention');
        message.innerHTML = '<span class="error">' + escapeHtml(error.message) + '</span>';
      } finally {
        runButton.disabled = false;
      }
    }

    runButton.addEventListener('click', runFixture);
    loadQuestions()
      .then(runFixture)
      .catch((error) => {
        setStatus('Needs attention');
        message.innerHTML = '<span class="error">' + escapeHtml(error.message) + '</span>';
      });
  </script>
</body>
</html>`;
}

export function createFixtureUiServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    try {
      if (req.method === "GET" && url.pathname === "/") {
        sendHtml(res, buildFixtureUiHtml());
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, {
          status: "ok",
          mode: "fixture/offline",
          liveProvidersRequired: false,
          tools: ["list_demo_questions", "run_fixture_council", "write_audit_report"]
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/questions") {
        sendJson(res, 200, { questions: listDemoQuestions() });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/run") {
        const body = await readRequestJson(req);
        const report = runFixtureCouncil({ question: body.question });
        writeReport(report);
        sendJson(res, 200, { report: publicReport(report) });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = Number(process.env.PORT || process.argv[2] || DEFAULT_PORT);
  const port = Number.isFinite(requestedPort) ? requestedPort : DEFAULT_PORT;
  const server = createFixtureUiServer();
  // Actionable message on port-in-use instead of an uncaught crash.
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the other process or pick another port, e.g. PORT=4174 npm run ui:fixture`);
      process.exit(EXIT.CONFIG);
    }
    console.error(`Fixture UI server error: ${err.message}`);
    process.exit(EXIT.INTERNAL);
  });
  // Graceful shutdown: stop accepting connections and exit cleanly on Ctrl+C.
  onCancel(() => new Promise((resolve) => {
    console.log("\nShutting down fixture UI server…");
    server.close(() => resolve());
  }));
  server.listen(port, "127.0.0.1", () => {
    console.log(`The Council fixture UI is running at http://127.0.0.1:${port}`);
    console.log("Mode: fixture/offline/simulated; no provider keys required.");
  });
}
