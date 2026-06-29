# Video Narration — TTS-Ready Blocks

Paste-ready narration for an AI voiceover. Each block has the **on-screen action in [brackets]** and
the **spoken text in a code fence** (copy the fenced text straight into your TTS tool). Generate one clip
per block so you can sync each to its screen-recording. Target voice: calm, clear, ~150 words/min.
Total spoken ≈ 3.5 min, leaving room for on-screen pauses to stay under the 5-minute limit. Track: Freestyle.

---

### Block 1 — Hook · 0:00–0:20
[On-screen: `screenshots/cover.html` (title card)]

```
A single AI answer can sound confident even when it's incomplete. The Council asks a simple question: what if an answer had to survive independent agents, peer critique, and claim-level verification before it became final?
```

### Block 2 — What it is · 0:20–0:50
[On-screen: cover, then a quick flash of the live app]

```
The Council is a multi-agent verification swarm. Four agents answer a question independently. They critique each other. Then a hidden verification swarm extracts the claims and re-checks each one against a different model vendor before producing an auditable final answer.
```

### Block 3 — Architecture · 0:50–1:25
[On-screen: `screenshots/architecture.html` — point to the seven stages]

```
Here's the architecture. Input is redacted, four agents answer independently, they peer-review each other, a hidden swarm extracts and verifies claims, and the system synthesizes a final answer with a full audit trail. The key idea from the course is that this isn't just a chatbot. The model is only about ten percent of it. The other ninety percent is the harness: redaction, role separation, tool boundaries, verification, and audit export. What you're about to see is live mode, and everything is also reproducible offline with no keys, which I'll show right after.
```

### Block 4a — Live demo: Round 1 · 1:25–2:05
[On-screen: type a question in the live UI, click Ask; all four model cards stream]

```
I'll ask the Council a question. Round one: all four models — Claude, GPT, Gemini, and Grok — answer independently, streaming their reasoning live.
```

### Block 4b — Live demo: consensus · 2:05–2:25
[On-screen: click "Convene the Council"; Round 2 judge cards + consensus score appear]

```
Now I convene the Council. The agents peer-evaluate each other, and a consensus score forms.
```

### Block 4c — Live demo: cross-vendor verification · 2:25–3:00
[On-screen: Round 3 swarm runs in parallel — verdict badges, confidence bars, "verified by" tags]

```
And this is the part I'm proudest of. A cross-vendor verification swarm runs in parallel. Every claim is re-checked by a different vendor than the one that wrote it. You can see the verdicts, the confidence bars, and a "verified by" tag on each claim. It even refutes weak claims from the winning answer. It's a skeptic that checks the winner, not a rubber stamp.
```

### Block 4d — Live demo: verdict · 3:00–3:15
[On-screen: the final "The Council has decided" verdict]

```
That cross-vendor check is the whole idea: independent answers, then independent verification, with the uncertainty kept visible instead of smoothed into one overconfident reply.
```

### Block 5 — Reproducible offline · 3:15–3:55
[On-screen: terminal `npm run demo:fixture`, then `sample_outputs/latest_fixture_report.md`]

```
Live mode needs your own provider keys, but the architecture is fully reproducible with none. I run one command — demo fixture. It's deterministic and offline, so a reviewer can re-run this and get identical verification content: the same four agents, twelve verified claims, and confidence summary. That's the path in the public repository.
```

### Block 6 — Security, evaluation, audit · 3:55–4:35
[On-screen: `SECURITY_AND_PRIVACY.md`, then the audit JSON / `screenshots/demo-output.html`]

```
A quick word on safety and evaluation. The default path needs no keys. Environment files are ignored, examples use placeholders, input redaction catches common sensitive patterns, and a tool allowlist keeps the agent bounded. The JSON report is a trajectory-style audit trail: every answer, critique, verified claim, and confidence score. I also ran ten hard questions through the pipeline. All produced an auditable answer, a prompt-injection attempt was resisted, and the evaluation surfaced honest weaknesses instead of hiding them.
```

### Block 7 — Close · 4:35–5:00
[On-screen: the verdict screen, then the cover card]

```
The Council is useful when a wrong answer is costly: research, policy, security, or strategy. Fixture mode proves the workflow, not live model quality, and the MCP piece is a lightweight stub, not a production server. The takeaway is that reliable agent systems aren't just about adding agents. They're about separating roles, preserving disagreement, checking claims across vendors, and making the final answer auditable. That's the Council.
```

---

## Production notes
- **Pacing:** record the screen first, then trim each narration clip to its shot — easier than the reverse.
- **The live demo (Blocks 4a–4d) is the hero;** let the UI breathe — a few seconds of silent streaming reads well.
- **Pre-stage the live run:** server :3001, client :5173, shadow :3002 up with your keys; use a crisp question (the car-wash one demos cleanly).
- **Numbers are spelled out** for clean TTS (e.g. "ten percent," "twelve verified claims"); keep them that way if you re-edit.
- **Captions:** auto-generate YouTube captions and skim them — graders value clarity, and captions also cover any TTS mispronunciation.
