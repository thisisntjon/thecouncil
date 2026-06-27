import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Settings2, X, ArrowRight, Sun, Moon, ExternalLink,
  ShieldCheck, Loader2, CircleCheck, CircleX, CircleSlash, MinusCircle,
  Sparkles, RefreshCw, Trophy, Send,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Constants ───────────────────────────────────────────────

// Keep model ids in sync with server MODELS and shadow SHADOW_PROVIDERS.
const MODEL_CONFIG = {
  claude: { name: 'Claude Haiku 4.5', short: 'Claude', provider: 'Anthropic', color: 'var(--model-claude)' },
  gpt: { name: 'GPT-5.4 mini', short: 'GPT', provider: 'OpenAI', color: 'var(--model-gpt)' },
  gemini: { name: 'Gemini 3.5 Flash', short: 'Gemini', provider: 'Google', color: 'var(--model-gemini)' },
  grok: { name: 'Grok 4.3', short: 'Grok', provider: 'xAI', color: 'var(--model-grok)' },
};
const MODEL_ORDER = ['claude', 'gpt', 'gemini', 'grok'];

const API_BASE = '/api';
const SHADOW_BASE = 'http://localhost:3002';
const COUNCIL_TOKEN_STORAGE_KEY = 'councilApiToken';
const SHADOW_TOKEN_STORAGE_KEY = 'shadowCouncilToken';
const THEME_STORAGE_KEY = 'councilTheme';

function storedToken(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function authHeaders(headers = {}) {
  const token = storedToken(COUNCIL_TOKEN_STORAGE_KEY, import.meta.env?.VITE_COUNCIL_API_TOKEN || '');
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function shadowAuthHeaders(headers = {}) {
  const fallback = import.meta.env?.VITE_SHADOW_COUNCIL_TOKEN || import.meta.env?.VITE_COUNCIL_API_TOKEN || '';
  const token = storedToken(SHADOW_TOKEN_STORAGE_KEY, storedToken(COUNCIL_TOKEN_STORAGE_KEY, fallback));
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

// ── Verdict semantics ───────────────────────────────────────

const VERDICT = {
  supported: { label: 'Supported', variant: 'success', Icon: CircleCheck, bar: 'bg-supported' },
  partially_supported: { label: 'Partial', variant: 'warning', Icon: MinusCircle, bar: 'bg-partial' },
  refuted: { label: 'Refuted', variant: 'danger', Icon: CircleX, bar: 'bg-refuted' },
  unverifiable: { label: 'Unverifiable', variant: 'muted', Icon: CircleSlash, bar: 'bg-unknown' },
  pending: { label: 'Verifying', variant: 'outline', Icon: Loader2, bar: 'bg-unknown' },
};
function verdictMeta(v) {
  return VERDICT[v] || VERDICT.pending;
}

// ── Small presentational helpers ────────────────────────────

function ModelDot({ id, className }) {
  const color = MODEL_CONFIG[id]?.color || 'var(--muted-foreground)';
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />;
}

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

function SectionLabel({ children, hint }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
      <Separator className="flex-1" />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
}

// ── Round 1: Answer Card ────────────────────────────────────

function AnswerCard({ id, name, provider, modelId, latency, answer, thinking, status }) {
  const config = MODEL_CONFIG[id] || {};
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const hasThinking = Boolean(thinking && thinking.trim());

  // Auto-open reasoning while it streams; collapse once the answer lands.
  useEffect(() => {
    if (status === 'streaming' && hasThinking) setReasoningOpen(true);
    if (status === 'done') setReasoningOpen(false);
  }, [status, hasThinking]);

  return (
    <motion.div {...fade} className="h-full">
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b bg-muted/30 p-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <ModelDot id={id} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">{name || config.name}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {modelId || ''}{modelId ? ' · ' : ''}{provider || config.provider}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'streaming' && (
              <Badge variant="muted" className="gap-1.5">
                <Loader2 className="size-3 animate-spin" /> streaming
              </Badge>
            )}
            {latency != null && status !== 'streaming' && status !== 'waiting' && (
              <span className="font-mono text-[11px] text-muted-foreground">{(latency / 1000).toFixed(1)}s</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0">
          {hasThinking && (
            <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Reasoning
                </span>
                <ChevronDown className={cn('size-3.5 transition-transform', reasoningOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-44 overflow-y-auto thin-scroll border-b bg-muted/20 px-4 py-3 font-mono text-[12px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {thinking}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex-1 px-4 py-4">
            {status === 'error' ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <CircleX className="mt-0.5 size-4 shrink-0" />
                <span>{answer || 'Failed to respond'}</span>
              </div>
            ) : status === 'waiting' ? (
              <div className="space-y-2.5">
                <Skeleton className="h-3.5 w-[90%]" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-3.5 w-[60%]" />
              </div>
            ) : (
              <div className="prose-council">
                <ReactMarkdown>{answer || ''}</ReactMarkdown>
                {status === 'streaming' && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Round 2: Evaluation Card ────────────────────────────────

function scoreTone(score) {
  if (score >= 80) return 'text-supported';
  if (score >= 50) return 'text-partial';
  return 'text-refuted';
}
function scoreBar(score) {
  if (score >= 80) return 'bg-supported';
  if (score >= 50) return 'bg-partial';
  return 'bg-refuted';
}

function EvaluationCard({ evaluatorId, evaluation }) {
  const config = MODEL_CONFIG[evaluatorId] || {};
  if (!evaluation) return null;
  const ratings = evaluation.ratings || [];

  return (
    <motion.div {...fade} className="h-full">
      <Card className="flex h-full flex-col">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b bg-muted/30 p-4">
          <div className="flex items-center gap-2.5">
            <ModelDot id={evaluatorId} />
            <span className="text-sm font-semibold tracking-tight">{config.name}</span>
          </div>
          <Badge variant="muted">Judge</Badge>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {ratings.map((r, i) => {
            const target = MODEL_CONFIG[r.model_id] || {};
            const score = r.score || 0;
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <ModelDot id={r.model_id} className="size-2" />
                    {target.short || r.model_id}
                  </span>
                  <span className={cn('font-mono text-sm font-semibold tabular-nums', scoreTone(score))}>{score}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full transition-all duration-700', scoreBar(score))} style={{ width: `${score}%` }} />
                </div>
                {r.reasoning && <p className="text-xs leading-relaxed text-muted-foreground">{r.reasoning}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {r.strength && r.strength !== 'none' && (
                    <Badge variant="success" className="font-normal">+ {r.strength}</Badge>
                  )}
                  {r.weakness && r.weakness !== 'none' && (
                    <Badge variant="warning" className="font-normal">− {r.weakness}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
        {evaluation.reflection && (
          <div className="mt-auto border-t bg-muted/20 p-4">
            <p className="text-xs italic leading-relaxed text-muted-foreground">“{evaluation.reflection}”</p>
            {evaluation.would_change !== undefined && (
              <Badge variant={evaluation.would_change ? 'warning' : 'success'} className="mt-2">
                {evaluation.would_change ? 'Would revise' : 'Stands by answer'}
              </Badge>
            )}
            {evaluation.would_change && evaluation.revised_position && (
              <p className="mt-2 text-xs text-muted-foreground">Revised: {evaluation.revised_position}</p>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ── Consensus ───────────────────────────────────────────────

function ConsensusPanel({ consensus }) {
  const label =
    consensus >= 90 ? 'Strong agreement' :
    consensus >= 75 ? 'General consensus' :
    consensus >= 60 ? 'Mixed views' : 'Significant disagreement';
  const bar = consensus >= 75 ? 'bg-supported' : consensus >= 60 ? 'bg-partial' : 'bg-refuted';
  return (
    <motion.div {...fade}>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Council consensus</span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-5xl font-bold tracking-tight tabular-nums">{consensus}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <div className="w-full max-w-md">
            <Progress value={consensus} indicatorClassName={bar} aria-label="Council consensus score" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Round 3: Native parallel verification (shadow :3002 stream) ──

function ClaimRow({ claim, verification }) {
  const verdict = verification?.verdict || 'pending';
  const meta = verdictMeta(verdict);
  const confidence = verification ? Math.round((verification.confidence || 0) * 100) : null;
  const Icon = meta.Icon;
  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-3">
      <p className="text-sm leading-snug">{claim.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={meta.variant} className="gap-1">
          <Icon className={cn('size-3', verdict === 'pending' && 'animate-spin')} />
          {meta.label}
        </Badge>
        {confidence != null && verdict !== 'pending' && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{confidence}% confidence</span>
        )}
        {verification?.verifier_name && (
          <Badge variant="outline" className="gap-1 font-normal">
            <ShieldCheck className="size-3" /> verified by {verification.verifier_name}
          </Badge>
        )}
      </div>
      {confidence != null && verdict !== 'pending' && (
        <Progress value={confidence} className="h-1" indicatorClassName={meta.bar} aria-label="Verification confidence" />
      )}
      {verification?.reasoning && (
        <p className="text-xs leading-relaxed text-muted-foreground">{verification.reasoning}</p>
      )}
    </div>
  );
}

function NativeVerification({ questionText, epoch, onComplete }) {
  const [conn, setConn] = useState('connecting'); // connecting | open | error
  const [view, setView] = useState(null);
  const statesRef = useRef({});
  const completedRef = useRef(false);

  useEffect(() => {
    statesRef.current = {};
    completedRef.current = false;
    setView(null);
    setConn('connecting');

    let es;
    try {
      es = new EventSource(`${SHADOW_BASE}/api/stream`);
    } catch {
      setConn('error');
      return;
    }

    const want = (questionText || '').trim();
    const pickActive = () => {
      const all = Object.values(statesRef.current);
      if (all.length === 0) return null;
      const matched = want ? all.filter(s => (s.question || '').trim() === want) : [];
      const pool = matched.length ? matched : all;
      return pool.sort((a, b) => (b.question_number || 0) - (a.question_number || 0))[0];
    };
    const refresh = () => {
      const active = pickActive();
      setView(active ? { ...active } : null);
      if (active && active.status === 'complete' && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    const ensure = (num, seed = {}) => {
      if (!statesRef.current[num]) {
        statesRef.current[num] = { question_number: num, status: 'queued', claims: {}, verifications: {}, ...seed };
      }
      return statesRef.current[num];
    };

    es.onopen = () => setConn('open');
    es.onerror = () => setConn(prev => (prev === 'open' ? 'open' : 'error'));
    es.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      const num = data.question_number;
      switch (data.type) {
        case 'init':
          (data.questions || []).forEach(q => {
            const verifications = {};
            Object.entries(q.verifications || {}).forEach(([cid, v]) => { verifications[cid] = v; });
            statesRef.current[q.question_number] = {
              question_number: q.question_number,
              question: q.question,
              status: q.status,
              claims: q.claims || {},
              verifications,
              synthesis: q.synthesis || null,
              scores: q.scores || null,
              duration_ms: q.duration_ms || null,
            };
          });
          break;
        case 'question_received':
          ensure(num).question = data.question;
          statesRef.current[num].status = 'queued';
          break;
        case 'status_change':
          ensure(num).status = data.status;
          break;
        case 'claims_extracted':
          ensure(num).claims[data.model_id] = data.claims || [];
          break;
        case 'swarm_diversity':
          ensure(num).diversity = { providers: data.providers, verifiers_used: data.verifiers_used };
          break;
        case 'investigation_started': {
          const s = ensure(num);
          s.verifications[data.claim_id] = { ...(s.verifications[data.claim_id] || {}), verifier_name: data.verifier_name, verifier_id: data.verifier_id };
          break;
        }
        case 'investigation_complete': {
          const s = ensure(num);
          s.verifications[data.claim_id] = {
            verdict: data.verdict,
            confidence: data.confidence,
            reasoning: data.reasoning,
            verifier_name: data.verifier_name,
            verifier_id: data.verifier_id,
          };
          break;
        }
        case 'synthesis':
          ensure(num).synthesis = { answer: data.answer, citations: data.citations };
          break;
        case 'scores':
          ensure(num).scores = data.scores;
          break;
        case 'pipeline_complete':
          ensure(num).status = 'complete';
          statesRef.current[num].duration_ms = data.duration_ms;
          break;
        case 'heartbeat':
          return;
        default:
          break;
      }
      refresh();
    };

    return () => { try { es.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  const claimGroups = view ? MODEL_ORDER.filter(id => (view.claims?.[id] || []).length > 0) : [];
  const allClaims = view ? Object.values(view.claims || {}).flat() : [];
  const total = allClaims.length;
  const done = allClaims.filter(c => view.verifications?.[c.id]?.verdict).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = view?.status === 'complete';
  const scores = view?.scores ? Object.entries(view.scores).sort(([, a], [, b]) => (b.score || 0) - (a.score || 0)) : [];

  return (
    <motion.div {...fade}>
      <Card>
        <CardHeader className="gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <span className="flex items-center gap-2 text-sm font-medium">
                <CircleCheck className="size-4 text-supported" /> Cross-vendor swarm complete
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium">
                <RefreshCw className="size-4 animate-spin text-primary" /> Verification swarm
              </span>
            )}
            <Badge variant="muted" className="gap-1.5">running in parallel · no action needed</Badge>
          </div>
          <a
            href={SHADOW_BASE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            pop out <ExternalLink className="size-3" />
          </a>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {conn === 'error' && !view && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Verifier stream offline. Start the shadow council on :3002, or open the dashboard via “pop out”.
            </p>
          )}
          {conn !== 'error' && !view && (
            <div className="space-y-2.5 py-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {view && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {total > 0 ? `${done}/${total} claims verified` : 'Decomposing answers into claims…'}
                </span>
                {view.diversity?.providers?.length > 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {view.diversity.providers.length} vendors · cross-checked
                  </span>
                )}
              </div>
              {total > 0 && <Progress value={pct} aria-label="Claims verified" />}

              <div className="grid gap-4 lg:grid-cols-2">
                {claimGroups.map(modelId => {
                  const claims = view.claims[modelId] || [];
                  const verifiedCount = claims.filter(c => view.verifications?.[c.id]?.verdict === 'supported').length;
                  return (
                    <div key={modelId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <ModelDot id={modelId} className="size-2" />
                          {MODEL_CONFIG[modelId]?.short || modelId}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{verifiedCount}/{claims.length} supported</span>
                      </div>
                      <div className="space-y-2">
                        {claims.map(claim => (
                          <ClaimRow key={claim.id} claim={claim} verification={view.verifications?.[claim.id]} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {view.synthesis?.answer && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-supported" /> Verified synthesis
                  </div>
                  <div className="prose-council">
                    <ReactMarkdown>{view.synthesis.answer}</ReactMarkdown>
                  </div>
                  {view.synthesis.citations?.length > 0 && (
                    <div className="mt-3 space-y-1 border-t pt-3">
                      {view.synthesis.citations.map((c, i) => (
                        <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">[{c.index}]</span>
                          <span className="flex-1">{c.claim}</span>
                          {c.source?.url && (
                            <a href={c.source.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline">
                              {c.source.title || 'Source'} <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scores.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {scores.map(([id, s]) => {
                    const pctScore = Math.round(s.score || 0);
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                        <ModelDot id={id} className="size-2" />
                        <span>{MODEL_CONFIG[id]?.short || id}</span>
                        <span className={cn('font-mono font-semibold tabular-nums', scoreTone(pctScore))}>{pctScore}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Verdict hero ────────────────────────────────────────────

function VerdictHero({ winnerId, answer, onNext, nextLabel }) {
  const config = MODEL_CONFIG[winnerId] || {};
  return (
    <motion.div {...fade}>
      <Card className="border-primary/30">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2 text-center">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">The Council has decided</span>
            <div className="flex items-center justify-center gap-2.5">
              <ModelDot id={winnerId} className="size-3.5" />
              <span className="text-2xl font-bold tracking-tight">{config.name || winnerId}</span>
            </div>
            <span className="text-sm text-muted-foreground">Highest-rated answer</span>
          </div>
          {answer && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">The Council&rsquo;s answer</div>
              <div className="prose-council">
                <ReactMarkdown>{answer}</ReactMarkdown>
              </div>
            </div>
          )}
          <div className="flex justify-center">
            <Button size="lg" onClick={onNext}>
              {nextLabel} <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Cost strip ──────────────────────────────────────────────

function Stat({ label, value, accent }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('font-mono text-base tabular-nums', accent && 'text-primary')}>{value}</div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────

function MainApp() {
  const [theme, setTheme] = useTheme();

  // Core question state
  const [question, setQuestion] = useState('');
  const [activeModels, setActiveModels] = useState(['claude', 'gpt', 'gemini', 'grok']);
  const [answers, setAnswers] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [answerStream, setAnswerStream] = useState({}); // { id: { answer, thinking } }
  const [evaluations, setEvaluations] = useState([]);
  const [phase, setPhase] = useState('setup');
  const [consensus, setConsensus] = useState(null);

  // Game mode state
  const [gameConfig, setGameConfig] = useState(null);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(0);
  const [gameResults, setGameResults] = useState([]);
  const [runningScores, setRunningScores] = useState({ claude: 0, gpt: 0, gemini: 0, grok: 0 });
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  // Model settings & cost tracking
  const [health, setHealth] = useState(null);
  const [modelOptions, setModelOptions] = useState(null);
  const [modelSelections, setModelSelections] = useState({});
  const [sessionCost, setSessionCost] = useState({ calls: 0, totalInput: 0, totalOutput: 0 });
  const [livePricing, setLivePricing] = useState(null);
  const [pricingStatus, setPricingStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMidGameSettings, setShowMidGameSettings] = useState(false);
  const [shadowCost, setShadowCost] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Verification (native, streamed from shadow :3002)
  const [verificationStatus, setVerificationStatus] = useState(null); // null | 'in_progress' | 'complete'
  const [verifyEpoch, setVerifyEpoch] = useState(0);
  const channelRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [question]);

  // Fetch model options + health on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => r.json()).then(data => {
      setHealth(data);
      if (data.modelOptions) {
        setModelOptions(data.modelOptions);
        const defaults = {};
        Object.entries(data.models || {}).forEach(([id, m]) => { defaults[id] = m.model; });
        setModelSelections(defaults);
        const configuredModels = Object.entries(data.keysConfigured || {})
          .filter(([id, configured]) => configured && MODEL_CONFIG[id])
          .map(([id]) => id);
        if (configuredModels.length > 0) setActiveModels(configuredModels);
      }
    }).catch(() => {});
  }, []);

  // BroadcastChannel (keeps the optional #/shadow dashboard window in sync)
  useEffect(() => {
    channelRef.current = new BroadcastChannel('the-council');
    channelRef.current.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'shadow_ready') setVerificationStatus(prev => prev);
      if (type === 'verification_complete') setVerificationStatus('complete');
    };
    return () => channelRef.current?.close();
  }, []);

  // Poll Shadow Council usage during active games
  useEffect(() => {
    if (!gameConfig || phase === 'setup' || phase === 'game_over') return;
    const poll = () => {
      fetch(`${SHADOW_BASE}/api/usage`, { headers: shadowAuthHeaders() })
        .then(r => r.json())
        .then(data => setShadowCost({
          calls: data.calls?.length || 0,
          totalInput: data.totalInputTokens || 0,
          totalOutput: data.totalOutputTokens || 0,
        }))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [gameConfig, phase]);

  const toggleModel = (id) => {
    setActiveModels(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
  };

  // ── Round 1: Ask ──────────────────────────────────
  const handleAsk = useCallback(async () => {
    if (!question.trim() || activeModels.length === 0) return;

    setErrorMessage(null);
    setPhase('asking');
    setAnswers([]);
    setEvaluations([]);
    setConsensus(null);
    setAnswerStream({});
    setVerificationStatus('in_progress');
    setVerifyEpoch(e => e + 1);
    setWaiting([...activeModels]);

    const collectedAnswers = [];

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: question.trim(), models: activeModels }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'answer_delta' && data.modelId) {
              setAnswerStream(prev => ({
                ...prev,
                [data.modelId]: { ...prev[data.modelId], answer: (prev[data.modelId]?.answer || '') + data.text },
              }));
            }
            if (data.type === 'thinking_delta' && data.modelId) {
              setAnswerStream(prev => ({
                ...prev,
                [data.modelId]: { ...prev[data.modelId], thinking: (prev[data.modelId]?.thinking || '') + data.text },
              }));
            }
            if (data.type === 'answer' && data.result) {
              collectedAnswers.push(data.result);
              setAnswers(prev => [...prev, data.result]);
              setWaiting(prev => prev.filter(id => id !== data.result.id));
            }
            if (data.type === 'complete') {
              if (data.sessionUsage) updateSessionCost(data.sessionUsage);
              const successAnswers = collectedAnswers.filter(a => a.status === 'success');
              const answersPayload = successAnswers.map(a => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer }));
              channelRef.current?.postMessage({
                type: 'answers_ready',
                question: question.trim(),
                answers: answersPayload,
                questionNum: currentQuestionNum,
              });
              setWaiting([]);
              setPhase('answered');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Ask failed:', err);
      setErrorMessage(`Round 1 failed: ${err.message || 'Network error — is the server running?'}`);
      setWaiting([]);
      setPhase('idle');
    }
  }, [question, activeModels, currentQuestionNum]);

  // ── Round 2: Evaluate ─────────────────────────────
  const collectedEvalsRef = useRef([]);

  const handleEvaluate = useCallback(async () => {
    const successfulAnswers = answers.filter(a => a.status === 'success');
    if (successfulAnswers.length < 2) {
      setPhase('evaluated');
      return;
    }
    setPhase('evaluating');
    setEvaluations([]);
    setConsensus(null);
    collectedEvalsRef.current = [];

    const answersPayload = successfulAnswers.map(a => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer }));

    try {
      const response = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: question.trim(), answers: answersPayload }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'evaluation') {
              collectedEvalsRef.current.push(data);
              setEvaluations(prev => [...prev, data]);
            }
            if (data.type === 'complete') {
              if (data.sessionUsage) updateSessionCost(data.sessionUsage);
              const allScores = [];
              collectedEvalsRef.current.forEach(ev => {
                ev.evaluation?.ratings?.forEach(r => { if (r.score) allScores.push(r.score); });
              });
              const consensusValue = allScores.length > 0
                ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
                : null;
              if (consensusValue !== null) setConsensus(consensusValue);

              const modelScores = {};
              collectedEvalsRef.current.forEach(ev => {
                ev.evaluation?.ratings?.forEach(r => {
                  if (!modelScores[r.model_id]) modelScores[r.model_id] = [];
                  if (r.score) modelScores[r.model_id].push(r.score);
                });
              });
              const avgScores = {};
              Object.entries(modelScores).forEach(([id, scores]) => {
                avgScores[id] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
              });
              const winner = Object.entries(avgScores).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

              setRunningScores(prev => {
                const updated = { ...prev };
                Object.entries(avgScores).forEach(([id, avg]) => {
                  const base = Math.round(avg / 10);
                  const bonus = id === winner ? 1 : 0;
                  updated[id] = (updated[id] || 0) + base + bonus;
                });
                return updated;
              });

              const successAnswers = answers.filter(a => a.status === 'success');
              setGameResults(prev => [...prev, {
                questionNum: currentQuestionNum,
                question: question.trim(),
                winner,
                consensus: consensusValue,
                avgScores,
                evaluations: collectedEvalsRef.current.map(ev => ({
                  evaluator: ev.evaluator, evaluatorName: ev.evaluatorName, evaluation: ev.evaluation,
                })),
                answers: successAnswers.map(a => ({ id: a.id, name: a.name, provider: a.provider, answer: a.answer, latency: a.latency })),
              }]);

              setPhase('evaluated');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Evaluate failed:', err);
      setErrorMessage(`Evaluation failed: ${err.message || 'Network error'}`);
      setPhase('evaluated');
    }
  }, [answers, question, currentQuestionNum]);

  // ── Cost Helpers ──────────────────────────────
  const updateSessionCost = (usageData) => {
    if (usageData) {
      setSessionCost(prev => ({
        calls: usageData.calls || prev.calls,
        totalInput: usageData.totalInput || prev.totalInput,
        totalOutput: usageData.totalOutput || prev.totalOutput,
      }));
    }
  };

  const getModelPricing = (modelId) => {
    const selected = modelSelections[modelId];
    const opt = modelOptions?.[modelId]?.find(o => o.model === selected) || modelOptions?.[modelId]?.[0];
    if (!opt) return { input: 2.0, output: 8.0 };
    const live = livePricing?.pricing?.[opt.model];
    return { input: live?.input_per_million || opt.input, output: live?.output_per_million || opt.output };
  };

  const getCostBreakdown = () => {
    const byProvider = {};
    let totalCost = 0;
    activeModels.forEach(id => {
      const pricing = getModelPricing(id);
      const providerShare = 1 / activeModels.length;
      const inputTokens = sessionCost.totalInput * providerShare;
      const outputTokens = sessionCost.totalOutput * providerShare;
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
      const providerKey = MODEL_CONFIG[id]?.provider || id;
      byProvider[providerKey] = { inputTokens: Math.round(inputTokens), outputTokens: Math.round(outputTokens), cost };
      totalCost += cost;
    });
    let shadowTotal = 0;
    if (shadowCost && (shadowCost.totalInput > 0 || shadowCost.totalOutput > 0)) {
      const shadowPricing = getModelPricing('claude');
      shadowTotal = (shadowCost.totalInput / 1_000_000) * shadowPricing.input + (shadowCost.totalOutput / 1_000_000) * shadowPricing.output;
    }
    return { byProvider, councilTotal: totalCost, shadowTotal, grandTotal: totalCost + shadowTotal };
  };

  const getEstimatedCost = () => getCostBreakdown().grandTotal;

  const getEstimatedCostPerQuestion = () => {
    if (!modelOptions) return null;
    const avgInputTokens = 2000;
    const avgOutputTokens = 500;
    let askCost = 0, evalCost = 0;
    activeModels.forEach(id => {
      const pricing = getModelPricing(id);
      askCost += (avgInputTokens / 1_000_000) * pricing.input + (avgOutputTokens / 1_000_000) * pricing.output;
      evalCost += (avgInputTokens / 1_000_000) * pricing.input + (avgOutputTokens / 1_000_000) * pricing.output;
    });
    const shadowPricing = getModelPricing('claude');
    const shadowCostEst = 35 * ((avgInputTokens / 1_000_000) * shadowPricing.input + (avgOutputTokens / 1_000_000) * shadowPricing.output);
    return { ask: askCost, evaluate: evalCost, shadow: shadowCostEst, total: askCost + evalCost + shadowCostEst };
  };

  const handleResearchPricing = async () => {
    setPricingStatus('researching');
    try {
      const response = await fetch(`${API_BASE}/research-pricing`, { method: 'POST', headers: authHeaders() });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'pricing' && data.data?.pricing) setLivePricing(data.data);
            if (data.type === 'complete') setPricingStatus('done');
          } catch {}
        }
      }
    } catch (err) {
      console.error('Pricing research failed:', err);
      setPricingStatus(null);
    }
  };

  const applyMidGameSettings = async () => {
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ models: modelSelections }),
      });
      setShowMidGameSettings(false);
    } catch (err) {
      console.error('Failed to apply settings:', err);
    }
  };

  // ── Game Flow Helpers ──────────────────────────
  const startGame = async (totalQuestions) => {
    if (Object.keys(modelSelections).length > 0) {
      try {
        await fetch(`${API_BASE}/config`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ models: modelSelections }),
        });
      } catch {}
    }
    fetch(`${API_BASE}/usage/reset`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    fetch(`${SHADOW_BASE}/api/usage/reset`, { method: 'POST', headers: shadowAuthHeaders() }).catch(() => {});
    setSessionCost({ calls: 0, totalInput: 0, totalOutput: 0 });

    setGameConfig({ totalQuestions });
    setCurrentQuestionNum(1);
    setGameResults([]);
    setRunningScores({ claude: 0, gpt: 0, gemini: 0, grok: 0 });
    setPhase('idle');
    channelRef.current?.postMessage({ type: 'game_start', totalQuestions });
  };

  const handleNextQuestion = () => {
    const nextNum = currentQuestionNum + 1;
    if (gameConfig && nextNum > gameConfig.totalQuestions) {
      setPhase('game_over');
      channelRef.current?.postMessage({ type: 'game_over', finalScores: runningScores, gameResults });
      fetch(`${SHADOW_BASE}/api/usage`, { headers: shadowAuthHeaders() }).then(r => r.json()).then(data => {
        setShadowCost({ calls: data.calls?.length || 0, totalInput: data.totalInputTokens || 0, totalOutput: data.totalOutputTokens || 0 });
      }).catch(() => {});
      return;
    }
    setCurrentQuestionNum(nextNum);
    setQuestion('');
    setAnswers([]);
    setWaiting([]);
    setAnswerStream({});
    setEvaluations([]);
    setConsensus(null);
    setVerificationStatus(null);
    setPhase('idle');
    channelRef.current?.postMessage({ type: 'next_question', questionNum: nextNum });
  };

  const handleNewGame = () => {
    setPhase('setup');
    setGameConfig(null);
    setCurrentQuestionNum(0);
    setGameResults([]);
    setRunningScores({ claude: 0, gpt: 0, gemini: 0, grok: 0 });
    setQuestion('');
    setAnswers([]);
    setWaiting([]);
    setAnswerStream({});
    setEvaluations([]);
    setConsensus(null);
    setExpandedQuestion(null);
    setVerificationStatus(null);
    setSessionCost({ calls: 0, totalInput: 0, totalOutput: 0 });
    setShadowCost(null);
    setErrorMessage(null);
    setShowSettings(false);
    setShowMidGameSettings(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (phase === 'idle' || phase === 'evaluated' || phase === 'answered') handleAsk();
    }
  };

  const successfulAnswers = answers.filter(a => a.status === 'success');
  const liveBadge = health
    ? (health.live?.ready ? { label: 'Live', tone: 'success' } : { label: 'Live · degraded', tone: 'warning' })
    : { label: 'Live', tone: 'muted' };

  // ── Header (shared) ───────────────────────────────
  const Header = (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">The Council</h1>
              <Badge variant={liveBadge.tone} className="hidden sm:inline-flex">{liveBadge.label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Independent answers, cross-verified</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            {MODEL_ORDER.map(id => (
              <span key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ModelDot id={id} className="size-2" />
                {MODEL_CONFIG[id].short}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );

  // ── Setup Screen ──────────────────────────────────
  if (phase === 'setup') {
    const est = getEstimatedCostPerQuestion();
    return (
      <TooltipProvider delayDuration={200}>
        {Header}
        <main className="mx-auto max-w-2xl px-5 py-12">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Configure your session</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Four frontier models answer independently, peer-review each other, and a cross-vendor swarm verifies every claim.
            </p>
          </div>

          <Card>
            <CardContent className="space-y-8 p-6">
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Number of questions</div>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 5, 10].map(n => (
                    <Button key={n} variant="outline" size="lg" className="h-auto flex-col gap-0.5 py-4" onClick={() => startGame(n)}>
                      <span className="text-lg font-semibold">{n}</span>
                      <span className="text-xs font-normal text-muted-foreground">questions</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Council members</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MODEL_CONFIG).map(([id, config]) => {
                    const on = activeModels.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleModel(id)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                          on ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <ModelDot id={id} className={cn('size-2', !on && 'opacity-40')} />
                        {config.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Settings2 className="size-3.5" /> Model settings
                  <ChevronDown className={cn('size-3.5 transition-transform', showSettings && 'rotate-180')} />
                </button>

                {showSettings && modelOptions && (
                  <div className="mt-4 space-y-3">
                    {activeModels.map(id => {
                      const config = MODEL_CONFIG[id];
                      const options = modelOptions[id] || [];
                      if (options.length < 2) return null;
                      return (
                        <div key={id} className="flex items-center gap-3">
                          <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm">
                            <ModelDot id={id} className="size-2" /> {config.provider}
                          </span>
                          <select
                            value={modelSelections[id] || options[0]?.model}
                            onChange={(e) => setModelSelections(prev => ({ ...prev, [id]: e.target.value }))}
                            className="h-9 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {options.map(opt => (
                              <option key={opt.model} value={opt.model}>
                                {opt.label} — ${opt.input}/${opt.output} per MTok ({opt.tier})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}

                    <div className="flex flex-col items-center gap-2 pt-2">
                      <Button
                        variant={pricingStatus === 'done' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={handleResearchPricing}
                        disabled={pricingStatus === 'researching'}
                      >
                        {pricingStatus === 'researching' ? <><Loader2 className="size-3.5 animate-spin" /> Researching…</> :
                          pricingStatus === 'done' ? <><CircleCheck className="size-3.5 text-supported" /> Live pricing verified</> :
                          <><Sparkles className="size-3.5" /> Research live pricing</>}
                      </Button>
                      {pricingStatus === 'done' && livePricing?.research_notes && (
                        <p className="max-w-md text-center text-xs text-muted-foreground">{livePricing.research_notes}</p>
                      )}
                    </div>

                    {est && (
                      <div className="rounded-md border bg-muted/30 p-3 text-center">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Estimated cost per question</div>
                        <div className="font-mono text-lg text-primary">~${est.total.toFixed(4)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Ask ${est.ask.toFixed(4)} · Evaluate ${est.evaluate.toFixed(4)} · Swarm ~${est.shadow.toFixed(4)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </TooltipProvider>
    );
  }

  // ── Game Over Screen ──────────────────────────────
  if (phase === 'game_over') {
    const modelStats = {};
    activeModels.forEach(id => {
      const rounds = gameResults.filter(r => r.avgScores && r.avgScores[id] !== undefined);
      const avgOverall = rounds.length > 0 ? Math.round(rounds.reduce((sum, r) => sum + (r.avgScores[id] || 0), 0) / rounds.length) : 0;
      const wins = gameResults.filter(r => r.winner === id).length;
      modelStats[id] = { avgOverall, wins };
    });
    const sortedScores = Object.entries(runningScores).filter(([id]) => activeModels.includes(id)).sort(([, a], [, b]) => b - a);
    const breakdown = getCostBreakdown();

    return (
      <TooltipProvider delayDuration={200}>
        {Header}
        <main className="mx-auto max-w-3xl space-y-10 px-5 py-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Final results</h1>
            <p className="mt-1 text-sm text-muted-foreground">{gameResults.length} question{gameResults.length !== 1 ? 's' : ''} deliberated and verified</p>
          </div>

          <section className="space-y-3">
            <SectionLabel>Final rankings</SectionLabel>
            {sortedScores.map(([id, score], i) => {
              const config = MODEL_CONFIG[id];
              const stats = modelStats[id] || {};
              return (
                <motion.div key={id} {...fade} transition={{ ...fade.transition, delay: i * 0.05 }}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center font-mono text-sm text-muted-foreground">{i + 1}</span>
                        {i === 0 && <Trophy className="size-4 text-partial" />}
                        <ModelDot id={id} />
                        <span className="font-semibold">{config.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{stats.wins || 0} win{stats.wins !== 1 ? 's' : ''}</span>
                        <span>avg {stats.avgOverall || 0}/100</span>
                        <span className="font-mono text-base font-semibold text-foreground tabular-nums">{score} pts</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </section>

          <section>
            <SectionLabel hint="newest first">Question history</SectionLabel>
            <div className="space-y-2">
              {[...gameResults.entries()].reverse().map(([qi, r]) => {
                const isExpanded = expandedQuestion === qi;
                const winnerConfig = MODEL_CONFIG[r.winner];
                return (
                  <Card key={qi}>
                    <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setExpandedQuestion(isExpanded ? null : qi)}>
                      <span className="flex-1 truncate text-sm font-medium">Q{r.questionNum}: {r.question}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <ModelDot id={r.winner} className="size-2" />
                        <span className="text-muted-foreground">{winnerConfig?.short}</span>
                        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="space-y-4 border-t p-4">
                            {r.avgScores && (
                              <div className="flex flex-wrap gap-3">
                                {Object.entries(r.avgScores).sort(([, a], [, b]) => b - a).map(([id, avg]) => (
                                  <div key={id} className="flex items-center gap-1.5 text-sm">
                                    <ModelDot id={id} className="size-2" />
                                    <span>{MODEL_CONFIG[id]?.short}</span>
                                    <span className={cn('font-mono font-semibold tabular-nums', scoreTone(Math.round(avg)))}>{Math.round(avg)}</span>
                                    {id === r.winner && <Badge variant="muted">winner</Badge>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {r.answers?.length > 0 && (
                              <div className="grid gap-3 md:grid-cols-2">
                                {r.answers.map(a => (
                                  <AnswerCard key={a.id} id={a.id} name={a.name} provider={a.provider} latency={a.latency} answer={a.answer} status="done" />
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          </section>

          {sessionCost.calls > 0 && (
            <section>
              <SectionLabel>Session cost</SectionLabel>
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-8">
                    <Stat label="API calls" value={`${sessionCost.calls}${shadowCost?.calls ? ` + ${shadowCost.calls}` : ''}`} />
                    <Stat label="Total tokens" value={`${((sessionCost.totalInput + sessionCost.totalOutput + (shadowCost?.totalInput || 0) + (shadowCost?.totalOutput || 0)) / 1000).toFixed(1)}k`} />
                    <Stat label="Est. total" value={`$${breakdown.grandTotal.toFixed(4)}`} accent />
                    <Stat label="Per question" value={gameResults.length > 0 ? `$${(breakdown.grandTotal / gameResults.length).toFixed(4)}` : '—'} accent />
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(breakdown.byProvider).map(([provider, data]) => (
                      <div key={provider} className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                        <div className="text-muted-foreground">{provider}</div>
                        <div className="font-mono">${data.cost.toFixed(4)}</div>
                      </div>
                    ))}
                    {breakdown.shadowTotal > 0 && (
                      <div className="rounded-md border bg-primary/5 px-3 py-2 text-xs">
                        <div className="text-primary">Verification swarm</div>
                        <div className="font-mono">${breakdown.shadowTotal.toFixed(4)}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          <div className="flex justify-center">
            <Button size="lg" onClick={handleNewGame}><RefreshCw className="size-4" /> New game</Button>
          </div>
        </main>
      </TooltipProvider>
    );
  }

  // ── Main Game Flow ────────────────────────────────
  return (
    <TooltipProvider delayDuration={200}>
      {Header}

      {gameConfig && (
        <div className="border-b bg-muted/30" role="region" aria-label="Session progress">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Question {currentQuestionNum} of {gameConfig.totalQuestions}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {Object.entries(runningScores).filter(([id]) => activeModels.includes(id)).sort(([, a], [, b]) => b - a).map(([id, score], i) => (
                <span key={id} className={cn('flex items-center gap-1.5 text-xs', i === 0 && score > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  <ModelDot id={id} className="size-2" />
                  {MODEL_CONFIG[id].short}
                  <span className="font-mono tabular-nums">{score}</span>
                </span>
              ))}
            </div>
            {sessionCost.calls > 0 && (
              <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span>{sessionCost.calls} calls</span>
                <span>{((sessionCost.totalInput + sessionCost.totalOutput) / 1000).toFixed(1)}k tok</span>
                <span className="text-primary">~${getEstimatedCost()?.toFixed(4) || '…'}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        {/* Question input */}
        <Card>
          <CardContent className="p-4">
            <Textarea
              ref={textareaRef}
              placeholder="Ask The Council anything…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="min-h-0 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MODEL_CONFIG).map(([id, config]) => {
                  const on = activeModels.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleModel(id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        on ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <ModelDot id={id} className={cn('size-2', !on && 'opacity-40')} />
                      {config.short}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">⌘↵</span>
                <Button
                  onClick={handleAsk}
                  disabled={!question.trim() || activeModels.length === 0 || phase === 'asking' || phase === 'evaluating'}
                >
                  {phase === 'asking' ? <><Loader2 className="size-4 animate-spin" /> Responding…</> :
                    phase === 'evaluating' ? <><Loader2 className="size-4 animate-spin" /> Evaluating…</> :
                    <><Send className="size-4" /> Ask the Council</>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span className="flex items-center gap-2"><CircleX className="size-4" /> {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        )}

        {/* Round 1 */}
        {(answers.length > 0 || waiting.length > 0 || Object.keys(answerStream).length > 0) && (
          <section>
            <SectionLabel hint="web-search enabled">Round 1 — Independent answers</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              {activeModels.map(id => {
                const final = answers.find(a => a.id === id);
                const buf = answerStream[id];
                const isWaiting = waiting.includes(id);
                let status = 'waiting';
                if (final) status = final.status === 'error' ? 'error' : 'done';
                else if (buf?.answer) status = 'streaming';
                else if (!isWaiting && phase !== 'asking') status = 'waiting';
                const name = final?.name || MODEL_CONFIG[id]?.name;
                const provider = final?.provider || MODEL_CONFIG[id]?.provider;
                const modelStr = final?.model || modelSelections[id];
                const answerText = final ? (final.status === 'error' ? (final.error || 'Failed to respond') : final.answer) : (buf?.answer || '');
                return (
                  <AnswerCard
                    key={id}
                    id={id}
                    name={name}
                    provider={provider}
                    modelId={modelStr}
                    latency={final?.latency}
                    answer={answerText}
                    thinking={buf?.thinking}
                    status={status}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Convene CTA */}
        {phase === 'answered' && successfulAnswers.length >= 2 && (
          <motion.div {...fade}>
            <Card className="border-primary/30 bg-primary/[0.03]">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="max-w-xl text-sm text-muted-foreground">
                  Round 1 complete — {successfulAnswers.length} answers in. Convene the Council to peer-evaluate, pick a winner, and run the cross-vendor verification swarm.
                </p>
                <Button size="lg" onClick={handleEvaluate}>Convene the Council <ArrowRight className="size-4" /></Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Round 2 */}
        {phase === 'evaluating' && evaluations.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> The Council is evaluating responses…
          </div>
        )}
        {evaluations.length > 0 && (
          <section>
            <SectionLabel>Round 2 — Peer evaluation</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              {evaluations.map(ev => (
                <EvaluationCard key={ev.evaluator} evaluatorId={ev.evaluator} evaluation={ev.evaluation} />
              ))}
            </div>
          </section>
        )}

        {/* Consensus */}
        {consensus !== null && <ConsensusPanel consensus={consensus} />}

        {/* Round 3 — native parallel verification */}
        {verificationStatus && (answers.length > 0 || successfulAnswers.length > 0) && (
          <section>
            <SectionLabel>Round 3 — Verification swarm</SectionLabel>
            <NativeVerification
              questionText={question}
              epoch={verifyEpoch}
              onComplete={() => setVerificationStatus('complete')}
            />
          </section>
        )}

        {/* Verdict */}
        {phase === 'evaluated' && gameResults.length > 0 && (() => {
          const lastResult = gameResults[gameResults.length - 1];
          if (!lastResult) return null;
          const winningAnswer = lastResult.winner ? answers.find(a => a.id === lastResult.winner) : null;
          return (
            <VerdictHero
              winnerId={lastResult.winner}
              answer={winningAnswer?.answer}
              onNext={handleNextQuestion}
              nextLabel={gameConfig && currentQuestionNum >= gameConfig.totalQuestions ? 'View final results' : `Next question (${currentQuestionNum + 1}/${gameConfig?.totalQuestions || '?'})`}
            />
          );
        })()}
      </main>

      {/* Floating mid-game settings */}
      {modelOptions && (
        <div className="fixed bottom-5 left-5 z-40">
          <AnimatePresence>
            {showMidGameSettings && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="mb-3 w-80 rounded-xl border bg-popover p-4 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model settings</span>
                  <span className="font-mono text-[10px] text-muted-foreground">applies next round</span>
                </div>
                <div className="space-y-2.5">
                  {activeModels.map(id => {
                    const config = MODEL_CONFIG[id];
                    const options = modelOptions[id] || [];
                    if (options.length < 2) return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs">
                          <ModelDot id={id} className="size-2" /> {config.short}
                        </span>
                        <select
                          value={modelSelections[id] || options[0]?.model}
                          onChange={(e) => setModelSelections(prev => ({ ...prev, [id]: e.target.value }))}
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {options.map(opt => (
                            <option key={opt.model} value={opt.model}>{opt.label} ({opt.tier})</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" className="mt-3 w-full" onClick={applyMidGameSettings}>Apply changes</Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant={showMidGameSettings ? 'default' : 'outline'}
            size="icon"
            className="rounded-full shadow-md"
            onClick={() => setShowMidGameSettings(!showMidGameSettings)}
            aria-label="Model settings"
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      )}
    </TooltipProvider>
  );
}

// ── Shadow Window (optional pop-out dashboard, #/shadow) ─────

function ShadowWindow() {
  const [results, setResults] = useState([]);
  const [currentQ, setCurrentQ] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const channelRef = useRef(null);
  const currentQRef = useRef(null);

  const startVerification = useCallback(async (questionNum, question, answers) => {
    const qState = {
      questionNum, question, answers,
      claims: {}, crossRef: null, verifications: {}, verifyProgress: {},
      confidenceScores: null, disagreementResolutions: [], synthesis: null, status: 'verifying',
    };
    currentQRef.current = qState;
    setCurrentQ({ ...qState });

    try {
      const response = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question, answers }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const q = currentQRef.current;
            if (!q) continue;
            if (data.type === 'claims') q.claims = { ...q.claims, [data.modelId]: data.claims };
            if (data.type === 'cross_reference') q.crossRef = data.matrix;
            if (data.type === 'verification_progress') q.verifyProgress = { ...q.verifyProgress, [data.claimId]: data.status };
            if (data.type === 'verification') {
              q.verifications = { ...q.verifications, [data.claimId]: data.result };
              q.verifyProgress = { ...q.verifyProgress, [data.claimId]: 'done' };
            }
            if (data.type === 'confidence_scores') {
              q.confidenceScores = data.scores;
              channelRef.current?.postMessage({ type: 'verification_complete', confidenceScores: data.scores });
            }
            if (data.type === 'synthesis') q.synthesis = { answer: data.answer, citations: data.citations };
            if (data.type === 'complete') {
              q.status = 'complete';
              setResults(prev => [...prev, { ...q }]);
              setCurrentQ(null);
              currentQRef.current = null;
            } else {
              setCurrentQ({ ...q });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Shadow verification failed:', err);
      const q = currentQRef.current;
      if (q) {
        q.status = 'error';
        setResults(prev => [...prev, { ...q }]);
        setCurrentQ(null);
        currentQRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('the-council');
    channelRef.current.onmessage = (event) => {
      const { type, ...data } = event.data;
      if (type === 'game_start') {
        setTotalQuestions(data.totalQuestions);
        setResults([]);
        setCurrentQ(null);
        setGameComplete(false);
      }
      if (type === 'answers_ready') startVerification(data.questionNum, data.question, data.answers);
      if (type === 'game_over') setGameComplete(true);
    };
    channelRef.current.postMessage({ type: 'shadow_ready' });
    return () => channelRef.current?.close();
  }, [startVerification]);

  const completedCount = results.length;
  const inProgress = currentQ !== null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-bold tracking-tight">Verification Swarm</h1>
        <p className="text-sm text-muted-foreground">
          {gameComplete ? 'Final report' : inProgress ? 'Verifying…' : completedCount === 0 ? 'Standing by' : 'Awaiting next question'}
          {' · '}{completedCount} of {totalQuestions || '?'} verified
        </p>
      </header>
      <div className="space-y-2">
        {results.map((r, i) => {
          const totalClaims = Object.values(r.claims).flat().length;
          const verified = Object.values(r.verifications).filter(v => v.verdict === 'supported').length;
          return (
            <Card key={i}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <span className="truncate text-sm"><span className="font-mono text-xs text-primary">Q{r.questionNum}</span> {r.question}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><CircleCheck className="size-4 text-supported" /> {verified}/{totalClaims}</span>
              </CardContent>
            </Card>
          );
        })}
        {currentQ && (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <span className="truncate text-sm"><span className="font-mono text-xs text-primary">Q{currentQ.questionNum}</span> {currentQ.question}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                {Object.values(currentQ.verifyProgress).filter(s => s === 'done').length}/{Object.values(currentQ.claims).flat().length}
              </span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────

export default function App() {
  if (window.location.hash === '#/shadow') return <ShadowWindow />;
  return <MainApp />;
}
