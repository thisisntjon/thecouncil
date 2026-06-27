import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { installMocks, QUESTION } from './mock.js';

const ARTIFACTS = path.resolve(process.cwd(), '..', 'artifacts', 'ui-qa');
const SCREENS = path.join(ARTIFACTS, 'screens');

function writeJson(name, data) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(data, null, 2));
}

// Benign console/network noise we don't count as failures.
const BENIGN = [/favicon/i, /\.well-known/i, /react.devtools/i, /Download the React DevTools/i];
const isBenign = (s) => BENIGN.some((re) => re.test(s));

function attachRuntimeCollectors(page) {
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isBenign(msg.text())) consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!isBenign(url)) failedRequests.push({ url, failure: req.failure()?.errorText || 'failed' });
  });
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && !isBenign(url)) failedRequests.push({ url, status: res.status() });
  });
  return { consoleErrors, failedRequests };
}

// ── Shared flow helpers ──────────────────────────────────────
async function gotoSetup(page) {
  await installMocks(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Configure your session' })).toBeVisible();
}

async function startSession(page) {
  await page.getByRole('button', { name: '3 questions' }).click();
  await expect(page.getByPlaceholder('Ask The Council anything…')).toBeVisible();
}

async function askQuestion(page) {
  await page.getByPlaceholder('Ask The Council anything…').fill(QUESTION);
  await page.getByRole('button', { name: 'Ask the Council' }).click();
  // All four independent answers land.
  await expect(page.getByText('Drive the 50m.')).toBeVisible();
  await expect(page.getByText('defeats the purpose')).toBeVisible();
  await expect(page.getByText('has to make the trip')).toBeVisible();
  await expect(page.getByText('walking accomplishes nothing here')).toBeVisible();
}

async function convene(page) {
  await page.getByRole('button', { name: /Convene the Council/i }).click();
  await expect(page.getByText('Round 2 — Peer evaluation')).toBeVisible();
}

// ════════════════════════════════════════════════════════════
// TEST 1 — runtime + golden path (desktop only)
// ════════════════════════════════════════════════════════════
test('runtime + golden path (mocked, $0)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'golden path runs on desktop');
  const { consoleErrors, failedRequests } = attachRuntimeCollectors(page);

  await gotoSetup(page);
  await page.screenshot({ path: path.join(SCREENS, '01-setup.png'), fullPage: true });

  await startSession(page);
  await page.screenshot({ path: path.join(SCREENS, '02-question-input.png'), fullPage: true });

  await askQuestion(page);
  // Round 1 section present.
  await expect(page.getByText(/Round 1 — Independent answers/)).toBeVisible();
  // Round 3 swarm streams independently; wait for it to settle.
  await expect(page.getByText(/Verification swarm/i).first()).toBeVisible();
  await expect(page.getByText(/Cross-vendor swarm complete/i)).toBeVisible();
  await page.screenshot({ path: path.join(SCREENS, '03-answers-and-swarm.png'), fullPage: true });

  // Verification swarm evidence: verdict badges + cross-vendor "verified by" tag + parallel note.
  await expect(page.getByText('running in parallel · no action needed')).toBeVisible();
  await expect(page.getByText('Supported').first()).toBeVisible();
  await expect(page.getByText('Refuted').first()).toBeVisible();
  await expect(page.getByText(/verified by/i).first()).toBeVisible();

  await convene(page);
  // Consensus number (78 = mean of 90/80/74/68).
  await expect(page.getByText('Council consensus')).toBeVisible();
  await expect(page.getByText('78', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENS, '04-round2-consensus.png'), fullPage: true });

  // Final verdict (winner name appears in eval header + verifier tag too; hero is the last).
  await expect(page.getByText('The Council has decided')).toBeVisible();
  await expect(page.getByText('Highest-rated answer')).toBeVisible();
  await expect(page.getByText('Claude Haiku 4.5').last()).toBeVisible();
  await page.screenshot({ path: path.join(SCREENS, '05-verdict.png'), fullPage: true });

  writeJson('runtime.json', {
    question: QUESTION,
    consoleErrors,
    failedRequests,
    capturedAt: new Date().toISOString(),
  });

  expect(consoleErrors, `console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  expect(failedRequests, `failed requests: ${JSON.stringify(failedRequests)}`).toEqual([]);
});

// ════════════════════════════════════════════════════════════
// TEST 2 — accessibility (axe) on setup + post-answers (desktop)
// Gates on CRITICAL (must be zero). SERIOUS findings are recorded as
// evidence/notes: their remediation needs app-source changes, which are
// out of scope for this additive QA pass — surfaced in the report, not faked.
// ════════════════════════════════════════════════════════════
test('a11y: axe scan (setup + answers)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a11y runs on desktop');

  await gotoSetup(page);
  await page.waitForTimeout(400); // let entrance animations settle — WCAG assesses the stable state, not mid-transition opacity
  const setupScan = await new AxeBuilder({ page }).analyze();

  await startSession(page);
  await askQuestion(page);
  await expect(page.getByText(/Cross-vendor swarm complete/i)).toBeVisible();
  await page.waitForTimeout(600); // settle framer-motion fade-ins before scanning (transient opacity is not a real contrast failure)
  const answersScan = await new AxeBuilder({ page }).analyze();

  const summarize = (scope, v) =>
    v.map((x) => ({
      scope, id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length,
      targets: x.nodes.slice(0, 4).map((n) => n.target?.join(' ')),
    }));
  const setupV = summarize('setup', setupScan.violations);
  const answersV = summarize('answers', answersScan.violations);
  const all = [...setupV, ...answersV];
  const critical = all.filter((v) => v.impact === 'critical');
  const serious = all.filter((v) => v.impact === 'serious');

  writeJson('a11y.json', {
    setup: setupV, answers: answersV,
    critical, serious,
    counts: { critical: critical.length, serious: serious.length, total: all.length },
  });
  for (const s of serious) test.info().annotations.push({ type: 'a11y-serious', description: `${s.scope}: ${s.id} (${s.nodes} nodes)` });

  // Hard gate: no critical violations.
  expect(critical, `critical a11y: ${JSON.stringify(critical)}`).toEqual([]);
});

// ════════════════════════════════════════════════════════════
// TEST 3 — visual baselines (setup / answers / verdict, dark+light)
//          runs on BOTH desktop + mobile projects.
// ════════════════════════════════════════════════════════════
test('visual: setup / answers / verdict in dark + light', async ({ page }) => {
  const themeBtn = () => page.getByRole('button', { name: 'Toggle theme' });
  const toggle = async () => {
    await themeBtn().click();
    await page.waitForTimeout(350);
  };
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  };

  // Setup (default = light)
  await gotoSetup(page);
  await shot('setup-light');
  await toggle();
  await shot('setup-dark');
  await toggle(); // back to light

  // Answers + swarm
  await startSession(page);
  await askQuestion(page);
  await expect(page.getByText(/Cross-vendor swarm complete/i)).toBeVisible();
  await shot('answers-light');
  await toggle();
  await shot('answers-dark');
  await toggle();

  // Verdict
  await convene(page);
  await expect(page.getByText('The Council has decided')).toBeVisible();
  await shot('verdict-light');
  await toggle();
  await shot('verdict-dark');
});
