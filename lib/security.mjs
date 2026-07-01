// Security boundary for the Council pipeline: redact-before-use, classify-before-run,
// and a frozen tool allowlist (least authority). Everything here is deliberately
// dependency-free, deterministic pattern matching — it runs identically offline in
// fixture mode and inline in the live server, with no network calls of its own.

// Redaction/detection patterns. Kept intentionally narrow and explainable: each regex
// targets one concrete leak shape rather than trying to be a general PII engine.
// EMAIL/PHONE cover the common accidental-paste cases (phone is NANP-style).
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
// Provider key prefixes actually used by this project's vendors:
// sk- (OpenAI/Anthropic style), AIza (Google), xai- (xAI).
const API_KEY_RE = /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|xai-[A-Za-z0-9_-]{12,})\b/g;
// These two only *flag* (raise the risk level); they never rewrite the text, because
// words like "password" or "bypass" are legitimate in many questions.
const SECRET_WORD_RE = /\b(password|api[_-]?key|secret|token|credential|private key)\b/gi;
const PROMPT_INJECTION_RE = /\b(ignore previous|system prompt|developer message|exfiltrate|reveal secrets|bypass|jailbreak)\b/gi;

// Least-authority contract: the fixture pipeline may only use these read-only/report
// tools. Frozen so nothing can widen the list at runtime; every audit trail embeds it.
export const TOOL_ALLOWLIST = Object.freeze([
  "load_fixture",
  "redact_input",
  "extract_claims",
  "verify_claims_against_fixture",
  "write_audit_report"
]);

// Rewrite sensitive spans with typed placeholders. Order matters: API keys first, so a
// key is never partially consumed by the looser email/phone patterns.
export function redactSensitiveText(text) {
  return String(text ?? "")
    .replace(API_KEY_RE, "[REDACTED:api-key]")
    .replace(EMAIL_RE, "[REDACTED:email]")
    .replace(PHONE_RE, "[REDACTED:phone]");
}

// Classify input risk before the pipeline runs. Returns a level + human-readable
// warnings + a redacted preview safe to embed in reports and logs.
export function classifyInputRisk(text) {
  const source = String(text ?? "");
  const warnings = [];

  if (API_KEY_RE.test(source)) warnings.push("possible API key");
  if (EMAIL_RE.test(source)) warnings.push("email address");
  if (PHONE_RE.test(source)) warnings.push("phone number");
  if (SECRET_WORD_RE.test(source)) warnings.push("secret-related wording");
  if (PROMPT_INJECTION_RE.test(source)) warnings.push("prompt-injection wording");

  // Gotcha: /g regexes are stateful — .test() advances lastIndex, so without this
  // reset the *next* call to classifyInputRisk would start matching mid-string and
  // silently miss real hits. Reset all of them before returning.
  API_KEY_RE.lastIndex = 0;
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  SECRET_WORD_RE.lastIndex = 0;
  PROMPT_INJECTION_RE.lastIndex = 0;

  return {
    // Severity heuristic: credential exposure or injection attempts are "high"
    // (actively dangerous); other PII is "medium"; clean input is "low".
    level: warnings.length === 0 ? "low" : warnings.some((w) => w.includes("API key") || w.includes("prompt")) ? "high" : "medium",
    warnings,
    redactedPreview: redactSensitiveText(source).slice(0, 400)
  };
}
