// Provider API-key normalization.
//
// Some local .env files name a provider key differently than the SDK expects
// (e.g. xAI's SDK reads XAI_API_KEY, but a .env may store it as GROK_API_KEY).
// Rather than edit secret files, we accept common aliases in code so an existing
// environment "just works". No secret values are ever logged here.

// canonical name -> list of accepted env var names (canonical first).
export const KEY_ALIASES = {
  XAI_API_KEY: ["XAI_API_KEY", "GROK_API_KEY"],
};

// Mutate an environment map (default process.env) so every downstream
// `env.XAI_API_KEY` read resolves, even when only an alias is set.
export function normalizeProviderKeys(env = process.env) {
  for (const [canonical, names] of Object.entries(KEY_ALIASES)) {
    if (env[canonical]) continue;
    const alias = names.find((name) => env[name]);
    if (alias) env[canonical] = env[alias];
  }
  return env;
}

// Resolve a canonical key from a plain object (e.g. a parsed .env), honoring aliases.
export function resolveKey(envObj, canonical) {
  const names = KEY_ALIASES[canonical] || [canonical];
  for (const name of names) {
    if (envObj[name]) return envObj[name];
  }
  return envObj[canonical];
}
