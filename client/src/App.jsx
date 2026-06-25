import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

// ── Constants ───────────────────────────────────────────────

const MODEL_CONFIG = {
  claude: { name: 'Sonnet 4.6', provider: 'Anthropic', color: '#F59E0B', glow: '#F59E0B55', icon: '🟠' },
  gpt: { name: 'GPT-5.2', provider: 'OpenAI', color: '#10B981', glow: '#10B98155', icon: '🟢' },
  gemini: { name: 'Gemini 3', provider: 'Google', color: '#3B82F6', glow: '#3B82F655', icon: '🔵' },
  grok: { name: 'Grok 4.1', provider: 'xAI', color: '#EF4444', glow: '#EF444455', icon: '🔴' },
};

const API_BASE = '/api';

// ── Styles ──────────────────────────────────────────────────

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-deep: #0a0a0f;
    --bg-panel: #12121a;
    --bg-card: #1a1a2e;
    --border: #2a2a3e;
    --border-bright: #3a3a5e;
    --text: #e0e0f0;
    --text-dim: #8888aa;
    --text-bright: #ffffff;
    --accent: #f0c040;
    --accent-glow: #f0c04055;
    --neon-pink: #ff2d95;
    --neon-cyan: #00f0ff;
    --neon-green: #39ff14;
    --neon-purple: #b44aff;
  }

  body {
    background: var(--bg-deep);
    color: var(--text);
    font-family: 'Rajdhani', sans-serif;
    overflow-x: hidden;
    min-height: 100vh;
  }

  /* Scanline overlay */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    background: repeating-linear-gradient(
      transparent,
      transparent 2px,
      rgba(0,0,0,0.04) 2px,
      rgba(0,0,0,0.04) 4px
    );
  }

  /* ── Animations ──────────────────────────────────── */
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes slotReveal {
    0% { opacity: 0; transform: rotateX(-90deg) scale(0.8); filter: blur(8px); }
    50% { opacity: 0.7; transform: rotateX(10deg) scale(1.02); filter: blur(2px); }
    70% { transform: rotateX(-3deg) scale(1); filter: blur(0); }
    100% { opacity: 1; transform: rotateX(0) scale(1); filter: blur(0); }
  }

  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px var(--glow-color, #f0c04033); }
    50% { box-shadow: 0 0 40px var(--glow-color, #f0c04066), 0 0 80px var(--glow-color, #f0c04022); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes borderChase {
    0% { background-position: 0% 0%; }
    100% { background-position: 300% 0%; }
  }

  @keyframes floatUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scoreSlam {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.4); }
    80% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes typing {
    0%, 60% { opacity: 1; }
    61%, 100% { opacity: 0.3; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.05); }
  }

  @keyframes neonFlicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
    20%, 24%, 55% { opacity: 0.6; }
  }

  /* ── Header ──────────────────────────────────────── */

  .header {
    text-align: center;
    padding: 32px 20px 20px;
    position: relative;
  }

  .header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--neon-cyan), var(--accent), var(--neon-pink), transparent);
    animation: shimmer 3s linear infinite;
    background-size: 200% 100%;
  }

  .title {
    font-family: 'Orbitron', sans-serif;
    font-size: 3.2rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    background: linear-gradient(135deg, var(--accent), #fff, var(--accent));
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s ease infinite;
    text-shadow: none;
    filter: drop-shadow(0 0 30px var(--accent-glow));
    line-height: 1.2;
  }

  .subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--text-dim);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin-top: 8px;
  }

  /* ── Input Area ──────────────────────────────────── */

  .input-section {
    max-width: 900px;
    margin: 24px auto;
    padding: 0 20px;
  }

  .input-wrapper {
    position: relative;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .input-wrapper:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 30px var(--accent-glow), inset 0 0 30px rgba(240, 192, 64, 0.03);
  }

  .question-input {
    width: 100%;
    background: transparent;
    border: none;
    padding: 20px 24px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.05rem;
    color: var(--text-bright);
    outline: none;
    resize: none;
    min-height: 60px;
    max-height: 200px;
  }

  .question-input::placeholder {
    color: var(--text-dim);
    font-style: italic;
  }

  .input-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--border);
    background: rgba(0,0,0,0.2);
  }

  .model-toggles {
    display: flex;
    gap: 8px;
  }

  .model-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .model-toggle.active {
    border-color: var(--toggle-color);
    color: var(--toggle-color);
    background: color-mix(in srgb, var(--toggle-color) 10%, transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--toggle-color) 20%, transparent);
  }

  .submit-btn {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 10px 28px;
    border: 2px solid var(--accent);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05));
    color: var(--accent);
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
  }

  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(240,192,64,0.3), rgba(240,192,64,0.1));
    box-shadow: 0 0 30px var(--accent-glow);
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Results Arena ───────────────────────────────── */

  .arena {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px 40px;
  }

  .round-header {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    text-align: center;
    margin: 32px 0 20px;
    color: var(--text-dim);
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .round-header::before,
  .round-header::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-bright), transparent);
  }

  .round-header .round-label {
    white-space: nowrap;
  }

  /* ── Answer Cards ────────────────────────────────── */

  .answers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .answer-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    animation: slotReveal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
    --glow-color: var(--card-glow);
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .answer-card:hover {
    border-color: var(--card-color, var(--border-bright));
    box-shadow: 0 0 20px var(--card-glow, transparent);
  }

  .answer-card.waiting {
    animation: none;
    opacity: 1;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(0,0,0,0.3);
  }

  .model-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .model-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--card-color);
    box-shadow: 0 0 8px var(--card-color);
  }

  .model-name {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--card-color);
    letter-spacing: 0.08em;
  }

  .model-provider {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .latency-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-dim);
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255,255,255,0.05);
  }

  .card-body {
    padding: 16px;
    font-size: 0.92rem;
    line-height: 1.65;
    max-height: 350px;
    overflow-y: auto;
  }

  .card-body::-webkit-scrollbar {
    width: 4px;
  }

  .card-body::-webkit-scrollbar-thumb {
    background: var(--border-bright);
    border-radius: 4px;
  }

  .card-body p { margin-bottom: 10px; }
  .card-body p:last-child { margin-bottom: 0; }
  .card-body code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82em;
    background: rgba(255,255,255,0.06);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .card-body pre {
    background: rgba(0,0,0,0.4);
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    margin: 10px 0;
  }
  .card-body pre code {
    background: none;
    padding: 0;
  }
  .card-body ul, .card-body ol {
    padding-left: 1.5em;
    margin: 8px 0;
  }
  .card-body li { margin-bottom: 4px; }
  .card-body strong { color: var(--text-bright); }
  .card-body h1, .card-body h2, .card-body h3 {
    font-family: 'Orbitron', sans-serif;
    color: var(--text-bright);
    margin: 14px 0 8px;
    font-size: 0.95rem;
  }

  /* Waiting state */
  .waiting-content {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-dim);
    font-style: italic;
    padding: 20px 0;
  }

  .waiting-dots span {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: var(--card-color, var(--text-dim));
    border-radius: 50%;
    margin: 0 2px;
    animation: typing 1.4s infinite;
  }
  .waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
  .waiting-dots span:nth-child(3) { animation-delay: 0.4s; }

  /* ── Council Button ──────────────────────────────── */

  .council-section {
    text-align: center;
    margin: 36px 0;
    animation: floatUp 0.6s ease;
  }

  .council-btn {
    font-family: 'Orbitron', sans-serif;
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    padding: 16px 48px;
    border: 2px solid var(--neon-cyan);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(0,240,255,0.1), rgba(180,74,255,0.1));
    color: var(--neon-cyan);
    cursor: pointer;
    text-transform: uppercase;
    position: relative;
    overflow: hidden;
    transition: all 0.4s;
  }

  .council-btn::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink), var(--neon-cyan));
    background-size: 300% 100%;
    animation: borderChase 3s linear infinite;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .council-btn:hover::before {
    opacity: 1;
  }

  .council-btn:hover {
    background: linear-gradient(135deg, rgba(0,240,255,0.2), rgba(180,74,255,0.2));
    box-shadow: 0 0 40px rgba(0,240,255,0.3), 0 0 80px rgba(180,74,255,0.15);
    transform: translateY(-2px);
  }

  .council-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .council-btn:disabled::before { display: none; }

  /* ── Evaluation Cards ────────────────────────────── */

  .eval-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }

  .eval-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .eval-card-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(0,0,0,0.3);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--card-color);
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .eval-card-header .judge-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    background: rgba(255,255,255,0.05);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .eval-ratings {
    padding: 12px 16px;
  }

  .eval-rating-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .eval-rating-row:last-child { border-bottom: none; }

  .eval-target-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    font-weight: 600;
    width: 70px;
    flex-shrink: 0;
    color: var(--target-color);
  }

  .eval-score-container {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .eval-score {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--text-bright);
    animation: scoreSlam 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    min-width: 48px;
    text-align: right;
  }

  .eval-score.high { color: var(--neon-green); }
  .eval-score.medium { color: var(--accent); }
  .eval-score.low { color: var(--neon-pink); }

  .eval-bar-track {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
  }

  .eval-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    background: var(--bar-color);
    box-shadow: 0 0 8px var(--bar-color);
  }

  .eval-reasoning {
    font-size: 0.78rem;
    color: var(--text-dim);
    margin-top: 4px;
    line-height: 1.4;
  }

  .eval-meta {
    display: flex;
    gap: 12px;
    margin-top: 2px;
  }

  .eval-strength, .eval-weakness {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .eval-strength {
    background: rgba(57, 255, 20, 0.1);
    color: var(--neon-green);
    border: 1px solid rgba(57, 255, 20, 0.2);
  }

  .eval-weakness {
    background: rgba(255, 45, 149, 0.1);
    color: var(--neon-pink);
    border: 1px solid rgba(255, 45, 149, 0.2);
  }

  .eval-reflection {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: rgba(0,0,0,0.15);
    font-size: 0.82rem;
    color: var(--text-dim);
    line-height: 1.5;
    font-style: italic;
  }

  .eval-reflection .changed-mind {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    font-style: normal;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .eval-reflection .changed-mind.yes {
    background: rgba(0,240,255,0.1);
    color: var(--neon-cyan);
    border: 1px solid rgba(0,240,255,0.3);
  }

  .eval-reflection .changed-mind.no {
    background: rgba(255,255,255,0.05);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }

  /* ── Error Banner ───────────────────────────────── */

  .error-banner {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 16px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    animation: slideDown 0.3s ease;
  }

  .error-banner-text {
    color: #f87171;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }

  .error-banner-close {
    background: none;
    border: none;
    color: #f87171;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .error-banner-close:hover { opacity: 1; }

  /* ── Consensus Score ─────────────────────────────── */

  .consensus-section {
    text-align: center;
    margin: 32px 0 16px;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .consensus-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: var(--text-dim);
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .consensus-score {
    font-family: 'Orbitron', sans-serif;
    font-size: 3.5rem;
    font-weight: 900;
    animation: scoreSlam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .consensus-score.high { color: var(--neon-green); text-shadow: 0 0 40px rgba(57,255,20,0.4); }
  .consensus-score.medium { color: var(--accent); text-shadow: 0 0 40px var(--accent-glow); }
  .consensus-score.low { color: var(--neon-pink); text-shadow: 0 0 40px rgba(255,45,149,0.4); }

  .consensus-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-top: 6px;
  }

  /* ── History ─────────────────────────────────────── */

  .history-section {
    max-width: 900px;
    margin: 40px auto 0;
    padding: 0 20px;
  }

  .history-header {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.8rem;
    color: var(--text-dim);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .history-item {
    padding: 10px 16px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .history-item:hover {
    border-color: var(--accent);
    background: rgba(240,192,64,0.03);
  }

  .history-question {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82rem;
    color: var(--text);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-consensus {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    margin-left: 16px;
  }

  /* ── Error State ─────────────────────────────────── */

  .error-badge {
    background: rgba(239,68,68,0.15);
    border: 1px solid rgba(239,68,68,0.3);
    color: #EF4444;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
  }

  /* ── Setup Screen ────────────────────────────────── */

  .setup-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .setup-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    width: 90%;
    margin-top: 32px;
  }

  .setup-btn {
    background: var(--bg-panel);
    border: 1px solid var(--border-bright);
    color: var(--accent);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .setup-btn:hover {
    background: rgba(240, 192, 64, 0.1);
    border-color: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
  }

  /* ── Scoreboard ────────────────────────────────── */

  .scoreboard-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    background: linear-gradient(90deg, var(--bg-deep), rgba(240,192,64,0.03), var(--bg-deep));
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-top: 8px;
  }

  .scoreboard-question-num {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.75rem;
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .scoreboard-scores {
    display: flex;
    gap: 16px;
  }

  .scoreboard-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    transition: all 0.3s;
  }
  .scoreboard-entry.leader {
    filter: brightness(1.2);
  }

  .scoreboard-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .scoreboard-name {
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }

  .scoreboard-pts {
    color: var(--text-bright);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.8rem;
    min-width: 20px;
    text-align: right;
  }

  /* ── Game Layout ────────────────────────────────── */

  .game-layout {
    display: flex;
    min-height: calc(100vh - 140px);
  }

  .game-sidebar {
    width: 260px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .game-main {
    flex: 1;
    min-width: 0;
  }

  .sidebar-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .sidebar-item:hover {
    border-color: var(--border-bright);
  }
  .sidebar-item.expanded {
    border-color: var(--accent);
  }

  .sidebar-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* ── Phase Indicator ───────────────────────────── */

  .phase-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--text-dim);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
  }

  /* ── Verification Swarm ─────────────────────────── */

  .verify-btn {
    font-family: 'Orbitron', sans-serif;
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    padding: 16px 48px;
    border: 2px solid var(--neon-green);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(57,255,20,0.1), rgba(240,192,64,0.1));
    color: var(--neon-green);
    cursor: pointer;
    text-transform: uppercase;
    position: relative;
    overflow: hidden;
    transition: all 0.4s;
  }

  .verify-btn::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--neon-green), var(--accent), var(--neon-cyan), var(--neon-green));
    background-size: 300% 100%;
    animation: borderChase 3s linear infinite;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .verify-btn:hover::before { opacity: 1; }

  .verify-btn:hover {
    background: linear-gradient(135deg, rgba(57,255,20,0.2), rgba(240,192,64,0.2));
    box-shadow: 0 0 40px rgba(57,255,20,0.3), 0 0 80px rgba(240,192,64,0.15);
    transform: translateY(-2px);
  }

  .verify-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .verify-btn:disabled::before { display: none; }

  /* Progress Dashboard */
  .verify-progress {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin: 16px 0;
    animation: floatUp 0.5s ease;
  }

  .verify-progress-header {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--neon-green);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .verify-progress-bar-track {
    height: 8px;
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .verify-progress-bar-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan));
    box-shadow: 0 0 12px rgba(57,255,20,0.5);
    transition: width 0.4s ease;
  }

  .agent-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  @keyframes agentPulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.4); opacity: 1; }
  }

  .agent-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--border-bright);
    transition: all 0.3s;
    position: relative;
  }

  .agent-dot.searching {
    background: var(--neon-cyan);
    box-shadow: 0 0 8px var(--neon-cyan);
    animation: agentPulse 1s ease infinite;
  }

  .agent-dot.analyzing {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
    animation: agentPulse 0.8s ease infinite;
  }

  .agent-dot.supported {
    background: var(--neon-green);
    box-shadow: 0 0 6px var(--neon-green);
  }

  .agent-dot.refuted {
    background: var(--neon-pink);
    box-shadow: 0 0 6px var(--neon-pink);
  }

  .agent-dot.partially_supported {
    background: var(--neon-cyan);
    box-shadow: 0 0 6px var(--neon-cyan);
  }

  .agent-dot.unverifiable {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
  }

  /* Cross-Reference Matrix */
  .cross-ref-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin: 16px 0;
  }

  .cross-ref-group {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .cross-ref-group-header {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(0,0,0,0.3);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cross-ref-group-header.agreed { color: var(--neon-green); }
  .cross-ref-group-header.disagreed { color: var(--neon-pink); }
  .cross-ref-group-header.unique { color: var(--accent); }

  .cross-ref-item {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .cross-ref-item:last-child { border-bottom: none; }

  .cross-ref-models {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .cross-ref-model-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .severity-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .severity-tag.major { background: rgba(255,45,149,0.15); color: var(--neon-pink); }
  .severity-tag.moderate { background: rgba(240,192,64,0.15); color: var(--accent); }
  .severity-tag.minor { background: rgba(255,255,255,0.06); color: var(--text-dim); }

  /* Claim Cards */
  .claims-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin: 16px 0;
  }

  .claim-model-group {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .claim-model-header {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(0,0,0,0.3);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .claim-item {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .claim-item:last-child { border-bottom: none; }

  .claim-text { color: var(--text); margin-bottom: 6px; }

  .verdict-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .verdict-badge.supported {
    background: rgba(57,255,20,0.12);
    color: var(--neon-green);
    border: 1px solid rgba(57,255,20,0.25);
  }

  .verdict-badge.refuted {
    background: rgba(255,45,149,0.12);
    color: var(--neon-pink);
    border: 1px solid rgba(255,45,149,0.25);
  }

  .verdict-badge.partially_supported {
    background: rgba(0,240,255,0.12);
    color: var(--neon-cyan);
    border: 1px solid rgba(0,240,255,0.25);
  }

  .verdict-badge.unverifiable {
    background: rgba(240,192,64,0.12);
    color: var(--accent);
    border: 1px solid rgba(240,192,64,0.25);
  }

  .verdict-badge.pending {
    background: rgba(255,255,255,0.05);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }

  .claim-sources {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .source-link {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--neon-cyan);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-link:hover { color: var(--text-bright); text-shadow: 0 0 8px var(--neon-cyan); }

  /* Disagreement Resolution */
  .disagreement-card {
    background: var(--bg-card);
    border: 1px solid rgba(255,45,149,0.3);
    border-radius: 12px;
    overflow: hidden;
    margin: 8px 0;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .disagreement-header {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(255,45,149,0.05);
    font-family: 'Orbitron', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--neon-pink);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .disagreement-body {
    padding: 12px 16px;
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--text);
  }

  .disagreement-verdict {
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(57,255,20,0.06);
    border: 1px solid rgba(57,255,20,0.15);
    border-radius: 6px;
    font-size: 0.82rem;
    color: var(--neon-green);
  }

  /* Confidence Scores */
  .confidence-section {
    margin: 16px 0;
    animation: floatUp 0.5s ease forwards;
    opacity: 0;
  }

  .confidence-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .confidence-model-name {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    width: 90px;
    flex-shrink: 0;
  }

  .confidence-score-value {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.2rem;
    font-weight: 900;
    min-width: 55px;
    text-align: right;
    animation: scoreSlam 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .confidence-bar-track {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 0 8px var(--bar-color);
  }

  .confidence-detail {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--text-dim);
    min-width: 120px;
    text-align: right;
  }

  /* Synthesis Card */
  .synthesis-card {
    background: var(--bg-card);
    border: 2px solid var(--accent);
    border-radius: 12px;
    overflow: hidden;
    margin: 16px 0;
    animation: slotReveal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
    box-shadow: 0 0 30px var(--accent-glow);
  }

  .synthesis-header {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, rgba(240,192,64,0.1), rgba(0,240,255,0.05));
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    color: var(--accent);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .synthesis-body {
    padding: 20px;
    font-size: 0.92rem;
    line-height: 1.7;
  }

  .synthesis-body p { margin-bottom: 12px; }
  .synthesis-body p:last-child { margin-bottom: 0; }

  .synthesis-citations {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    background: rgba(0,0,0,0.2);
  }

  .synthesis-citations-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.7rem;
    color: var(--text-dim);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .citation-item {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-dim);
    padding: 3px 0;
    display: flex;
    gap: 6px;
  }

  .citation-index {
    color: var(--neon-cyan);
    font-weight: 700;
    flex-shrink: 0;
  }

  /* Export */
  .export-section {
    text-align: center;
    margin: 24px 0;
    animation: floatUp 0.5s ease;
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .export-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    padding: 10px 24px;
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    background: var(--bg-panel);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .export-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(240,192,64,0.05);
    box-shadow: 0 0 15px var(--accent-glow);
  }

  /* Unique Claim Warning */
  .unique-claim-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255,45,149,0.08);
    border: 1px solid rgba(255,45,149,0.2);
    border-radius: 6px;
    margin: 4px 0;
    font-size: 0.78rem;
    color: var(--neon-pink);
  }

  /* ── Responsive ──────────────────────────────────── */

  @media (max-width: 768px) {
    .title { font-size: 2rem; }
    .answers-grid, .eval-grid, .claims-grid, .cross-ref-section { grid-template-columns: 1fr; }
    .input-actions { flex-direction: column; gap: 12px; }
    .model-toggles { flex-wrap: wrap; justify-content: center; }
    .confidence-row { flex-wrap: wrap; }
    .confidence-detail { min-width: auto; text-align: left; }
  }
`;

// ── Components ──────────────────────────────────────────────

function WaitingCard({ modelId }) {
  const config = MODEL_CONFIG[modelId];
  return (
    <div
      className="answer-card waiting"
      style={{ '--card-color': config.color, '--card-glow': config.glow }}
    >
      <div className="card-header">
        <div className="model-badge">
          <div className="model-dot" />
          <div>
            <div className="model-name">{config.name}</div>
            <div className="model-provider">{config.provider}</div>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="waiting-content">
          <div className="waiting-dots">
            <span /><span /><span />
          </div>
          <span>Deliberating...</span>
        </div>
      </div>
    </div>
  );
}

function AnswerCard({ result, index }) {
  const config = MODEL_CONFIG[result.id];
  return (
    <div
      className="answer-card"
      style={{
        '--card-color': config.color,
        '--card-glow': config.glow,
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="card-header">
        <div className="model-badge">
          <div className="model-dot" />
          <div>
            <div className="model-name">{config.name}</div>
            <div className="model-provider">{config.provider}</div>
          </div>
        </div>
        {result.latency && (
          <div className="latency-badge">{(result.latency / 1000).toFixed(1)}s</div>
        )}
      </div>
      <div className="card-body">
        {result.status === 'error' ? (
          <div className="error-badge">⚠ {result.error || 'Failed to respond'}</div>
        ) : (
          <ReactMarkdown>{result.answer || ''}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function EvaluationCard({ evaluatorId, evaluation, index }) {
  const config = MODEL_CONFIG[evaluatorId];
  if (!evaluation) return null;

  const ratings = evaluation.ratings || [];

  return (
    <div
      className="eval-card"
      style={{
        '--card-color': config.color,
        animationDelay: `${index * 0.15}s`,
      }}
    >
      <div className="eval-card-header">
        <div className="model-dot" style={{ width: 8, height: 8, background: config.color, boxShadow: `0 0 6px ${config.color}`, borderRadius: '50%' }} />
        {config.name}
        <span className="judge-label">Judge</span>
      </div>
      <div className="eval-ratings">
        {ratings.map((r, i) => {
          const targetConfig = MODEL_CONFIG[r.model_id] || {};
          const score = r.score || 0;
          const scoreClass = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
          const barColor = score >= 80 ? 'var(--neon-green)' : score >= 50 ? 'var(--accent)' : 'var(--neon-pink)';
          return (
            <div key={i} className="eval-rating-row">
              <div className="eval-target-name" style={{ '--target-color': targetConfig.color || 'var(--text)' }}>
                {targetConfig.name || r.model_id}
              </div>
              <div className="eval-score-container">
                <div className={`eval-score ${scoreClass}`}>{score}</div>
                <div className="eval-bar-track">
                  <div className="eval-bar-fill" style={{ width: `${score}%`, '--bar-color': barColor }} />
                </div>
              </div>
              <div style={{ flex: '0 0 auto', maxWidth: '45%' }}>
                <div className="eval-reasoning">{r.reasoning}</div>
                <div className="eval-meta">
                  {r.strength && r.strength !== 'none' && (
                    <span className="eval-strength">✦ {r.strength}</span>
                  )}
                  {r.weakness && r.weakness !== 'none' && (
                    <span className="eval-weakness">✧ {r.weakness}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {evaluation.reflection && (
        <div className="eval-reflection">
          "{evaluation.reflection}"
          {evaluation.would_change !== undefined && (
            <div>
              <span className={`changed-mind ${evaluation.would_change ? 'yes' : 'no'}`}>
                {evaluation.would_change ? '↻ WOULD REVISE ANSWER' : '✓ STANDS BY ANSWER'}
              </span>
            </div>
          )}
          {evaluation.would_change && evaluation.revised_position && (
            <div style={{ marginTop: 8, fontStyle: 'normal', color: 'var(--neon-cyan)', fontSize: '0.78rem' }}>
              Revised: {evaluation.revised_position}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Verification Swarm Components ────────────────────────────

function VerificationProgress({ claims, verifyProgress, verifications }) {
  const allClaimIds = Object.values(claims).flat().map(c => c.id);
  const total = allClaimIds.length;
  if (total === 0) return null;

  const done = allClaimIds.filter(id => verifications[id]).length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="verify-progress">
      <div className="verify-progress-header">
        Verification Swarm Active — {done}/{total} claims verified ({pct}%)
      </div>
      <div className="verify-progress-bar-track">
        <div className="verify-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="agent-grid">
        {allClaimIds.map(id => {
          const progress = verifyProgress[id];
          const verification = verifications[id];
          let status = 'pending';
          if (verification) status = verification.verdict;
          else if (progress) status = progress;
          return <div key={id} className={`agent-dot ${status}`} title={id} />;
        })}
      </div>
    </div>
  );
}

function CrossReferenceMatrix({ crossRef }) {
  if (!crossRef) return null;
  const { agreed = [], disagreed = [], unique = [] } = crossRef;

  return (
    <div className="cross-ref-section">
      {agreed.length > 0 && (
        <div className="cross-ref-group" style={{ animationDelay: '0s' }}>
          <div className="cross-ref-group-header agreed">
            Agreed ({agreed.length})
          </div>
          {agreed.map((item, i) => (
            <div key={i} className="cross-ref-item">
              <div className="claim-text">{item.claimText}</div>
              <div className="cross-ref-models">
                {(item.models || []).map(m => (
                  <span key={m} className="cross-ref-model-tag" style={{ color: MODEL_CONFIG[m]?.color }}>
                    {MODEL_CONFIG[m]?.name || m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {disagreed.length > 0 && (
        <div className="cross-ref-group" style={{ animationDelay: '0.1s' }}>
          <div className="cross-ref-group-header disagreed">
            Disagreed ({disagreed.length})
          </div>
          {disagreed.map((item, i) => (
            <div key={i} className="cross-ref-item">
              <div className="claim-text">{item.topic}</div>
              {Object.entries(item.positions || {}).map(([m, pos]) => (
                <div key={m} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  <span style={{ color: MODEL_CONFIG[m]?.color }}>{MODEL_CONFIG[m]?.name || m}</span>: {pos}
                </div>
              ))}
              {item.severity && (
                <span className={`severity-tag ${item.severity}`} style={{ marginTop: 4, display: 'inline-block' }}>
                  {item.severity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {unique.length > 0 && (
        <div className="cross-ref-group" style={{ animationDelay: '0.2s' }}>
          <div className="cross-ref-group-header unique">
            Unique ({unique.length})
          </div>
          {unique.map((item, i) => (
            <div key={i} className="cross-ref-item">
              <div className="claim-text">{item.claimText}</div>
              <div className="cross-ref-models">
                <span className="cross-ref-model-tag" style={{ color: MODEL_CONFIG[item.model]?.color }}>
                  {MODEL_CONFIG[item.model]?.name || item.model} only
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimModelGroup({ modelId, claims, verifications, index }) {
  const config = MODEL_CONFIG[modelId];
  if (!config || !claims || claims.length === 0) return null;

  const verified = claims.filter(c => verifications[c.id]?.verdict === 'supported').length;
  const total = claims.length;

  return (
    <div className="claim-model-group" style={{ '--card-color': config.color, animationDelay: `${index * 0.1}s` }}>
      <div className="claim-model-header">
        <span style={{ color: config.color }}>{config.name}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'var(--text-dim)' }}>
          {verified}/{total} verified
        </span>
      </div>
      {claims.map((claim) => {
        const v = verifications[claim.id];
        const verdict = v?.verdict || 'pending';
        return (
          <div key={claim.id} className="claim-item">
            <div className="claim-text">{claim.text}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`verdict-badge ${verdict}`}>
                {verdict === 'supported' ? '✓ Supported' :
                 verdict === 'refuted' ? '✗ Refuted' :
                 verdict === 'partially_supported' ? '~ Partial' :
                 verdict === 'unverifiable' ? '? Unverifiable' : '… Pending'}
              </span>
              {v?.confidence > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  {Math.round(v.confidence * 100)}% confidence
                </span>
              )}
            </div>
            {v?.reasoning && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                {v.reasoning}
              </div>
            )}
            {v?.sources && v.sources.length > 0 && (
              <div className="claim-sources">
                {v.sources.slice(0, 2).map((src, i) => (
                  <a key={i} className="source-link" href={src.url} target="_blank" rel="noopener noreferrer">
                    ↗ {src.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DisagreementCard({ topic, resolution, index }) {
  if (!resolution) return null;
  return (
    <div className="disagreement-card" style={{ animationDelay: `${index * 0.15}s` }}>
      <div className="disagreement-header">
        Disagreement: {topic}
      </div>
      <div className="disagreement-body">
        <div>{resolution.reasoning}</div>
        {resolution.winning_position && resolution.winning_position !== 'inconclusive' && (
          <div className="disagreement-verdict">
            Winner: {MODEL_CONFIG[resolution.winning_position]?.name || resolution.winning_position} — {resolution.verdict}
          </div>
        )}
        {resolution.sources && resolution.sources.length > 0 && (
          <div className="claim-sources" style={{ marginTop: 8 }}>
            {resolution.sources.slice(0, 2).map((src, i) => (
              <a key={i} className="source-link" href={src.url} target="_blank" rel="noopener noreferrer">
                ↗ {src.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceScores({ scores }) {
  if (!scores) return null;

  return (
    <div className="confidence-section">
      {Object.entries(scores).map(([modelId, data]) => {
        const config = MODEL_CONFIG[modelId];
        if (!config) return null;
        const scoreClass = data.score >= 80 ? 'high' : data.score >= 50 ? 'medium' : 'low';
        const barColor = data.score >= 80 ? 'var(--neon-green)' : data.score >= 50 ? 'var(--accent)' : 'var(--neon-pink)';
        return (
          <div key={modelId} className="confidence-row">
            <div className="confidence-model-name" style={{ color: config.color }}>{config.name}</div>
            <div className={`confidence-score-value ${scoreClass}`}>{data.score}%</div>
            <div className="confidence-bar-track">
              <div className="confidence-bar-fill" style={{ width: `${data.score}%`, '--bar-color': barColor, background: barColor }} />
            </div>
            <div className="confidence-detail">
              {data.verified}✓ {data.refuted > 0 ? `${data.refuted}✗ ` : ''}{data.unverifiable > 0 ? `${data.unverifiable}? ` : ''}/ {data.total_claims}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SynthesisCard({ synthesis }) {
  if (!synthesis) return null;

  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        The Verified Answer
      </div>
      <div className="synthesis-body">
        <ReactMarkdown>{synthesis.answer || ''}</ReactMarkdown>
      </div>
      {synthesis.citations && synthesis.citations.length > 0 && (
        <div className="synthesis-citations">
          <div className="synthesis-citations-title">Sources</div>
          {synthesis.citations.map((c, i) => (
            <div key={i} className="citation-item">
              <span className="citation-index">[{c.index}]</span>
              <span>{c.claim}</span>
              {c.source?.url && (
                <a className="source-link" href={c.source.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                  ↗ {c.source.title || 'Source'}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UniqueClaimWarnings({ crossRef, verifications }) {
  if (!crossRef?.unique) return null;
  const flagged = crossRef.unique.filter(u => {
    const v = verifications[u.claimId];
    return v && (v.verdict === 'refuted' || v.verdict === 'unverifiable');
  });
  if (flagged.length === 0) return null;

  return (
    <div style={{ margin: '12px 0' }}>
      {flagged.map((u, i) => (
        <div key={i} className="unique-claim-warning">
          <span>⚠</span>
          <span>
            Unverified unique claim from <strong style={{ color: MODEL_CONFIG[u.model]?.color }}>{MODEL_CONFIG[u.model]?.name}</strong>: "{u.claimText}"
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Export Helper ────────────────────────────────────────────

function generateMarkdownReport(report) {
  let md = `# The Council — Verification Report\n\n`;
  md += `**Question:** ${report.question}\n`;
  md += `**Date:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

  md += `---\n\n## Round 1: Independent Answers\n\n`;
  for (const a of report.round1_answers) {
    md += `### ${a.name} (${a.provider}) — ${(a.latency / 1000).toFixed(1)}s\n\n${a.answer}\n\n`;
  }

  if (report.round2_consensus !== null) {
    md += `---\n\n## Round 2: Peer Evaluation\n\n`;
    md += `**Consensus Score:** ${report.round2_consensus}\n\n`;
    for (const ev of report.round2_evaluations) {
      md += `### ${ev.evaluatorName} (Judge)\n\n`;
      if (ev.evaluation?.ratings) {
        for (const r of ev.evaluation.ratings) {
          md += `- **${r.model_id}**: ${r.score}/100 — ${r.reasoning}\n`;
        }
      }
      if (ev.evaluation?.reflection) md += `\n> ${ev.evaluation.reflection}\n`;
      md += '\n';
    }
  }

  const v = report.round3_verification;
  if (v && v.claims && Object.keys(v.claims).length > 0) {
    md += `---\n\n## Round 3: Verification Swarm\n\n`;

    if (v.cross_reference) {
      const cr = v.cross_reference;
      if (cr.agreed?.length) {
        md += `### Agreed Claims\n\n`;
        cr.agreed.forEach(a => md += `- ${a.claimText} *(${(a.models || []).join(', ')})*\n`);
        md += '\n';
      }
      if (cr.disagreed?.length) {
        md += `### Disagreements\n\n`;
        cr.disagreed.forEach(d => {
          md += `- **${d.topic}** [${d.severity}]\n`;
          Object.entries(d.positions || {}).forEach(([m, pos]) => md += `  - ${m}: ${pos}\n`);
        });
        md += '\n';
      }
      if (cr.unique?.length) {
        md += `### Unique Claims\n\n`;
        cr.unique.forEach(u => md += `- ${u.claimText} *(${u.model} only)*\n`);
        md += '\n';
      }
    }

    if (v.confidence_scores) {
      md += `### Verification Confidence Scores\n\n`;
      md += `| Model | Score | Verified | Refuted | Unverifiable | Total |\n`;
      md += `|-------|-------|----------|---------|--------------|-------|\n`;
      for (const [id, s] of Object.entries(v.confidence_scores)) {
        md += `| ${id} | ${s.score}% | ${s.verified} | ${s.refuted} | ${s.unverifiable} | ${s.total_claims} |\n`;
      }
      md += '\n';
    }

    if (v.disagreement_resolutions?.length) {
      md += `### Disagreement Resolutions\n\n`;
      v.disagreement_resolutions.forEach(d => {
        md += `**${d.topic}:** ${d.resolution?.verdict || 'Inconclusive'}\n`;
        if (d.resolution?.reasoning) md += `> ${d.resolution.reasoning}\n`;
        md += '\n';
      });
    }

    if (v.synthesized_answer) {
      md += `### Verified Synthesized Answer\n\n${v.synthesized_answer.answer || ''}\n\n`;
      if (v.synthesized_answer.citations?.length) {
        md += `**Sources:**\n\n`;
        v.synthesized_answer.citations.forEach(c => {
          md += `[${c.index}] ${c.claim}`;
          if (c.source?.url) md += ` — [${c.source.title || 'Source'}](${c.source.url})`;
          md += '\n';
        });
      }
    }
  }

  md += `\n---\n*Generated by The Council — Multi-AI Deliberation Engine*\n`;
  return md;
}

// ── Main App ────────────────────────────────────────────────

function MainApp() {
  // Core question state
  const [question, setQuestion] = useState('');
  const [activeModels, setActiveModels] = useState(['claude', 'gpt', 'gemini', 'grok']);
  const [answers, setAnswers] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [phase, setPhase] = useState('setup'); // setup, idle, asking, answered, evaluating, evaluated, game_over
  const [consensus, setConsensus] = useState(null);

  // Game mode state
  const [gameConfig, setGameConfig] = useState(null);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(0);
  const [gameResults, setGameResults] = useState([]);
  const [runningScores, setRunningScores] = useState({ claude: 0, gpt: 0, gemini: 0, grok: 0 });
  const [sidebarExpanded, setSidebarExpanded] = useState(null); // index of expanded result
  const [expandedQuestion, setExpandedQuestion] = useState(null); // expanded question on final results

  // Model settings & cost tracking
  const [modelOptions, setModelOptions] = useState(null);
  const [modelSelections, setModelSelections] = useState({});
  const [sessionCost, setSessionCost] = useState({ calls: 0, totalInput: 0, totalOutput: 0 });
  const [livePricing, setLivePricing] = useState(null);
  const [pricingStatus, setPricingStatus] = useState(null); // null, 'researching', 'done'
  const [showSettings, setShowSettings] = useState(false);
  const [showMidGameSettings, setShowMidGameSettings] = useState(false);
  const [shadowCost, setShadowCost] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Shadow window communication
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'in_progress', 'complete'
  const channelRef = useRef(null);

  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [question]);

  // Fetch model options on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => r.json()).then(data => {
      if (data.modelOptions) {
        setModelOptions(data.modelOptions);
        const defaults = {};
        Object.entries(data.models || {}).forEach(([id, m]) => { defaults[id] = m.model; });
        setModelSelections(defaults);
      }
    }).catch(() => {});
  }, []);

  // BroadcastChannel for shadow window communication
  useEffect(() => {
    channelRef.current = new BroadcastChannel('the-council');
    channelRef.current.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'shadow_ready') {
        setVerificationStatus(null);
      }
      if (type === 'verification_complete') {
        setVerificationStatus('complete');
      }
    };
    return () => channelRef.current?.close();
  }, []);

  // Poll Shadow Council usage during active games
  useEffect(() => {
    if (!gameConfig || phase === 'setup' || phase === 'game_over') return;
    const poll = () => {
      fetch('http://localhost:3002/api/usage')
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
    setActiveModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // ── Round 1: Ask ──────────────────────────────────

  const handleAsk = useCallback(async () => {
    if (!question.trim() || activeModels.length === 0) return;

    setErrorMessage(null);
    setPhase('asking');
    setAnswers([]);
    setEvaluations([]);
    setConsensus(null);
    setVerificationStatus('in_progress');
    setWaiting([...activeModels]);

    const collectedAnswers = [];

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'answer' && data.result) {
                collectedAnswers.push(data.result);
                setAnswers(prev => [...prev, data.result]);
                setWaiting(prev => prev.filter(id => id !== data.result.id));
              }
              if (data.type === 'complete') {
                if (data.sessionUsage) updateSessionCost(data.sessionUsage);
                // Auto-trigger: send answers to shadow window for verification
                const successAnswers = collectedAnswers.filter(a => a.status === 'success');
                const answersPayload = successAnswers.map(a => ({
                  id: a.id, name: a.name, provider: a.provider, answer: a.answer,
                }));
                channelRef.current?.postMessage({
                  type: 'answers_ready',
                  question: question.trim(),
                  answers: answersPayload,
                  questionNum: currentQuestionNum,
                });
                // Manual: user clicks "Convene The Council" to start evaluation
                setPhase('answered');
              }
            } catch {}
          }
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

  // Collected evaluations ref for passing to vote
  const collectedEvalsRef = useRef([]);

  const handleEvaluate = useCallback(async () => {
    const successfulAnswers = answers.filter(a => a.status === 'success');
    if (successfulAnswers.length < 2) {
      setPhase('evaluated'); // Skip evaluation if < 2 answers
      return;
    }
    setPhase('evaluating');

    setEvaluations([]);
    setConsensus(null);
    collectedEvalsRef.current = [];

    const answersPayload = successfulAnswers.map(a => ({
      id: a.id, name: a.name, provider: a.provider, answer: a.answer,
    }));

    try {
      const response = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'evaluation') {
                collectedEvalsRef.current.push(data);
                setEvaluations(prev => [...prev, data]);
              }
              if (data.type === 'complete') {
                if (data.sessionUsage) updateSessionCost(data.sessionUsage);
                // Compute consensus from scores
                const allScores = [];
                collectedEvalsRef.current.forEach(ev => {
                  if (ev.evaluation?.ratings) {
                    ev.evaluation.ratings.forEach(r => {
                      if (r.score) allScores.push(r.score);
                    });
                  }
                });
                const consensusValue = allScores.length > 0
                  ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
                  : null;
                if (consensusValue !== null) setConsensus(consensusValue);

                // Determine winner from evaluation scores
                const modelScores = {};
                collectedEvalsRef.current.forEach(ev => {
                  if (ev.evaluation?.ratings) {
                    ev.evaluation.ratings.forEach(r => {
                      if (!modelScores[r.model_id]) modelScores[r.model_id] = [];
                      if (r.score) modelScores[r.model_id].push(r.score);
                    });
                  }
                });
                const avgScores = {};
                Object.entries(modelScores).forEach(([id, scores]) => {
                  avgScores[id] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                });
                const winner = Object.entries(avgScores).sort(([,a], [,b]) => b - a)[0]?.[0] || null;

                // Every model earns points proportional to their average score; winner gets +1 bonus
                setRunningScores(prev => {
                  const updated = { ...prev };
                  Object.entries(avgScores).forEach(([id, avg]) => {
                    const base = Math.round(avg / 10);
                    const bonus = (id === winner) ? 1 : 0;
                    updated[id] = (updated[id] || 0) + base + bonus;
                  });
                  return updated;
                });

                const successfulAnswers = answers.filter(a => a.status === 'success');
                setGameResults(prev => [...prev, {
                  questionNum: currentQuestionNum,
                  question: question.trim(),
                  winner,
                  consensus: consensusValue,
                  avgScores,
                  evaluations: collectedEvalsRef.current.map(ev => ({
                    evaluator: ev.evaluator,
                    evaluatorName: ev.evaluatorName,
                    evaluation: ev.evaluation,
                  })),
                  answers: successfulAnswers.map(a => ({ id: a.id, name: a.name, answer: a.answer })),
                }]);

                setPhase('evaluated');
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Evaluate failed:', err);
      setErrorMessage(`Evaluation failed: ${err.message || 'Network error'}`);
      setPhase('evaluated');
    }
  }, [answers, question, currentQuestionNum]);

  // No auto-triggers — evaluation starts when user clicks "Convene The Council"

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

  // Get pricing for a specific model
  const getModelPricing = (modelId) => {
    const selected = modelSelections[modelId];
    const opt = modelOptions?.[modelId]?.find(o => o.model === selected) || modelOptions?.[modelId]?.[0];
    if (!opt) return { input: 2.0, output: 8.0 };
    const live = livePricing?.pricing?.[opt.model];
    return { input: live?.input_per_million || opt.input, output: live?.output_per_million || opt.output };
  };

  // Provider name mapping for display
  const providerNames = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', xai: 'xAI' };
  const providerToModel = { anthropic: 'claude', openai: 'gpt', google: 'gemini', xai: 'grok' };

  const getCostBreakdown = () => {
    const byProvider = {};
    // Group calls by provider from sessionUsage via API (we track aggregates in sessionCost)
    // Use weighted average approach since we don't have per-call granularity in state
    let totalCost = 0;
    activeModels.forEach(id => {
      const pricing = getModelPricing(id);
      // Approximate per-provider split: divide equally since we don't have per-provider token counts
      const providerShare = 1 / activeModels.length;
      const inputTokens = sessionCost.totalInput * providerShare;
      const outputTokens = sessionCost.totalOutput * providerShare;
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
      const providerKey = MODEL_CONFIG[id]?.provider || id;
      byProvider[providerKey] = { inputTokens: Math.round(inputTokens), outputTokens: Math.round(outputTokens), cost };
      totalCost += cost;
    });

    // Shadow Council costs (all Anthropic)
    let shadowTotal = 0;
    if (shadowCost && (shadowCost.totalInput > 0 || shadowCost.totalOutput > 0)) {
      const shadowPricing = getModelPricing('claude');
      shadowTotal = (shadowCost.totalInput / 1_000_000) * shadowPricing.input + (shadowCost.totalOutput / 1_000_000) * shadowPricing.output;
    }

    return { byProvider, councilTotal: totalCost, shadowTotal, grandTotal: totalCost + shadowTotal };
  };

  // Legacy compat: simple total cost
  const getEstimatedCost = () => getCostBreakdown().grandTotal;

  // Estimate cost per question before playing (for settings panel)
  const getEstimatedCostPerQuestion = () => {
    if (!modelOptions) return null;
    const avgInputTokens = 2000; // rough average per call
    const avgOutputTokens = 500;
    let askCost = 0, evalCost = 0;
    activeModels.forEach(id => {
      const pricing = getModelPricing(id);
      askCost += (avgInputTokens / 1_000_000) * pricing.input + (avgOutputTokens / 1_000_000) * pricing.output;
      evalCost += (avgInputTokens / 1_000_000) * pricing.input + (avgOutputTokens / 1_000_000) * pricing.output;
    });
    // Shadow Council: ~35 calls, all using Claude's pricing
    const shadowPricing = getModelPricing('claude');
    const shadowCostEst = 35 * ((avgInputTokens / 1_000_000) * shadowPricing.input + (avgOutputTokens / 1_000_000) * shadowPricing.output);
    return { ask: askCost, evaluate: evalCost, shadow: shadowCostEst, total: askCost + evalCost + shadowCostEst };
  };

  const handleResearchPricing = async () => {
    setPricingStatus('researching');
    try {
      const response = await fetch(`${API_BASE}/research-pricing`, { method: 'POST' });
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'pricing' && data.data?.pricing) {
                setLivePricing(data.data);
              }
              if (data.type === 'complete') {
                setPricingStatus('done');
              }
            } catch {}
          }
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: modelSelections }),
      });
      setShowMidGameSettings(false);
    } catch (err) {
      console.error('Failed to apply settings:', err);
    }
  };

  // ── Game Flow Helpers ──────────────────────────

  const startGame = async (totalQuestions) => {
    // Send model config to server before starting
    if (Object.keys(modelSelections).length > 0) {
      try {
        await fetch(`${API_BASE}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ models: modelSelections }),
        });
      } catch {}
    }
    // Reset usage counters
    fetch(`${API_BASE}/usage/reset`, { method: 'POST' }).catch(() => {});
    fetch('http://localhost:3002/api/usage/reset', { method: 'POST' }).catch(() => {});
    setSessionCost({ calls: 0, totalInput: 0, totalOutput: 0 });

    setGameConfig({ totalQuestions });
    setCurrentQuestionNum(1);
    setGameResults([]);
    setRunningScores({ claude: 0, gpt: 0, gemini: 0, grok: 0 });
    setPhase('idle');
    // Open Shadow Council dashboard (separate verification server)
    const shadowTab = window.open('http://localhost:3002', '_blank');
    if (!shadowTab) console.log('Shadow Council tab blocked by browser. Open http://localhost:3002 manually.');
    channelRef.current?.postMessage({ type: 'game_start', totalQuestions });
  };

  const handleNextQuestion = () => {
    const nextNum = currentQuestionNum + 1;
    if (gameConfig && nextNum > gameConfig.totalQuestions) {
      setPhase('game_over');
      channelRef.current?.postMessage({ type: 'game_over', finalScores: runningScores, gameResults });
      // Final Shadow Council cost snapshot
      fetch('http://localhost:3002/api/usage').then(r => r.json()).then(data => {
        setShadowCost({ calls: data.calls?.length || 0, totalInput: data.totalInputTokens || 0, totalOutput: data.totalOutputTokens || 0 });
      }).catch(() => {});
      return;
    }
    setCurrentQuestionNum(nextNum);
    setQuestion('');
    setAnswers([]);
    setWaiting([]);
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
    setEvaluations([]);
    setConsensus(null);
    setExpandedQuestion(null);
    setSessionCost({ calls: 0, totalInput: 0, totalOutput: 0 });
    setShadowCost(null);
    setErrorMessage(null);
    setShowSettings(false);
    setShowMidGameSettings(false);
  };

  // Keyboard shortcut
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (phase === 'idle' || phase === 'evaluated') {
        handleAsk();
      }
    }
  };

  const successfulAnswers = answers.filter(a => a.status === 'success');
  const consensusClass = consensus >= 80 ? 'high' : consensus >= 50 ? 'medium' : 'low';

  // ── Render ─────────────────────────────────────

  // Game Setup Screen
  if (phase === 'setup') {
    return (
      <>
        <style>{styles}</style>
        <div className="setup-screen">
          <header className="header">
            <h1 className="title">The Council</h1>
            <div className="subtitle">Multi-AI Deliberation Engine</div>
          </header>
          <div className="setup-card">
            <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.2rem', color: 'var(--accent)', marginBottom: 24, textAlign: 'center' }}>
              Configure Your Session
            </h2>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 12, fontFamily: "'Orbitron', sans-serif" }}>
                NUMBER OF QUESTIONS
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[3, 5, 10].map(n => (
                  <button
                    key={n}
                    className="setup-btn"
                    onClick={() => startGame(n)}
                  >
                    {n} Questions
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 12, fontFamily: "'Orbitron', sans-serif" }}>
                COUNCIL MEMBERS
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.entries(MODEL_CONFIG).map(([id, config]) => (
                  <button
                    key={id}
                    className={`model-toggle ${activeModels.includes(id) ? 'active' : ''}`}
                    style={{ '--toggle-color': config.color }}
                    onClick={() => toggleModel(id)}
                  >
                    {config.icon} {config.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Settings */}
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                }}
              >
                {showSettings ? '\u25B2' : '\u2699\uFE0F'} MODEL SETTINGS {showSettings ? '' : '(Click to configure)'}
              </button>

              {showSettings && modelOptions && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeModels.map(id => {
                    const config = MODEL_CONFIG[id];
                    const options = modelOptions[id] || [];
                    if (options.length < 2) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                        <span style={{ color: config.color, fontSize: '0.85rem', width: 90, textAlign: 'right' }}>
                          {config.icon} {config.provider}
                        </span>
                        <select
                          value={modelSelections[id] || options[0]?.model}
                          onChange={(e) => setModelSelections(prev => ({ ...prev, [id]: e.target.value }))}
                          style={{
                            background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${config.color}40`,
                            borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace",
                            cursor: 'pointer', minWidth: 260,
                          }}
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

                  {/* Research Live Pricing button */}
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <button
                      onClick={handleResearchPricing}
                      disabled={pricingStatus === 'researching'}
                      style={{
                        background: pricingStatus === 'done' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${pricingStatus === 'done' ? '#10B981' : '#3B82F6'}40`,
                        color: pricingStatus === 'done' ? '#10B981' : '#3B82F6',
                        borderRadius: 6, padding: '8px 20px', cursor: pricingStatus === 'researching' ? 'wait' : 'pointer',
                        fontFamily: "'Orbitron', sans-serif", fontSize: '0.65rem', letterSpacing: '0.1em',
                      }}
                    >
                      {pricingStatus === 'researching' ? 'Cost Analyst Agent Researching...' :
                       pricingStatus === 'done' ? '\u2713 Live Pricing Verified' :
                       '\uD83D\uDD0D Research Live Pricing (AI-Powered)'}
                    </button>
                    {pricingStatus === 'done' && livePricing?.research_notes && (
                      <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-dim)', maxWidth: 400, margin: '8px auto 0' }}>
                        {livePricing.research_notes}
                      </div>
                    )}
                  </div>

                  {/* Per-question cost estimate */}
                  {(() => {
                    const est = getEstimatedCostPerQuestion();
                    if (!est) return null;
                    return (
                      <div style={{
                        marginTop: 16, padding: '10px 16px', background: 'rgba(240, 192, 64, 0.08)',
                        border: '1px solid rgba(240, 192, 64, 0.2)', borderRadius: 8, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.65rem', fontFamily: "'Orbitron', sans-serif", color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 6 }}>
                          ESTIMATED COST PER QUESTION
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem', color: '#F59E0B' }}>
                          ~${est.total.toFixed(4)}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 4 }}>
                          Ask: ${est.ask.toFixed(4)} + Evaluate: ${est.evaluate.toFixed(4)} + Shadow Council: ~${est.shadow.toFixed(4)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Game Over Screen
  if (phase === 'game_over') {
    const modelStats = {};
    activeModels.forEach(id => {
      const rounds = gameResults.filter(r => r.avgScores && r.avgScores[id] !== undefined);
      const avgOverall = rounds.length > 0
        ? Math.round(rounds.reduce((sum, r) => sum + (r.avgScores[id] || 0), 0) / rounds.length)
        : 0;
      const wins = gameResults.filter(r => r.winner === id).length;
      const bestRound = rounds.reduce((best, r) => (!best || (r.avgScores[id] || 0) > best.score)
        ? { questionNum: r.questionNum, score: r.avgScores[id] || 0 } : best, null);
      const worstRound = rounds.reduce((worst, r) => (!worst || (r.avgScores[id] || 0) < worst.score)
        ? { questionNum: r.questionNum, score: r.avgScores[id] || 0 } : worst, null);
      modelStats[id] = { avgOverall, wins, bestRound, worstRound };
    });

    const sortedScores = Object.entries(runningScores)
      .filter(([id]) => activeModels.includes(id))
      .sort(([, a], [, b]) => b - a);

    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}', '4th'];

    return (
      <>
        <style>{styles}</style>
        <header className="header">
          <h1 className="title">The Council</h1>
          <div className="subtitle">Final Results</div>
        </header>
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>

          {/* Section A: Final Rankings */}
          <div className="consensus-section" style={{ marginBottom: 32 }}>
            <div className="consensus-title">Final Rankings</div>
          </div>
          {sortedScores.map(([id, score], i) => {
            const config = MODEL_CONFIG[id];
            const stats = modelStats[id] || {};
            return (
              <div key={id} className="eval-card" style={{
                '--card-color': config.color, '--card-glow': config.glow,
                animation: `floatUp 0.5s ease forwards`, animationDelay: `${i * 0.15}s`,
                opacity: 0, marginBottom: 16,
              }}>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: i === 0 ? '1.3rem' : '1rem', color: config.color }}>
                      {medals[i]} {config.icon} {config.name}
                    </span>
                    <span className={`score ${score >= 25 ? 'high' : score >= 15 ? 'medium' : 'low'}`} style={{ fontSize: '1.5rem' }}>
                      {score} pts
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginTop: 10, color: 'var(--text-dim)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                    <span>{stats.wins || 0} win{stats.wins !== 1 ? 's' : ''} of {gameResults.length}</span>
                    <span>Avg Score: {stats.avgOverall || 0}/100</span>
                    {stats.bestRound && gameResults.length > 1 && (
                      <span style={{ color: '#10B981' }}>Best: Q{stats.bestRound.questionNum} ({Math.round(stats.bestRound.score)})</span>
                    )}
                    {stats.worstRound && gameResults.length > 1 && (
                      <span style={{ color: '#F472B6' }}>Worst: Q{stats.worstRound.questionNum} ({Math.round(stats.worstRound.score)})</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Section B: Expandable Question History */}
          <div style={{ marginTop: 40 }}>
            <div className="round-header">
              <span className="round-label">Question History</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Click to expand</span>
            </div>
            {gameResults.map((r, qi) => {
              const isExpanded = expandedQuestion === qi;
              const winnerConfig = MODEL_CONFIG[r.winner];
              return (
                <div key={qi} style={{
                  marginBottom: isExpanded ? 24 : 8,
                  animation: `floatUp 0.5s ease forwards`, animationDelay: `${qi * 0.15}s`, opacity: 0,
                }}>
                  {/* Collapsed header */}
                  <div
                    className="history-item"
                    style={{ cursor: 'pointer', padding: '12px 16px' }}
                    onClick={() => setExpandedQuestion(isExpanded ? null : qi)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="history-question" style={{ flex: 1, marginRight: 12 }}>Q{r.questionNum}: {r.question}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span style={{ color: winnerConfig?.color, fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem' }}>
                          {winnerConfig?.icon} {winnerConfig?.name}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {isExpanded ? '\u25B2' : '\u25BC'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      background: 'rgba(15, 15, 30, 0.8)', border: '1px solid var(--border)',
                      borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 20,
                      animation: 'slideDown 0.3s ease',
                    }}>
                      {/* Round Scores */}
                      {r.avgScores && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 12 }}>
                            ROUND SCORES
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {Object.entries(r.avgScores)
                              .sort(([,a], [,b]) => b - a)
                              .map(([modelId, avg]) => {
                                const mc = MODEL_CONFIG[modelId];
                                if (!mc) return null;
                                const scoreVal = Math.round(avg);
                                const cls = scoreVal >= 80 ? 'high' : scoreVal >= 50 ? 'medium' : 'low';
                                return (
                                  <div key={modelId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: mc.color, fontSize: '0.85rem' }}>{mc.icon} {mc.name}</span>
                                    <span className={`score ${cls}`} style={{ fontSize: '1rem' }}>{scoreVal}</span>
                                    {modelId === r.winner && <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontFamily: "'Orbitron', sans-serif" }}>WINNER</span>}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Answers */}
                      {r.answers && r.answers.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 12 }}>
                            ANSWERS
                          </div>
                          <div className="answers-grid">
                            {r.answers.map((a, ai) => (
                              <AnswerCard key={a.id} result={{ ...a, status: 'success' }} index={ai} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Peer Evaluations */}
                      {r.evaluations && r.evaluations.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 12 }}>
                            PEER EVALUATIONS
                          </div>
                          <div className="eval-grid">
                            {r.evaluations.map((ev) => (
                              <EvaluationCard
                                key={ev.evaluator}
                                evaluatorId={ev.evaluator}
                                evaluation={ev.evaluation}
                                index={0}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Section C: Session Cost Analysis */}
          {sessionCost.calls > 0 && (() => {
            const breakdown = getCostBreakdown();
            return (
              <div style={{ marginTop: 40 }}>
                <div className="round-header">
                  <span className="round-label">Session Cost Analysis</span>
                </div>

                {/* Summary stats row */}
                <div className="eval-card" style={{
                  '--card-color': '#F59E0B', '--card-glow': '#F59E0B55',
                  animation: 'floatUp 0.5s ease forwards', opacity: 0, marginTop: 8,
                }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text)' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>API CALLS</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.2rem' }}>{sessionCost.calls}{shadowCost?.calls ? ` + ${shadowCost.calls}` : ''}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>TOTAL TOKENS</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.2rem' }}>
                          {((sessionCost.totalInput + sessionCost.totalOutput + (shadowCost?.totalInput || 0) + (shadowCost?.totalOutput || 0)) / 1000).toFixed(1)}k
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>EST. TOTAL</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.2rem', color: '#F59E0B' }}>${breakdown.grandTotal.toFixed(4)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>COST/QUESTION</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.2rem', color: '#F59E0B' }}>${gameResults.length > 0 ? (breakdown.grandTotal / gameResults.length).toFixed(4) : '—'}</div>
                      </div>
                    </div>

                    {/* Per-provider breakdown */}
                    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div style={{ fontSize: '0.6rem', fontFamily: "'Orbitron', sans-serif", color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 10 }}>
                        COST BY PROVIDER
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {Object.entries(breakdown.byProvider).map(([provider, data]) => (
                          <div key={provider} style={{
                            flex: '1 1 120px', padding: '8px 12px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: 4 }}>{provider}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: 'var(--text)' }}>
                              ${data.cost.toFixed(4)}
                            </div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', marginTop: 2 }}>
                              {(data.inputTokens / 1000).toFixed(1)}k in / {(data.outputTokens / 1000).toFixed(1)}k out
                            </div>
                          </div>
                        ))}
                        {breakdown.shadowTotal > 0 && (
                          <div style={{
                            flex: '1 1 120px', padding: '8px 12px',
                            background: 'rgba(59, 130, 246, 0.06)', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)',
                          }}>
                            <div style={{ fontSize: '0.6rem', color: '#3B82F6', marginBottom: 4 }}>Shadow Council</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: 'var(--text)' }}>
                              ${breakdown.shadowTotal.toFixed(4)}
                            </div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', marginTop: 2 }}>
                              {shadowCost ? `${(shadowCost.totalInput / 1000).toFixed(1)}k in / ${(shadowCost.totalOutput / 1000).toFixed(1)}k out` : '—'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {livePricing && (
                      <div style={{ marginTop: 12, fontSize: '0.7rem', color: '#10B981', fontStyle: 'italic' }}>
                        Pricing verified by AI Cost Analyst Agent
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section D: New Game */}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button className="council-btn" onClick={handleNewGame}>
              New Game
            </button>
          </div>
        </div>
        <div style={{ height: 60 }} />
      </>
    );
  }

  // Main Game Flow
  return (
    <>
      <style>{styles}</style>

      {/* Header */}
      <header className="header">
        <h1 className="title">The Council</h1>
        <div className="subtitle">Multi-AI Deliberation Engine</div>
      </header>

      {/* Scoreboard (replaces marquee) */}
      {gameConfig && (
        <div className="scoreboard-bar">
          <div className="scoreboard-question-num">
            QUESTION {currentQuestionNum} OF {gameConfig.totalQuestions}
          </div>
          <div className="scoreboard-scores">
            {Object.entries(runningScores)
              .filter(([id]) => activeModels.includes(id))
              .sort(([, a], [, b]) => b - a)
              .map(([id, score], i) => {
                const config = MODEL_CONFIG[id];
                return (
                  <div key={id} className={`scoreboard-entry ${i === 0 && score > 0 ? 'leader' : ''}`}>
                    <span className="scoreboard-dot" style={{ background: config.color }} />
                    <span className="scoreboard-name">{config.name}</span>
                    <span className="scoreboard-pts">{score}</span>
                  </div>
                );
              })}
          </div>
          {/* Cost ticker */}
          {sessionCost.calls > 0 && (
            <div style={{
              fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace",
              display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto', paddingLeft: 16,
            }}>
              <span>{sessionCost.calls} API calls</span>
              <span>{((sessionCost.totalInput + sessionCost.totalOutput) / 1000).toFixed(1)}k tokens</span>
              <span style={{ color: '#F59E0B' }}>~${getEstimatedCost()?.toFixed(4) || '...'}</span>
            </div>
          )}
        </div>
      )}

      <div className="game-layout">
        {/* Sidebar — Previous Results */}
        {gameResults.length > 0 && (
          <aside className="game-sidebar">
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 12, letterSpacing: '0.1em' }}>
              PREVIOUS ROUNDS
            </div>
            {gameResults.map((r, i) => (
              <div
                key={i}
                className={`sidebar-item ${sidebarExpanded === i ? 'expanded' : ''}`}
                onClick={() => setSidebarExpanded(sidebarExpanded === i ? null : i)}
              >
                <div className="sidebar-item-header">
                  <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>Q{r.questionNum}</span>
                  <span style={{ color: MODEL_CONFIG[r.winner]?.color, fontSize: '0.75rem' }}>
                    {MODEL_CONFIG[r.winner]?.icon} {MODEL_CONFIG[r.winner]?.name}
                  </span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.question}
                </div>
                {sidebarExpanded === i && (
                  <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {r.consensus && <div>Consensus: {r.consensus}/100</div>}
                  </div>
                )}
              </div>
            ))}
          </aside>
        )}

        {/* Main Content */}
        <main className="game-main">
          {/* Input */}
          <section className="input-section">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="question-input"
                placeholder="Ask The Council anything..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <div className="input-actions">
                <button
                  className="submit-btn"
                  onClick={handleAsk}
                  disabled={!question.trim() || activeModels.length === 0 || phase === 'asking' || phase === 'evaluating'}
                >
                  {phase === 'asking' ? 'Models Responding...' :
                   phase === 'evaluating' ? 'Council Evaluating...' :
                   'Ask The Council'}
                </button>
              </div>
            </div>
          </section>

          {/* Error Banner */}
          {errorMessage && (
            <div className="error-banner">
              <span className="error-banner-text">⚠ {errorMessage}</span>
              <button className="error-banner-close" onClick={() => setErrorMessage(null)}>✕</button>
            </div>
          )}

          {/* Arena */}
          <section className="arena">
            {/* Round 1 Answers */}
            {(answers.length > 0 || waiting.length > 0) && (
              <>
                <div className="round-header">
                  <span className="round-label">Round 1 — Independent Answers</span>
                </div>
                <div className="answers-grid">
                  {answers.map((result, i) => (
                    <AnswerCard key={result.id} result={result} index={i} />
                  ))}
                  {waiting.map(id => (
                    <WaitingCard key={id} modelId={id} />
                  ))}
                </div>
              </>
            )}

            {/* Loading indicator between rounds */}
            {phase === 'evaluating' && evaluations.length === 0 && (
              <div className="council-section">
                <div className="phase-indicator">
                  <div className="typing"><span /><span /><span /></div>
                  <span style={{ marginLeft: 12 }}>The Council is evaluating responses...</span>
                </div>
              </div>
            )}

            {/* Round 2 Evaluations */}
            {evaluations.length > 0 && (
              <>
                <div className="round-header">
                  <span className="round-label">Round 2 — Peer Evaluation</span>
                </div>
                <div className="eval-grid">
                  {evaluations.map((ev, i) => (
                    <EvaluationCard
                      key={ev.evaluator}
                      evaluatorId={ev.evaluator}
                      evaluation={ev.evaluation}
                      index={i}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Consensus Score */}
            {consensus !== null && (
              <div className="consensus-section">
                <div className="consensus-title">Council Consensus Score</div>
                <div className={`consensus-score ${consensusClass}`}>{consensus}</div>
                <div className="consensus-label">
                  {consensus >= 90 ? 'Strong Agreement' :
                   consensus >= 75 ? 'General Consensus' :
                   consensus >= 60 ? 'Mixed Views' :
                   'Significant Disagreement'}
                </div>
              </div>
            )}

            {/* Convene The Council button — manual trigger for evaluation */}
            {phase === 'answered' && successfulAnswers.length >= 2 && (
              <div className="council-section" style={{ textAlign: 'center', marginTop: 24 }}>
                <button className="council-btn" onClick={handleEvaluate}>
                  Convene The Council
                </button>
              </div>
            )}

            {/* Winner Announcement — from evaluation scores */}
            {phase === 'evaluated' && gameResults.length > 0 && (() => {
              const lastResult = gameResults[gameResults.length - 1];
              if (!lastResult) return null;
              const winnerConfig = lastResult.winner ? MODEL_CONFIG[lastResult.winner] : null;
              const winningAnswer = lastResult.winner ? answers.find(a => a.id === lastResult.winner) : null;
              return (
                <div className="consensus-section" style={{ marginTop: 24 }}>
                  <div className="consensus-title">The Council Has Decided</div>
                  {winnerConfig && (
                    <div style={{
                      fontSize: '2.5rem',
                      fontFamily: "'Orbitron', sans-serif",
                      color: winnerConfig.color,
                      textShadow: `0 0 20px ${winnerConfig.glow}`,
                      animation: 'scoreSlam 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      marginBottom: 8,
                    }}>
                      {winnerConfig.icon} {winnerConfig.name}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 4 }}>
                    Highest Rated Answer
                  </div>

                  {/* Verification status indicator */}
                  {verificationStatus && (
                    <div style={{
                      marginTop: 16, fontSize: '0.75rem', color: 'var(--text-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: verificationStatus === 'complete' ? '#10B981' : '#3B82F6',
                        animation: verificationStatus !== 'complete' ? 'agentPulse 1s ease-in-out infinite' : 'none',
                      }} />
                      Verification Swarm: {verificationStatus === 'complete' ? 'Complete' : 'In Progress'}
                    </div>
                  )}

                  {/* The Council's Answer — show the winning model's actual answer */}
                  {winningAnswer?.answer && (() => {
                    const config = MODEL_CONFIG[lastResult.winner];
                    return (
                      <div style={{
                        marginTop: 20, background: 'var(--bg-card)', border: `1px solid ${config?.color || 'var(--border)'}`,
                        borderRadius: 8, padding: 20, textAlign: 'left',
                        boxShadow: `0 0 16px ${config?.glow || 'transparent'}`,
                      }}>
                        <div style={{
                          fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", color: config?.color || 'var(--accent)',
                          letterSpacing: '0.15em', marginBottom: 12,
                        }}>
                          THE COUNCIL'S ANSWER
                        </div>
                        <div style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                          <ReactMarkdown>{winningAnswer.answer}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Next Question / Game Over button */}
                  <div style={{ marginTop: 24 }}>
                    <button className="council-btn" onClick={handleNextQuestion}>
                      {gameConfig && currentQuestionNum >= gameConfig.totalQuestions
                        ? 'View Final Results'
                        : `Next Question (${currentQuestionNum + 1}/${gameConfig?.totalQuestions || '?'})`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </section>
        </main>
      </div>

      <div style={{ height: 60 }} />

      {/* Floating Gear Button — Mid-Game Settings */}
      {modelOptions && (
        <button
          onClick={() => setShowMidGameSettings(!showMidGameSettings)}
          style={{
            position: 'fixed', bottom: 24, left: 24, width: 48, height: 48,
            borderRadius: '50%', background: showMidGameSettings ? 'rgba(240, 192, 64, 0.3)' : 'rgba(26, 26, 46, 0.9)',
            border: `2px solid ${showMidGameSettings ? '#F59E0B' : 'var(--border-bright)'}`,
            color: showMidGameSettings ? '#F59E0B' : 'var(--text-dim)',
            fontSize: '1.3rem', cursor: 'pointer', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease', boxShadow: showMidGameSettings ? '0 0 20px rgba(240, 192, 64, 0.3)' : 'none',
          }}
          title="Model Settings"
        >
          {'\u2699\uFE0F'}
        </button>
      )}

      {/* Mid-Game Settings Slide-Out Panel */}
      {showMidGameSettings && modelOptions && (
        <div style={{
          position: 'fixed', bottom: 80, left: 24, width: 360,
          background: 'rgba(18, 18, 26, 0.97)', border: '1px solid var(--border-bright)',
          borderRadius: 12, padding: 20, zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'floatUp 0.25s ease',
        }}>
          <div style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', color: 'var(--accent)',
            letterSpacing: '0.12em', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>MODEL SETTINGS</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
              Changes apply next round
            </span>
          </div>

          {activeModels.map(id => {
            const config = MODEL_CONFIG[id];
            const options = modelOptions[id] || [];
            if (options.length < 2) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: config.color, fontSize: '0.8rem', width: 80, textAlign: 'right', flexShrink: 0 }}>
                  {config.icon} {config.provider}
                </span>
                <select
                  value={modelSelections[id] || options[0]?.model}
                  onChange={(e) => setModelSelections(prev => ({ ...prev, [id]: e.target.value }))}
                  style={{
                    background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${config.color}40`,
                    borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer', flex: 1,
                  }}
                >
                  {options.map(opt => (
                    <option key={opt.model} value={opt.model}>
                      {opt.label} — ${opt.input}/${opt.output} ({opt.tier})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {/* Per-question cost estimate */}
          {(() => {
            const est = getEstimatedCostPerQuestion();
            if (!est) return null;
            return (
              <div style={{
                marginTop: 12, padding: '8px 12px', background: 'rgba(240, 192, 64, 0.06)',
                border: '1px solid rgba(240, 192, 64, 0.15)', borderRadius: 6, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                  Est. per question: <span style={{ color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>~${est.total.toFixed(4)}</span>
                </div>
              </div>
            );
          })()}

          {/* Current session cost */}
          {sessionCost.calls > 0 && (
            <div style={{
              marginTop: 8, padding: '8px 12px', background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: 6,
              fontSize: '0.6rem', color: 'var(--text-dim)', display: 'flex', gap: 12, justifyContent: 'center',
            }}>
              <span>{sessionCost.calls} calls</span>
              <span style={{ color: '#F59E0B' }}>~${getEstimatedCost()?.toFixed(4)}</span>
              {shadowCost && shadowCost.calls > 0 && (
                <span style={{ color: '#3B82F6' }}>+{shadowCost.calls} shadow</span>
              )}
            </div>
          )}

          <button
            onClick={applyMidGameSettings}
            style={{
              marginTop: 14, width: '100%', padding: '8px 16px',
              background: 'rgba(240, 192, 64, 0.15)', border: '1px solid rgba(240, 192, 64, 0.3)',
              borderRadius: 6, color: '#F59E0B', cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif", fontSize: '0.65rem', letterSpacing: '0.1em',
            }}
          >
            APPLY CHANGES
          </button>
        </div>
      )}
    </>
  );
}

// ── Shadow Window (Verification Swarm) ───────────────────────

function ShadowWindow() {
  // Accumulated results across all questions
  const [results, setResults] = useState([]); // completed verification results
  const [currentQ, setCurrentQ] = useState(null); // in-progress verification
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [councilResults, setCouncilResults] = useState([]); // from game_over message
  const [finalScores, setFinalScores] = useState(null);
  const channelRef = useRef(null);
  const currentQRef = useRef(null); // mutable ref for SSE updates

  const startVerification = useCallback(async (questionNum, question, answers) => {
    const qState = {
      questionNum, question, answers,
      claims: {}, crossRef: null, verifications: {}, verifyProgress: {},
      confidenceScores: null, disagreementResolutions: [], synthesis: null,
      status: 'verifying',
    };
    currentQRef.current = qState;
    setCurrentQ({ ...qState });

    try {
      const response = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const q = currentQRef.current;
              if (!q) continue;
              if (data.type === 'claims') {
                q.claims = { ...q.claims, [data.modelId]: data.claims };
              }
              if (data.type === 'cross_reference') {
                q.crossRef = data.matrix;
              }
              if (data.type === 'verification_progress') {
                q.verifyProgress = { ...q.verifyProgress, [data.claimId]: data.status };
              }
              if (data.type === 'verification') {
                q.verifications = { ...q.verifications, [data.claimId]: data.result };
                q.verifyProgress = { ...q.verifyProgress, [data.claimId]: 'done' };
              }
              if (data.type === 'disagreement_resolution') {
                q.disagreementResolutions = [...q.disagreementResolutions, { topic: data.topic, resolution: data.resolution }];
              }
              if (data.type === 'confidence_scores') {
                q.confidenceScores = data.scores;
                channelRef.current?.postMessage({ type: 'verification_complete', confidenceScores: data.scores });
              }
              if (data.type === 'synthesis') {
                q.synthesis = { answer: data.answer, citations: data.citations };
              }
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
        setCouncilResults([]);
        setFinalScores(null);
      }
      if (type === 'answers_ready') {
        startVerification(data.questionNum, data.question, data.answers);
      }
      if (type === 'game_over') {
        setGameComplete(true);
        setCouncilResults(data.gameResults || []);
        setFinalScores(data.finalScores || null);
      }
    };
    channelRef.current.postMessage({ type: 'shadow_ready' });
    return () => channelRef.current?.close();
  }, [startVerification]);

  // Compute overall accuracy across all completed results
  const overallAccuracy = {};
  results.forEach(r => {
    if (!r.confidenceScores) return;
    Object.entries(r.confidenceScores).forEach(([modelId, scores]) => {
      if (!overallAccuracy[modelId]) {
        overallAccuracy[modelId] = { totalClaims: 0, verified: 0, refuted: 0, partial: 0, unverifiable: 0 };
      }
      const a = overallAccuracy[modelId];
      a.totalClaims += scores.total_claims || 0;
      a.verified += scores.verified || 0;
      a.refuted += scores.refuted || 0;
      a.partial += scores.partially_supported || 0;
      a.unverifiable += scores.unverifiable || 0;
    });
  });

  // Count how many council decisions the swarm confirmed
  let confirmedCount = 0;
  councilResults.forEach(cr => {
    const matchingResult = results.find(r => r.questionNum === cr.questionNum);
    if (matchingResult?.confidenceScores) {
      const sorted = Object.entries(matchingResult.confidenceScores).sort(([,a],[,b]) => (b.score || 0) - (a.score || 0));
      if (sorted.length > 0 && sorted[0][0] === cr.winner) confirmedCount++;
    }
  });

  const completedCount = results.length;
  const inProgress = currentQ !== null;

  // ── During Game: Clean Progress Dashboard ──

  if (!gameComplete) {
    return (
      <>
        <style>{styles}</style>
        <header className="header" style={{ paddingBottom: 12 }}>
          <h1 className="title" style={{ fontSize: '2rem' }}>Verification Swarm</h1>
          <div className="subtitle">Shadow Operations — Active</div>
        </header>

        <section style={{ maxWidth: 600, margin: '40px auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16, animation: inProgress ? 'pulse 2s ease-in-out infinite' : 'none' }}>
              {inProgress ? '🔍' : completedCount === 0 ? '🛰️' : '✓'}
            </div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem', color: 'var(--accent)', marginBottom: 4 }}>
              {completedCount === 0 && !inProgress ? 'STANDING BY' :
               inProgress ? 'VERIFYING' : 'AWAITING NEXT QUESTION'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              {completedCount} of {totalQuestions || '?'} questions verified
            </div>
          </div>

          {(results.length > 0 || currentQ) && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {results.map((r, i) => {
                const totalClaims = Object.values(r.claims).flat().length;
                const verified = Object.values(r.verifications).filter(v => v.verdict === 'supported').length;
                return (
                  <div key={i} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ color: 'var(--accent)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem', marginRight: 8 }}>
                        Q{r.questionNum}
                      </span>
                      <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                        {r.question.slice(0, 50)}{r.question.length > 50 ? '...' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                        {verified}/{totalClaims} verified
                      </span>
                      <span style={{ color: '#10B981', fontSize: '0.9rem' }}>✓</span>
                    </div>
                  </div>
                );
              })}
              {currentQ && (
                <div style={{
                  padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ color: 'var(--accent)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem', marginRight: 8 }}>
                      Q{currentQ.questionNum}
                    </span>
                    <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>
                      {currentQ.question.slice(0, 50)}{currentQ.question.length > 50 ? '...' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#3B82F6', fontSize: '0.7rem' }}>
                      {Object.values(currentQ.verifyProgress).filter(s => s === 'done').length}/{Object.values(currentQ.claims).flat().length} claims
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', animation: 'agentPulse 1s ease-in-out infinite' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </>
    );
  }

  // ── Game Complete: THE BIG REVEAL ──

  return (
    <>
      <style>{styles}</style>
      <header className="header" style={{ paddingBottom: 12 }}>
        <h1 className="title" style={{ fontSize: '2.2rem' }}>The Verification Swarm</h1>
        <div className="subtitle">Final Report — Independent Fact-Checking Results</div>
      </header>

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

        {/* Summary Banner */}
        <div className="consensus-section" style={{ marginTop: 24, marginBottom: 32 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em', marginBottom: 8 }}>
            SWARM VERIFICATION SUMMARY
          </div>
          <div style={{ fontSize: '1.4rem', color: 'var(--accent)', fontFamily: "'Orbitron', sans-serif", marginBottom: 4 }}>
            {results.length} Question{results.length !== 1 ? 's' : ''} Verified
          </div>
          {councilResults.length > 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Council decisions confirmed by swarm:{' '}
              <span style={{ color: confirmedCount === councilResults.length ? '#10B981' : 'var(--accent)', fontWeight: 'bold' }}>
                {confirmedCount} of {councilResults.length}
              </span>
            </div>
          )}
        </div>

        {/* Overall Model Accuracy Scoreboard */}
        {Object.keys(overallAccuracy).length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="round-header">
              <span className="round-label">Model Accuracy Scoreboard (All Questions)</span>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {Object.entries(overallAccuracy)
                .map(([id, a]) => ({ id, ...a, score: a.totalClaims > 0 ? Math.round(((a.verified + a.partial * 0.5) / a.totalClaims) * 100) : 0 }))
                .sort((a, b) => b.score - a.score)
                .map((entry, i) => {
                  const config = MODEL_CONFIG[entry.id];
                  const scoreClass = entry.score >= 80 ? 'high' : entry.score >= 50 ? 'medium' : 'low';
                  return (
                    <div key={entry.id} style={{
                      padding: '14px 20px', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 16,
                      animation: `floatUp 0.5s ease forwards`, animationDelay: `${i * 0.1}s`, opacity: 0,
                    }}>
                      <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', color: 'var(--text-dim)', width: 24 }}>
                        {i + 1}.
                      </span>
                      <span className="model-dot" style={{ background: config?.color || '#888' }} />
                      <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem', color: config?.color || '#888', flex: 1 }}>
                        {config?.name || entry.id}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          {entry.verified}✓ {entry.refuted}✗ {entry.partial}~ / {entry.totalClaims} claims
                        </span>
                        <span className={`score ${scoreClass}`} style={{ fontSize: '1.2rem', minWidth: 48, textAlign: 'right' }}>
                          {entry.score}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Per-Question Breakdown */}
        <div className="round-header">
          <span className="round-label">Per-Question Breakdown</span>
        </div>

        {results.map((r, qi) => {
          const councilVote = councilResults.find(cr => cr.questionNum === r.questionNum);
          let swarmBest = null;
          if (r.confidenceScores) {
            const sorted = Object.entries(r.confidenceScores).sort(([,a],[,b]) => (b.score || 0) - (a.score || 0));
            if (sorted.length > 0) swarmBest = sorted[0][0];
          }
          const councilAndSwarmAgree = councilVote && swarmBest && councilVote.winner === swarmBest;

          return (
            <div key={qi} className="eval-card" style={{
              '--card-color': 'var(--accent)', '--card-glow': 'var(--accent-glow)',
              marginBottom: 20, animation: `floatUp 0.5s ease forwards`, animationDelay: `${qi * 0.15}s`, opacity: 0,
            }}>
              {/* Question */}
              <div style={{
                paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12,
              }}>
                <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem', color: 'var(--accent)', marginRight: 8 }}>
                  QUESTION {r.questionNum}
                </span>
                <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{r.question}</span>
              </div>

              {/* Council vs Swarm */}
              {councilVote && (
                <div style={{
                  display: 'flex', gap: 16, marginBottom: 16, padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", marginBottom: 4, letterSpacing: '0.1em' }}>
                      COUNCIL VOTED
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="model-dot" style={{ background: MODEL_CONFIG[councilVote.winner]?.color }} />
                      <span style={{ color: MODEL_CONFIG[councilVote.winner]?.color, fontFamily: "'Orbitron', sans-serif", fontSize: '0.85rem' }}>
                        {MODEL_CONFIG[councilVote.winner]?.name || councilVote.winner}
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", marginBottom: 4, letterSpacing: '0.1em' }}>
                      MOST ACCURATE (SWARM)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {swarmBest && (
                        <>
                          <span className="model-dot" style={{ background: MODEL_CONFIG[swarmBest]?.color }} />
                          <span style={{ color: MODEL_CONFIG[swarmBest]?.color, fontFamily: "'Orbitron', sans-serif", fontSize: '0.85rem' }}>
                            {MODEL_CONFIG[swarmBest]?.name || swarmBest}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 4, fontSize: '0.7rem',
                      fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em',
                      background: councilAndSwarmAgree ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `1px solid ${councilAndSwarmAgree ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      color: councilAndSwarmAgree ? '#10B981' : '#EF4444',
                    }}>
                      {councilAndSwarmAgree ? 'CONFIRMED' : 'DIFFERS'}
                    </span>
                  </div>
                </div>
              )}

              {/* Verified Answer */}
              {r.synthesis && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontFamily: "'Orbitron', sans-serif", marginBottom: 8, letterSpacing: '0.1em' }}>
                    VERIFIED ANSWER
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--bg-deep)', borderRadius: 6, padding: 12 }}>
                    <ReactMarkdown>{r.synthesis.answer}</ReactMarkdown>
                  </div>
                  {r.synthesis.citations?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 4 }}>Sources:</div>
                      {r.synthesis.citations.map((c, ci) => (
                        <div key={ci} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 2 }}>
                          [{c.index}] {c.source ? (
                            <a href={c.source} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }}>{c.source}</a>
                          ) : c.claim}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Per-model confidence */}
              {r.confidenceScores && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: "'Orbitron', sans-serif", marginBottom: 6, letterSpacing: '0.1em' }}>
                    MODEL ACCURACY
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(r.confidenceScores)
                      .sort(([,a],[,b]) => (b.score || 0) - (a.score || 0))
                      .map(([id, s]) => {
                        const config = MODEL_CONFIG[id];
                        const pct = Math.round(s.score || 0);
                        return (
                          <div key={id} style={{
                            background: 'var(--bg-deep)', borderRadius: 6, padding: '6px 12px',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem',
                          }}>
                            <span className="model-dot" style={{ background: config?.color }} />
                            <span style={{ color: config?.color }}>{config?.name}</span>
                            <span style={{ color: pct >= 80 ? '#10B981' : pct >= 50 ? 'var(--accent)' : '#EF4444' }}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
            No verification results available.
          </div>
        )}
      </section>

      <div style={{ height: 60 }} />
    </>
  );
}

// ── Router ───────────────────────────────────────────────────

export default function App() {
  // Simple hash check — shadow window hash never changes after page load
  if (window.location.hash === '#/shadow') return <ShadowWindow />;
  return <MainApp />;
}
