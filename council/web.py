from __future__ import annotations

import textwrap
import logging
from functools import lru_cache
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from .engine import CouncilEngine, MemberResult

logger = logging.getLogger("council.web")
DEFAULT_INSTRUCTION = "Review the context and provide a concise summary, risks, and recommended next steps."


def create_app() -> FastAPI:
    app = FastAPI(title="The Council", description="Local Council chat interface", version="0.1.0")

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: RequestValidationError, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Validation error: %s", exc.errors())
        message = "; ".join(_format_validation_error(err) for err in exc.errors())
        return JSONResponse(status_code=400, content={"detail": message or "Invalid request."})

    @app.get("/", response_class=HTMLResponse)
    async def index() -> str:
        return HTML_PAGE

    class CouncilRequest(BaseModel):
        question: Optional[str] = Field(None, description="Prompt or question for the council.")
        context: Optional[str] = Field(None, description="Optional long-form context to analyze.")
        use_cache: bool = Field(True, description="Reuse cached responses when available.")

    @app.post("/api/council")
    async def run_council(req: CouncilRequest) -> Dict[str, object]:
        question = (req.question or "").strip()
        context = (req.context or "").strip()
        if not question and not context:
            raise HTTPException(status_code=400, detail="Provide at least a question or some context.")

        prompt, effective_question = build_prompt(question, context)
        engine = get_engine(req.use_cache)
        logger.info(
            "Running council: question='%s...', context_chars=%d, cache=%s",
            effective_question[:80],
            len(context),
            req.use_cache,
        )
        try:
            result = await engine.run(prompt)
        except Exception as exc:  # pragma: no cover - surfaced to client
            logger.exception("Council execution failed: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        members_payload = serialize_members(result.members)
        return {
            "final_answer": result.final_answer,
            "overall_feedback": result.overall_feedback,
            "members": members_payload,
            "question": effective_question,
            "context_excerpt": context[:5000],
        }

    return app


def build_prompt(question: str, context: Optional[str]) -> tuple[str, str]:
    effective_question = question or DEFAULT_INSTRUCTION
    if not context:
        return effective_question, effective_question
    prompt = textwrap.dedent(
        f"""You will review the following report or context and provide the requested analysis.

Instructions for the council:
{effective_question}

--- Begin Context ---
{context}
--- End Context ---"""
    ).strip()
    return prompt, effective_question


def serialize_members(members: Dict[str, MemberResult]) -> List[Dict[str, object]]:
    serialized: List[Dict[str, object]] = []
    for name, member in members.items():
        serialized.append(
            {
                "name": name,
                "model": member.model,
                "provider": member.provider,
                "score": member.feedback.score,
                "feedback": member.feedback.feedback,
                "content": member.content,
                "error": member.error,
            }
        )
    return serialized


@lru_cache(maxsize=2)
def get_engine(enable_cache: bool) -> CouncilEngine:
    return CouncilEngine(enable_cache=enable_cache)


def _format_validation_error(err: Dict[str, object]) -> str:
    loc = ".".join(str(part) for part in err.get("loc", []))
    msg = str(err.get("msg", "Invalid value"))
    return f"{loc}: {msg}" if loc else msg


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>The Council</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: light dark;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #11161f;
      color: #f2f5f9;
    }
    body {
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 1080px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }
    h1 {
      margin-top: 0;
      font-size: 2.2rem;
    }
    form {
      display: grid;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    label {
      font-weight: 600;
      display: block;
      margin-bottom: 0.5rem;
    }
    textarea, input[type="text"] {
      width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(15, 23, 34, 0.85);
      color: inherit;
      padding: 0.75rem 1rem;
      font-size: 1rem;
      line-height: 1.5;
      resize: vertical;
    }
    textarea {
      min-height: 240px;
    }
    input[type="text"] {
      min-height: 48px;
    }
    button {
      padding: 0.85rem 1.5rem;
      font-size: 1rem;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-weight: 600;
      justify-self: start;
    }
    button:disabled {
      opacity: 0.5;
      cursor: progress;
    }
    .results {
      display: none;
      gap: 1.5rem;
    }
    .results.show {
      display: grid;
    }
    .card {
      background: rgba(15, 23, 34, 0.85);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      padding: 1.5rem;
    }
    .card h2 {
      margin-top: 0;
      font-size: 1.4rem;
      margin-bottom: 0.75rem;
    }
    .members {
      display: grid;
      gap: 1rem;
    }
    .member {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 1rem;
    }
    .member header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.5rem;
      gap: 1rem;
    }
    .member-score {
      font-weight: 600;
      color: #34d399;
    }
    .member pre {
      white-space: pre-wrap;
      background: rgba(255,255,255,0.05);
      padding: 0.75rem;
      border-radius: 8px;
      margin-top: 0.75rem;
      max-height: 280px;
      overflow-y: auto;
    }
    .status {
      margin: 1rem 0;
      font-style: italic;
      color: #9ca3af;
    }
    .error {
      color: #f87171;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <h1>The Council – Report Analysis</h1>
    <p>Paste long-form context (2–4 pages) and specify the analysis you want. The council will rate every model and synthesize a final answer.</p>
    <form id="council-form">
      <div>
        <label for="question">What should the council do?</label>
        <input type="text" id="question" name="question" placeholder="Summarize the key risks, highlight conflicting data points, recommend next steps…" required>
      </div>
      <div>
        <label for="context">Context to analyze</label>
        <textarea id="context" name="context" placeholder="Paste your report, transcript, or long-form notes here..."></textarea>
      </div>
      <label>
        <input type="checkbox" id="use-cache" name="use-cache" checked>
        Reuse cached model responses when prompts repeat
      </label>
      <button type="submit" id="submit-btn">Run Council</button>
      <div class="status" id="status"></div>
    </form>

    <div class="results" id="results">
      <div class="card">
        <h2>Final Council Answer</h2>
        <div id="final-answer"></div>
      </div>
      <div class="card" id="overall-card" style="display:none;">
        <h2>Chair Feedback</h2>
        <div id="overall-feedback"></div>
      </div>
      <div class="card">
        <h2>Member Responses</h2>
        <div class="members" id="members"></div>
      </div>
    </div>
  </div>
  <script>
    const form = document.getElementById("council-form");
    const submitBtn = document.getElementById("submit-btn");
    const statusEl = document.getElementById("status");
    const resultsEl = document.getElementById("results");
    const finalAnswerEl = document.getElementById("final-answer");
    const overallCard = document.getElementById("overall-card");
    const overallFeedbackEl = document.getElementById("overall-feedback");
    const membersEl = document.getElementById("members");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = document.getElementById("question").value.trim();
      const context = document.getElementById("context").value.trim();
      const useCache = document.getElementById("use-cache").checked;
      if (!question) {
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Consulting the council…";
      statusEl.classList.remove("error");
      resultsEl.classList.remove("show");

      try {
        const response = await fetch("/api/council", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, context, use_cache: useCache })
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          const detail = payload && payload.detail ? formatErrorDetail(payload.detail) : `Request failed (${response.status})`;
          throw new Error(detail);
        }

        renderResults(payload);
        statusEl.textContent = "Council complete.";
        statusEl.classList.remove("error");
        resultsEl.classList.add("show");
      } catch (error) {
        console.error(error);
        statusEl.textContent = error.message || "Unexpected error";
        statusEl.classList.add("error");
      } finally {
        submitBtn.disabled = false;
      }
    });

    function renderResults(payload) {
      finalAnswerEl.textContent = payload.final_answer || "No synthesized answer returned.";
      if (payload.overall_feedback) {
        overallFeedbackEl.textContent = payload.overall_feedback;
        overallCard.style.display = "block";
      } else {
        overallFeedbackEl.textContent = "";
        overallCard.style.display = "none";
      }

      membersEl.innerHTML = "";
      (payload.members || []).forEach(member => {
        const wrapper = document.createElement("div");
        wrapper.className = "member";
        const header = document.createElement("header");
        const title = document.createElement("div");
        title.innerHTML = `<strong>${member.name}</strong> · ${member.model}`;
        const score = document.createElement("div");
        score.className = "member-score";
        score.textContent = member.score != null ? `${member.score}/100` : "n/a";
        header.append(title, score);

        const feedback = document.createElement("div");
        feedback.textContent = member.feedback || "No feedback recorded.";

        wrapper.append(header, feedback);

        const bodyText = member.content || member.error;
        if (bodyText) {
          const pre = document.createElement("pre");
          pre.textContent = bodyText;
          wrapper.append(pre);
        }

        membersEl.append(wrapper);
      });
    }

    function formatErrorDetail(detail) {
      if (Array.isArray(detail)) {
        return detail.map(entry => entry.msg || JSON.stringify(entry)).join("; ");
      }
      if (typeof detail === "object" && detail !== null) {
        return detail.msg || JSON.stringify(detail);
      }
      return String(detail);
    }
  </script>
</body>
</html>
"""

app = create_app()


def main(argv: Optional[List[str]] = None) -> None:
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Run The Council web interface.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port number to listen on.")
    parser.add_argument("--reload", action="store_true", help="Enable autoreload (development only).")
    parser.add_argument("--log-level", default="info", help="Logging level (debug, info, warning...).")
    args = parser.parse_args(argv)

    logging.basicConfig(level=args.log_level.upper(), format="%(asctime)s | %(name)s | %(levelname)s | %(message)s")
    uvicorn.run("council.web:app", host=args.host, port=args.port, reload=args.reload, log_level=args.log_level.lower())


if __name__ == "__main__":
    main()
