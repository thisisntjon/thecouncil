"""
Prompt templates for rating and synthesis phases.
"""

RATING_PROMPT = """You are an expert evaluator. Review the following model responses to the same user question.
You must return a JSON object with the schema:
{{
  "scores": {{
    "model_id": {{
      "score": <integer 0-100>,
      "feedback": "<succinct critique>"
    }}
  }},
  "overall_feedback": "<one paragraph summary>"
}}

User question:
{question}

Model responses:
{responses}

Respond with JSON only."""

SYNTHESIS_PROMPT = """You are the chair of an AI council. Using the highest quality insights from the rated responses,
produce a single, direct answer for the user. Address weaknesses raised in feedback and attribute unique insights.

User question:
{question}

Top responses to consider:
{top_responses}

Return a concise answer (plain text)."""
