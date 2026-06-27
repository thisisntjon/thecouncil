#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../lib/fixtureCouncil.mjs";

const PLACEHOLDER_VALUES = new Set([
  "",
  "your-anthropic-key-here",
  "your-openai-key-here",
  "your-google-key-here",
  "your-xai-key-here",
  "your-brave-search-key-here"
]);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function hasRealValue(env, key) {
  const value = env[key] || process.env[key] || "";
  return !PLACEHOLDER_VALUES.has(value.trim());
}

export function getLivePreflightStatus() {
  const rootEnv = readEnvFile(path.join(ROOT, ".env"));
  const serverEnv = readEnvFile(path.join(ROOT, "server", ".env"));
  const env = { ...rootEnv, ...serverEnv };

  const dependencies = [
    {
      name: "Live API dependencies",
      path: "server/node_modules",
      required: true,
      installed: fs.existsSync(path.join(ROOT, "server", "node_modules"))
    },
    {
      name: "React UI dependencies",
      path: "client/node_modules",
      required: true,
      installed: fs.existsSync(path.join(ROOT, "client", "node_modules"))
    },
    {
      name: "Optional Shadow Council dependencies",
      path: "shadow-council/node_modules",
      required: false,
      installed: fs.existsSync(path.join(ROOT, "shadow-council", "node_modules"))
    }
  ];

  const keys = [
    { key: "ANTHROPIC_API_KEY", label: "Anthropic / Claude", configured: hasRealValue(env, "ANTHROPIC_API_KEY") },
    { key: "OPENAI_API_KEY", label: "OpenAI / GPT", configured: hasRealValue(env, "OPENAI_API_KEY") },
    { key: "GOOGLE_API_KEY", label: "Google / Gemini", configured: hasRealValue(env, "GOOGLE_API_KEY") },
    { key: "XAI_API_KEY", label: "xAI / Grok", configured: hasRealValue(env, "XAI_API_KEY") },
    { key: "BRAVE_SEARCH_API_KEY", label: "Brave Search", configured: hasRealValue(env, "BRAVE_SEARCH_API_KEY"), optional: true }
  ];

  const missingRequiredDependencies = dependencies.filter((item) => item.required && !item.installed);
  const missingProviderKeys = keys.filter((item) => !item.optional && !item.configured);
  const configuredProviderKeys = keys.filter((item) => !item.optional && item.configured);

  return {
    okToStartShell: missingRequiredDependencies.length === 0,
    fullyConfigured: missingRequiredDependencies.length === 0 && missingProviderKeys.length === 0,
    onlineReady: missingRequiredDependencies.length === 0 && configuredProviderKeys.length > 0,
    dependencies,
    keys,
    missingRequiredDependencies,
    missingProviderKeys,
    configuredProviderKeys,
    commands: {
      install: "launch.bat install-ui",
      publicFixtureUi: "launch.bat ui",
      liveUi: "launch.bat ui-live"
    }
  };
}

export function formatLivePreflight(status) {
  const lines = [];
  lines.push("Live UI preflight");
  lines.push("");
  lines.push("Dependencies:");
  for (const item of status.dependencies) {
    const marker = item.installed ? "OK" : (item.required ? "MISSING" : "OPTIONAL MISSING");
    lines.push(`- ${marker}: ${item.name} (${item.path})`);
  }
  lines.push("");
  lines.push("Provider keys:");
  for (const item of status.keys) {
    const marker = item.configured ? "OK" : (item.optional ? "OPTIONAL MISSING" : "MISSING");
    lines.push(`- ${marker}: ${item.label} (${item.key})`);
  }
  lines.push("");
  if (!status.okToStartShell) {
    lines.push("Live UI cannot start yet. Run: launch.bat install-ui");
  } else if (status.onlineReady && !status.fullyConfigured) {
    const configured = status.configuredProviderKeys.map((item) => item.label).join(", ");
    const missing = status.missingProviderKeys.map((item) => item.label).join(", ");
    lines.push(`Live UI can start and online calls can run for: ${configured}.`);
    lines.push(`Missing providers will be unavailable until configured: ${missing}.`);
  } else if (!status.fullyConfigured) {
    lines.push("Live UI shell can start, but provider calls need local API keys.");
  } else {
    lines.push("Live UI appears ready to start.");
  }
  lines.push("Public fixture UI remains available with: launch.bat ui");
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const status = getLivePreflightStatus();
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(formatLivePreflight(status));
    }
    if (process.argv.includes("--strict") && !status.okToStartShell) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Live preflight failed to run.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
