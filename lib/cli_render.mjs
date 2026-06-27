// Renders a fixture council report as a formatted, optionally-colored terminal
// dashboard. Pure and dependency-free: takes the report object, returns strings.
// No I/O. Color is opt-in via options.color so piped/non-TTY output stays clean
// and the written JSON/Markdown reports are never touched.
//
// renderReportBlocks() returns the dashboard split into logical sections so a
// caller can reveal them progressively (animation = timing only, same content).
// renderReportCli() joins those blocks into one string for non-animated use.

// eslint-disable-next-line no-control-regex -- matching the ESC char is the point
const ANSI = /\x1b\[[0-9;]*m/g;
const visibleLen = (s) => String(s).replace(ANSI, "").length;

function padEnd(str, width) {
  const pad = width - visibleLen(str);
  return pad > 0 ? str + " ".repeat(pad) : String(str);
}

function makeStyle(enabled) {
  const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));
  return {
    bold: wrap(1), dim: wrap(2),
    green: wrap(32), yellow: wrap(33), red: wrap(31),
    gray: wrap(90), cyan: wrap(36)
  };
}

function wrapText(text, width) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > width) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const BLOCKS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
function bar(fraction, cells, colorFn) {
  const f = Math.max(0, Math.min(1, Number(fraction) || 0));
  const total = f * cells;
  let full = Math.floor(total);
  let remainder = Math.round((total - full) * 8);
  if (remainder === 8) { full += 1; remainder = 0; } // round the partial cell up to a full block
  let out = "█".repeat(Math.min(full, cells));
  if (full < cells && remainder > 0) out += BLOCKS[remainder];
  out += " ".repeat(Math.max(0, cells - visibleLen(out)));
  return colorFn ? colorFn(out) : out;
}

function truncate(str, max) {
  const text = String(str);
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + "…";
}

function confColor(value, s) {
  if (value >= 0.8) return s.green;
  if (value >= 0.6) return s.yellow;
  return s.red;
}

function verdictStyle(verdict, s) {
  switch (verdict) {
    case "supported": return { icon: "✔", color: s.green, label: "supported" };
    case "partially_supported": return { icon: "◐", color: s.yellow, label: "partial" };
    case "refuted": return { icon: "✗", color: s.red, label: "refuted" };
    default: return { icon: "?", color: s.gray, label: verdict || "unresolved" };
  }
}

function box(lines, width) {
  const inner = width - 2;
  const top = "╭" + "─".repeat(inner) + "╮";
  const bot = "╰" + "─".repeat(inner) + "╯";
  const body = lines.map((ln) => "│ " + ln + " ".repeat(Math.max(0, inner - 1 - visibleLen(ln))) + "│");
  return [top, ...body, bot];
}

const CIRCLED = ["⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const circled = (i) => CIRCLED[i] || `(${i})`;

export function renderReportBlocks(report, options = {}) {
  const width = Math.max(56, Math.min(options.width || 80, 100));
  const s = makeStyle(Boolean(options.color));
  const cw = width - 4; // wrap width inside a 2-space indent
  const blocks = [];
  let stageNum = 0;
  const stage = (title, suffix = "") => s.bold(`${circled(++stageNum)} ${title}`) + (suffix ? s.dim(suffix) : "");

  const cs = report.final.confidenceSummary;
  const avg = cs.averageConfidence;
  const claimConf = new Map(report.verifiedClaims.map((c) => [c.id, c.confidence]));
  const agentConfidence = (a) => {
    const vals = (a.claimIds || []).map((id) => claimConf.get(id)).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
  };

  // Header + at-a-glance verdict banner
  {
    const titleLine = s.bold("THE COUNCIL") + s.dim(" · Multi-Agent Verification Swarm");
    const modeText = `${s.green("●")} fixture · offline · simulated`;
    const modeLine = options.runId ? `${modeText}   ${s.dim(`run ${options.runId}`)}` : modeText;
    const lines = box([titleLine, modeLine], width);
    lines.push(s.dim("  redact → council → critique → verify → synthesize → audit"));
    const cc = confColor(avg, s);
    lines.push(
      "  " + s.bold("CONFIDENCE ") + bar(avg, 12, cc) + " " + cc(`${Math.round(avg * 100)}%`)
      + s.dim("  ") + s.green(`✔${cs.supportedClaims}`) + " " + s.yellow(`◐${cs.partiallySupportedClaims}`) + " " + s.gray(`?${cs.unresolvedClaims}`)
      + s.dim(`  ·  ${report.verifiedClaims.length} claims · ${report.agents.length} agents`)
    );
    blocks.push(lines.join("\n"));
  }

  // Question (+ scenario interpretation when present)
  {
    const lines = [s.bold("QUESTION") + s.dim(`  (input risk: ${report.inputRisk?.level ?? "n/a"})`)];
    for (const ln of wrapText(report.question, cw)) lines.push("  " + ln);
    const si = report.scenarioInterpretation || report.final?.scenarioInterpretation;
    if (si) {
      lines.push("", s.bold("INTERPRETATION"));
      if (si.likelyIntent) lines.push("  " + s.dim("intent: ") + si.likelyIntent);
      if (si.primaryRecommendation) lines.push("  " + s.dim("recommended: ") + si.primaryRecommendation);
      if (si.ambiguity) for (const ln of wrapText(`ambiguity: ${si.ambiguity}`, cw)) lines.push("  " + s.dim(ln));
    }
    blocks.push(lines.join("\n"));
  }

  // 1. Council — with each agent's own confidence (names/roles truncated to fit width)
  {
    const lines = [stage("COUNCIL", `  ${report.agents.length} agents answered independently`)];
    const weightStr = (a) => (a.roleWeight ? ` ×${a.roleWeight}` : "");
    const weightW = Math.max(0, ...report.agents.map((a) => weightStr(a).length));
    const nameW = Math.min(26, Math.max(...report.agents.map((a) => visibleLen(a.name))));
    const roleBudget = Math.max(10, width - 2 - 2 - nameW - 2 - weightW - 2 - 8 - 1 - 4);
    const roleW = Math.min(roleBudget, Math.max(...report.agents.map((a) => visibleLen(a.role))));
    for (const a of report.agents) {
      const conf = agentConfidence(a);
      const weight = a.roleWeight ? s.dim(weightStr(a)) : " ".repeat(weightW);
      let row = "  " + s.cyan("◆") + " " + padEnd(truncate(a.name, nameW), nameW) + "  " + s.dim(padEnd(truncate(a.role, roleW), roleW)) + weight;
      if (conf !== null) row += "  " + bar(conf, 8, confColor(conf, s)) + " " + s.dim(`${Math.round(conf * 100)}%`);
      lines.push(row);
    }
    blocks.push(lines.join("\n"));
  }

  // 2. Peer critique
  if (report.peerReviews?.length) {
    const lines = [stage("PEER CRITIQUE", `  ${report.peerReviews.length} cross-reviews`)];
    const rW = Math.max(...report.peerReviews.map((r) => visibleLen(r.reviewer)));
    const tW = Math.max(...report.peerReviews.map((r) => visibleLen(r.target)));
    for (const r of report.peerReviews) {
      const c = r.score >= 85 ? s.green : r.score >= 70 ? s.yellow : s.red;
      const revise = r.wouldRevise ? s.yellow("  ↻ would revise") : "";
      lines.push("  " + padEnd(r.reviewer, rW) + " " + s.dim("→") + " " + padEnd(r.target, tW) + "  " + c(`${r.score}/100`) + revise);
    }
    blocks.push(lines.join("\n"));
  }

  // 3. Verification swarm
  {
    const lines = [stage("VERIFICATION SWARM", `  ${report.verifiedClaims.length} claims checked against evidence`)];
    const idW = Math.max(...report.verifiedClaims.map((c) => visibleLen(c.id)));
    for (const c of report.verifiedClaims) {
      const v = verdictStyle(c.verdict, s);
      const pct = `${Math.round((c.confidence || 0) * 100)}%`.padStart(4);
      lines.push("  " + v.color(v.icon) + " " + padEnd(c.id, idW) + "  " + v.color(padEnd(v.label, 10)) + " " + s.dim(pct) + " " + bar(c.confidence, 10, v.color));
    }
    lines.push("  " + s.dim(`${cs.supportedClaims} supported · ${cs.partiallySupportedClaims} partial · ${cs.unresolvedClaims} unresolved · avg ${avg}`));
    const unresolved = report.final.unresolvedClaims || [];
    if (unresolved.length) {
      lines.push("  " + s.yellow("⚠ preserved (not hidden):"));
      for (const c of unresolved.slice(0, 3)) {
        const text = c.text.length > cw - 10 ? `${c.text.slice(0, cw - 11)}…` : c.text;
        lines.push("    " + s.dim(`${c.id} — ${text}`));
      }
    }
    blocks.push(lines.join("\n"));
  }

  // 4. Decision scores (weighted practical-reasoning scenarios)
  const scores = report.final.decisionScores;
  if (scores && Object.keys(scores).length) {
    const lines = [stage("DECISION SCORES")];
    const entries = Object.entries(scores);
    const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v))) || 1;
    const optW = Math.max(...entries.map(([k]) => visibleLen(k)));
    const top = Math.max(...entries.map(([, v]) => v));
    for (const [opt, val] of entries) {
      const c = val >= 0 ? s.green : s.red;
      const marker = val === top ? s.green(" ← chosen") : "";
      lines.push("  " + padEnd(opt, optW) + "  " + bar(Math.abs(val) / maxAbs, 12, c) + " " + c(val.toFixed(2)) + marker);
    }
    blocks.push(lines.join("\n"));
  }

  // 5. Final synthesis
  {
    const lines = [stage("FINAL SYNTHESIS", `  avg confidence ${avg}`)];
    for (const ln of wrapText(report.final.finalAnswer, cw)) lines.push("  " + ln);
    blocks.push(lines.join("\n"));
  }

  // Output footer
  if (options.outputs) {
    blocks.push([s.dim("reports written:"), "  " + s.dim(`→ ${options.outputs.mdPath}`), "  " + s.dim(`→ ${options.outputs.jsonPath}`)].join("\n"));
  } else if (options.dryRun) {
    blocks.push(s.dim("[dry-run] no files written"));
  }

  return blocks;
}

export function renderReportCli(report, options = {}) {
  return renderReportBlocks(report, options).join("\n\n");
}
