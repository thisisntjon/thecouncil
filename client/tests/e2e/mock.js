// Deterministic, $0 network mocks for "The Council" UI-QA suite.
// Every provider call (council :3001, shadow :3002 EventSource) is fulfilled offline.
// Shapes mirror the REAL endpoints (see client/src/App.jsx + shadow-council/index.js):
//   /api/health, /api/ask (SSE), /api/evaluate (SSE), shadow /api/stream (EventSource).

export const QUESTION = 'Should I walk or drive 50m to wash my car?';

// One SSE frame per event. Native EventSource requires the blank-line terminator,
// and the App's fetch-reader parser tolerates it too.
function sse(events) {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

const HEALTH = {
  status: 'ok',
  live: { ready: true, configuredProviders: ['claude', 'gpt', 'gemini', 'grok'], missingProviders: [], reason: null },
  models: {
    claude: { name: 'Haiku 4.5', provider: 'Anthropic', model: 'claude-haiku-4-5', color: '#D97706' },
    gpt: { name: 'GPT-5.4 mini', provider: 'OpenAI', model: 'gpt-5.4-mini', color: '#10B981' },
    gemini: { name: 'Gemini 3.5 Flash', provider: 'Google', model: 'gemini-3.5-flash', color: '#3B82F6' },
    grok: { name: 'Grok 4.3', provider: 'xAI', model: 'grok-4.3', color: '#EF4444' },
  },
  modelOptions: {
    claude: [
      { model: 'claude-haiku-4-5', label: 'Haiku 4.5', tier: 'value', input: 1, output: 5 },
      { model: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'flagship', input: 3, output: 15 },
    ],
    gpt: [
      { model: 'gpt-5.4-mini', label: 'GPT-5.4 mini', tier: 'value', input: 0.75, output: 4.5 },
      { model: 'gpt-5.5', label: 'GPT-5.5', tier: 'flagship', input: 5, output: 30 },
    ],
    gemini: [
      { model: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'value', input: 1.5, output: 9 },
      { model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', tier: 'budget', input: 0.1, output: 0.4 },
    ],
    grok: [
      { model: 'grok-4.3', label: 'Grok 4.3', tier: 'value', input: 1, output: 2 },
      { model: 'grok-4.20-0309-non-reasoning', label: 'Grok 4.20 (fast)', tier: 'budget', input: 1, output: 2 },
    ],
  },
  keysConfigured: { claude: true, gpt: true, gemini: true, grok: true, brave_search: false },
  security: {
    bindHost: '127.0.0.1', authRequired: true, tokenConfigured: false,
    allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
  fixtureMode: { available: true, requiresProviderKeys: false, questionsEndpoint: '/api/fixture/questions', runEndpoint: '/api/fixture/run' },
};

// ── Round 1: per-model answers (car-wash → drive) ─────────────
const ANSWERS = {
  claude: '**Drive.** The car has to be at the wash to be cleaned, so walking 50m leaves it behind. Drive the 50m.',
  gpt: 'Drive — the vehicle must be physically present to be washed, so walking there defeats the purpose.',
  gemini: 'Drive the car. Washing requires the car on-site; 50m is trivial, but the car itself has to make the trip.',
  grok: 'Drive. The car is the thing being washed, so it must go to the wash; walking accomplishes nothing here.',
};
const NAMES = { claude: 'Haiku 4.5', gpt: 'GPT-5.4 mini', gemini: 'Gemini 3.5 Flash', grok: 'Grok 4.3' };
const PROVIDERS = { claude: 'Anthropic', gpt: 'OpenAI', gemini: 'Google', grok: 'xAI' };
const MODEL_IDS = { claude: 'claude-haiku-4-5', gpt: 'gpt-5.4-mini', gemini: 'gemini-3.5-flash', grok: 'grok-4.3' };
const LATENCY = { claude: 1200, gpt: 1500, gemini: 1800, grok: 1400 };
const ORDER = ['claude', 'gpt', 'gemini', 'grok'];

function askBody() {
  const events = [];
  for (const id of ORDER) {
    // A couple of streaming deltas, then the resolved answer.
    events.push({ type: 'answer_delta', modelId: id, text: ANSWERS[id].slice(0, 12) });
    events.push({ type: 'answer_delta', modelId: id, text: ANSWERS[id].slice(12) });
  }
  for (const id of ORDER) {
    events.push({
      type: 'answer',
      result: {
        id, name: NAMES[id], provider: PROVIDERS[id], answer: ANSWERS[id],
        status: 'success', latency: LATENCY[id], model: MODEL_IDS[id], councilRole: 'member',
      },
    });
  }
  events.push({ type: 'complete', sessionUsage: { calls: 4, totalInput: 8000, totalOutput: 2000 } });
  return sse(events);
}

// ── Round 2: peer evaluation (claude wins; consensus = 78) ────
// Each evaluator emits identical ratings → deterministic averages:
//   claude 90, gpt 80, gemini 74, grok 68 → mean = 78, winner = claude.
const RATING_SET = [
  { model_id: 'claude', score: 90, strength: 'crisp and correct', weakness: 'none', reasoning: 'Directly nails why the car must be present.' },
  { model_id: 'gpt', score: 80, strength: 'clear logic', weakness: 'slightly terse', reasoning: 'Correct, a touch brief on the reasoning.' },
  { model_id: 'gemini', score: 74, strength: 'good framing', weakness: 'minor padding', reasoning: 'Right answer with some filler.' },
  { model_id: 'grok', score: 68, strength: 'plain language', weakness: 'less rigorous', reasoning: 'Reaches the answer but argues it loosely.' },
];

function evaluateBody() {
  const events = [];
  for (const evaluator of ORDER) {
    events.push({
      type: 'evaluation',
      evaluator,
      evaluatorName: NAMES[evaluator],
      evaluation: {
        ratings: RATING_SET,
        reasoning: 'The car must be on-site to be washed; walking leaves it behind.',
        reflection: 'I stand by the drive recommendation after seeing the others.',
        would_change: false,
        wouldRevise: false,
      },
    });
  }
  events.push({ type: 'complete', sessionUsage: { calls: 8, totalInput: 16000, totalOutput: 4000 } });
  return sse(events);
}

// ── Round 3: cross-vendor verification swarm (shadow :3002) ───
// Verifier provider always differs from the claim's author (cross-vendor).
// Verdict mix: supported / partially_supported / refuted.
function shadowStreamBody() {
  const q = QUESTION;
  const events = [
    { type: 'question_received', question_number: 1, question: q },
    { type: 'status_change', question_number: 1, status: 'running' },
    {
      type: 'claims_extracted', question_number: 1, model_id: 'claude',
      claims: [
        { id: 'claude-1', text: 'A car must be physically at the wash location to be cleaned.' },
        { id: 'claude-2', text: 'Walking 50m leaves the vehicle behind, defeating the purpose.' },
      ],
    },
    {
      type: 'claims_extracted', question_number: 1, model_id: 'gpt',
      claims: [
        { id: 'gpt-1', text: 'The vehicle must be present at the wash to be serviced.' },
        { id: 'gpt-2', text: 'A 50m drive consumes negligible fuel and time.' },
      ],
    },
    {
      type: 'swarm_diversity', question_number: 1,
      providers: ['Anthropic', 'Google', 'xAI', 'OpenAI'],
      verifiers_used: ['claude', 'gemini', 'grok'],
    },
    // claude-1 ← Gemini (cross-vendor): supported
    { type: 'investigation_started', question_number: 1, claim_id: 'claude-1', verifier_name: 'Gemini 3.5 Flash', verifier_id: 'gemini' },
    { type: 'investigation_complete', question_number: 1, claim_id: 'claude-1', verdict: 'supported', confidence: 0.95, reasoning: 'Trivially true: a car wash acts on the physical vehicle.', verifier_name: 'Gemini 3.5 Flash', verifier_id: 'gemini' },
    // claude-2 ← Grok (cross-vendor): partially_supported
    { type: 'investigation_started', question_number: 1, claim_id: 'claude-2', verifier_name: 'Grok 4.3', verifier_id: 'grok' },
    { type: 'investigation_complete', question_number: 1, claim_id: 'claude-2', verdict: 'partially_supported', confidence: 0.7, reasoning: 'True unless someone else drives the car over while you walk.', verifier_name: 'Grok 4.3', verifier_id: 'grok' },
    // gpt-1 ← Claude (cross-vendor): supported
    { type: 'investigation_started', question_number: 1, claim_id: 'gpt-1', verifier_name: 'Claude Haiku 4.5', verifier_id: 'claude' },
    { type: 'investigation_complete', question_number: 1, claim_id: 'gpt-1', verdict: 'supported', confidence: 0.92, reasoning: 'Restates the core requirement; independently re-derived.', verifier_name: 'Claude Haiku 4.5', verifier_id: 'claude' },
    // gpt-2 ← Gemini (cross-vendor): refuted
    { type: 'investigation_started', question_number: 1, claim_id: 'gpt-2', verifier_name: 'Gemini 3.5 Flash', verifier_id: 'gemini' },
    { type: 'investigation_complete', question_number: 1, claim_id: 'gpt-2', verdict: 'refuted', confidence: 0.6, reasoning: 'Fuel for 50m is negligible, but the time framing overstates it.', verifier_name: 'Gemini 3.5 Flash', verifier_id: 'gemini' },
    {
      type: 'synthesis', question_number: 1,
      answer: '**Drive.** The Council agrees the car must be on-site to be washed; walking the 50m leaves it behind. Cross-vendor verification supports the core claim.',
      citations: [
        { index: 1, claim: 'A car must be present to be washed.', source: { title: 'Car wash basics', url: 'https://example.com/car-wash' } },
      ],
    },
    { type: 'scores', question_number: 1, scores: { claude: { score: 92 }, gpt: { score: 80 }, gemini: { score: 74 }, grok: { score: 68 } } },
    { type: 'pipeline_complete', question_number: 1, duration_ms: 4200 },
  ];
  return sse(events);
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };

/**
 * Install all deterministic mocks on a page. Must be called BEFORE page.goto.
 * @param {import('@playwright/test').Page} page
 */
export async function installMocks(page, { scenario = 'car-wash' } = {}) {
  void scenario; // single scenario for now; param reserved for future expansion.

  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HEALTH) }));

  await page.route('**/api/ask', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'Cache-Control': 'no-cache' }, body: askBody() }));

  await page.route('**/api/evaluate', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'Cache-Control': 'no-cache' }, body: evaluateBody() }));

  // EventSource (cross-origin to :3002) — needs CORS + event-stream.
  await page.route('**/api/stream', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', headers: CORS, body: shadowStreamBody() }));

  // usage/reset (council + shadow) and usage poll (shadow).
  await page.route('**/api/usage/reset', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' }));
  await page.route('**/api/usage', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ calls: [], totalInputTokens: 0, totalOutputTokens: 0 }) }));

  await page.route('**/api/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' }));

  // research-pricing is SSE-consumed; provide a minimal complete frame.
  await page.route('**/api/research-pricing', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'Cache-Control': 'no-cache' }, body: sse([{ type: 'complete' }]) }));
}
