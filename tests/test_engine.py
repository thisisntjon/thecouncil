from __future__ import annotations
from typing import Any, Callable, Dict, Optional

import pytest

from council.config import AppConfig, CouncilSettings
from council.engine import CouncilEngine
from council.providers.base import ProviderResponse, ProviderSettings, SupportsChatCompletion


class NoopCache:
    def get(self, provider: str, prompt: str) -> None:
        return None

    def set(self, provider: str, prompt: str, response: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        return None


class StubProvider(SupportsChatCompletion):
    def __init__(self, name: str, model: str, handler: Callable[[str], ProviderResponse | str]) -> None:
        super().__init__(
            ProviderSettings(
                name=name,
                model=model,
                api_key="test-key",
            )
        )
        self._handler = handler
        self.last_prompt: Optional[str] = None

    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        self.last_prompt = prompt
        result = self._handler(prompt)
        if isinstance(result, ProviderResponse):
            return result
        return ProviderResponse(
            content=result,
            provider=self.settings.name,
            model=self.settings.model,
        )


def make_response(provider: str, model: str, content: str) -> ProviderResponse:
    return ProviderResponse(content=content, provider=provider, model=model)


@pytest.mark.asyncio
async def test_engine_applies_scores_and_overall_feedback() -> None:
    config = AppConfig(
        models={},
        council=CouncilSettings(
            members=("model_a", "model_b"),
            rater="rater",
            synthesizer="synth",
        ),
    )
    engine = CouncilEngine(config=config, cache=NoopCache(), enable_cache=False)

    rating_payload = """```json
{
  "scores": {
    "model_a": {"score": 92, "feedback": "Precise and well-supported."},
    "model_b": {"score": 78, "feedback": "Solid but misses key nuance."}
  },
  "overall_feedback": "Models largely agree; GPT variant leads with detail."
}
```"""

    engine.providers = {
        "model_a": StubProvider("model_a", "stub-a", lambda _: make_response("stub", "stub-a", "Answer from A.")),
        "model_b": StubProvider("model_b", "stub-b", lambda _: make_response("stub", "stub-b", "Answer from B.")),
        "rater": StubProvider("rater", "stub-rater", lambda _: make_response("stub", "stub-rater", rating_payload)),
        "synth": StubProvider("synth", "stub-synth", lambda _: make_response("stub", "stub-synth", "Unified council answer.")),
    }

    result = await engine.run("What is The Council?")

    assert result.final_answer == "Unified council answer."
    assert result.overall_feedback == "Models largely agree; GPT variant leads with detail."
    assert result.members["model_a"].feedback.score == 92
    assert result.members["model_a"].feedback.feedback == "Precise and well-supported."
    assert result.members["model_b"].feedback.score == 78


@pytest.mark.asyncio
async def test_engine_handles_rating_failures() -> None:
    config = AppConfig(
        models={},
        council=CouncilSettings(
            members=("model_a",),
            rater="rater",
            synthesizer="synth",
        ),
    )
    engine = CouncilEngine(config=config, cache=NoopCache(), enable_cache=False)

    def raise_error(_: str) -> ProviderResponse:
        raise RuntimeError("rater unavailable")

    engine.providers = {
        "model_a": StubProvider("model_a", "stub-a", lambda _: make_response("stub", "stub-a", "Answer from A.")),
        "rater": StubProvider("rater", "stub-rater", raise_error),
        "synth": StubProvider("synth", "stub-synth", lambda _: make_response("stub", "stub-synth", "Fallback answer.")),
    }

    result = await engine.run("How do we test resilience?")

    assert result.final_answer == "Fallback answer."
    member_feedback = result.members["model_a"].feedback.feedback
    assert member_feedback is not None and "Rating failed" in member_feedback
    assert result.overall_feedback is None


@pytest.mark.asyncio
async def test_synthesis_preserves_member_order_on_tie_scores() -> None:
    config = AppConfig(
        models={},
        council=CouncilSettings(
            members=("model_a", "model_b"),
            rater="rater",
            synthesizer="synth",
        ),
    )
    engine = CouncilEngine(config=config, cache=NoopCache(), enable_cache=False)

    rating_payload = """{
  "scores": {
    "model_a": {"score": 88, "feedback": "Great coverage."},
    "model_b": {"score": 88, "feedback": "Matches the brief."}
  }
}"""

    synth_provider = StubProvider("synth", "stub-synth", lambda _: make_response("stub", "stub-synth", "Tie synthesis."))

    engine.providers = {
        "model_a": StubProvider("model_a", "stub-a", lambda _: make_response("stub", "stub-a", "Answer from A.")),
        "model_b": StubProvider("model_b", "stub-b", lambda _: make_response("stub", "stub-b", "Answer from B.")),
        "rater": StubProvider("rater", "stub-rater", lambda _: rating_payload),
        "synth": synth_provider,
    }

    result = await engine.run("How do ties behave?")

    assert result.final_answer == "Tie synthesis."
    assert result.members["model_a"].feedback.score == 88
    assert result.members["model_b"].feedback.score == 88
    prompt = synth_provider.last_prompt or ""
    idx_a = prompt.index("### model_a")
    idx_b = prompt.index("### model_b")
    assert idx_a < idx_b, "Member order should match original when scores tie."


@pytest.mark.asyncio
async def test_synthesis_skips_members_without_content() -> None:
    config = AppConfig(
        models={},
        council=CouncilSettings(
            members=("model_a", "model_b"),
            rater="rater",
            synthesizer="synth",
        ),
    )
    engine = CouncilEngine(config=config, cache=NoopCache(), enable_cache=False)

    rating_payload = """{
  "scores": {
    "model_a": {"score": 90, "feedback": "Robust."},
    "model_b": {"score": 40, "feedback": "Missing content."}
  }
}"""

    synth_provider = StubProvider("synth", "stub-synth", lambda _: make_response("stub", "stub-synth", "Content-aware synthesis."))

    engine.providers = {
        "model_a": StubProvider("model_a", "stub-a", lambda _: make_response("stub", "stub-a", "Primary answer.")),
        "model_b": StubProvider("model_b", "stub-b", lambda _: make_response("stub", "stub-b", "")),
        "rater": StubProvider("rater", "stub-rater", lambda _: rating_payload),
        "synth": synth_provider,
    }

    result = await engine.run("Who gets included?")

    assert result.final_answer == "Content-aware synthesis."
    assert result.members["model_b"].content == ""
    prompt = synth_provider.last_prompt or ""
    assert "### model_b" not in prompt
