const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const API_KEY_RE = /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|xai-[A-Za-z0-9_-]{12,})\b/g;
const SECRET_WORD_RE = /\b(password|api[_-]?key|secret|token|credential|private key)\b/gi;
const PROMPT_INJECTION_RE = /\b(ignore previous|system prompt|developer message|exfiltrate|reveal secrets|bypass|jailbreak)\b/gi;

export const TOOL_ALLOWLIST = Object.freeze([
  "load_fixture",
  "redact_input",
  "extract_claims",
  "verify_claims_against_fixture",
  "write_audit_report"
]);

export function redactSensitiveText(text) {
  return String(text ?? "")
    .replace(API_KEY_RE, "[REDACTED:api-key]")
    .replace(EMAIL_RE, "[REDACTED:email]")
    .replace(PHONE_RE, "[REDACTED:phone]");
}

export function classifyInputRisk(text) {
  const source = String(text ?? "");
  const warnings = [];

  if (API_KEY_RE.test(source)) warnings.push("possible API key");
  if (EMAIL_RE.test(source)) warnings.push("email address");
  if (PHONE_RE.test(source)) warnings.push("phone number");
  if (SECRET_WORD_RE.test(source)) warnings.push("secret-related wording");
  if (PROMPT_INJECTION_RE.test(source)) warnings.push("prompt-injection wording");

  API_KEY_RE.lastIndex = 0;
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  SECRET_WORD_RE.lastIndex = 0;
  PROMPT_INJECTION_RE.lastIndex = 0;

  return {
    level: warnings.length === 0 ? "low" : warnings.some((w) => w.includes("API key") || w.includes("prompt")) ? "high" : "medium",
    warnings,
    redactedPreview: redactSensitiveText(source).slice(0, 400)
  };
}
