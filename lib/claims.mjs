// lib/claims.mjs — shared claim classification for the verification swarm.
//
// "The Council" verifies claims against EVIDENCE (web / knowledge). That's right for
// factual claims, but wrong for reasoning/logic/math claims whose correctness is logical
// validity, not external corroboration — those were scoring 0 confidence even when correct.
// This classifier routes reasoning claims to a re-derivation verifier instead of evidence
// lookup. Category-based only (no fragile text heuristic) so factual claims are never
// mis-routed away from evidence verification.

// Claim categories that should be verified by re-derivation, not evidence lookup.
export const REASONING_CATEGORIES = new Set(["computation", "logical_deduction", "derivation"]);

// True when a claim's correctness is a matter of logical/mathematical validity rather than
// external fact. Decided by the extractor-assigned `category`.
export function isReasoningClaim(claim) {
  return Boolean(claim) && REASONING_CATEGORIES.has(claim.category);
}

// The model that authored a claim, derived from its id (e.g. "gpt-3" -> "gpt"). Used to pick
// an INDEPENDENT verifier (not the author) so reasoning verification isn't self-grading.
export function claimAuthorId(claim) {
  const id = claim?.id;
  if (typeof id !== "string") return null;
  const dash = id.indexOf("-");
  return dash > 0 ? id.slice(0, dash) : null;
}
