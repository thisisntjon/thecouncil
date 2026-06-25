from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .cache import CacheRecord, SQLiteCache
from .config import AppConfig, ProviderModelConfig, load_config
from .exceptions import ProviderError, RatingError, SynthesisError
from .logging_config import get_engine_logger, LogContext
from .providers import (
    AnthropicProvider,
    GeminiProvider,
    HuggingFaceProvider,
    OpenAIProvider,
    ProviderResponse,
    ProviderSettings,
    SupportsChatCompletion,
    XAIProvider,
)
from .prompts import RATING_PROMPT, SYNTHESIS_PROMPT


PROVIDER_REGISTRY = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
    "xai": XAIProvider,
    "huggingface": HuggingFaceProvider,
}

logger = get_engine_logger()


@dataclass
class MemberFeedback:
    score: Optional[int] = None
    feedback: Optional[str] = None


@dataclass
class MemberResult:
    name: str
    provider: str
    model: str
    content: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    raw: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    feedback: MemberFeedback = field(default_factory=MemberFeedback)


@dataclass
class CouncilResult:
    question: str
    members: Dict[str, MemberResult]
    final_answer: Optional[str]
    overall_feedback: Optional[str]
    rating_raw: Optional[Dict[str, Any]] = None


class CouncilEngine:
    """
    Orchestrates multi-model querying, rating, and synthesis.
    """

    def __init__(
        self,
        config: Optional[AppConfig] = None,
        cache: Optional[SQLiteCache] = None,
        enable_cache: bool = True,
    ) -> None:
        self.config = config or load_config()
        self.cache = cache or SQLiteCache()
        self.enable_cache = enable_cache
        self.providers: Dict[str, SupportsChatCompletion] = self._init_providers(self.config.models)
        self._rating_payload: Optional[Dict[str, Any]] = None
        self._overall_feedback: Optional[str] = None

    def _init_providers(self, models: Dict[str, ProviderModelConfig]) -> Dict[str, SupportsChatCompletion]:
        instantiated: Dict[str, SupportsChatCompletion] = {}
        for name, model in models.items():
            provider_cls = PROVIDER_REGISTRY.get(model.provider)
            if not provider_cls:
                continue
            if not model.api_key:
                continue
            settings = ProviderSettings(
                name=name,
                model=model.model,
                api_key=model.api_key,
                params=model.params,
            )
            instantiated[name] = provider_cls(settings)
        return instantiated

    async def run(self, question: str) -> CouncilResult:
        with LogContext() as correlation_id:
            member_names = list(self.config.council.members)
            logger.info(
                "Running council with %d members", 
                len(member_names),
                extra={"member_count": len(member_names), "members": list(member_names)}
            )
            
            members = await self._collect_member_responses(question, member_names)
            rated = await self._rate_members(question, members)
            final_answer, overall_feedback = await self._synthesize_answer(question, members, rated)
            
            logger.info(
                "Council run complete", 
                extra={
                    "has_final_answer": bool(final_answer),
                    "has_overall_feedback": bool(overall_feedback),
                    "successful_members": len([m for m in members.values() if m.content and not m.error])
                }
            )
            
            return CouncilResult(
                question=question,
                members=rated,
                final_answer=final_answer,
                overall_feedback=overall_feedback,
                rating_raw=self._rating_payload,
            )

    async def _collect_member_responses(self, question: str, member_names: List[str]) -> Dict[str, MemberResult]:
        async def gather_member(name: str) -> Tuple[str, MemberResult]:
            provider = self.providers.get(name)
            if not provider:
                logger.warning(
                    "Provider not configured; skipping",
                    extra={"provider": name, "reason": "not_configured"}
                )
                return name, MemberResult(
                    name=name,
                    provider="unknown",
                    model="unknown",
                    error="Provider not configured or missing API key.",
                )
            
            cached = self.cache.get(name, question) if self.enable_cache else None
            if cached:
                logger.debug(
                    "Cache hit for provider",
                    extra={"provider": name, "cache_enabled": self.enable_cache}
                )
                return name, self._record_from_cache(name, provider, cached)

            try:
                logger.debug(
                    "Calling provider",
                    extra={"provider": name, "model": provider.settings.model}
                )
                response = await provider.complete(question)
                
                if self.enable_cache:
                    self.cache.set(
                        name,
                        question,
                        response.content,
                        metadata={"usage": response.usage},
                    )
                
                logger.debug(
                    "Provider response received",
                    extra={
                        "provider": name,
                        "model": response.model,
                        "content_length": len(response.content) if response.content else 0,
                        "usage": response.usage
                    }
                )
                
                return name, MemberResult(
                    name=name,
                    provider=response.provider,
                    model=response.model,
                    content=response.content,
                    usage=response.usage,
                    raw=response.raw,
                )
            except httpx.HTTPError as exc:
                detail = str(exc)
                if exc.response is not None:
                    try:
                        detail = f"{detail} | body: {exc.response.text}"
                    except Exception:
                        pass
                
                logger.error(
                    "HTTP error from provider",
                    extra={
                        "provider": name,
                        "model": provider.settings.model,
                        "error_detail": detail,
                        "status_code": getattr(exc.response, 'status_code', None) if exc.response else None
                    }
                )
                
                return name, MemberResult(
                    name=name,
                    provider=getattr(provider, "__class__", type(provider)).__name__,
                    model=provider.settings.model,
                    error=f"HTTP error: {detail}",
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception(
                    "Unhandled error from provider",
                    extra={
                        "provider": name,
                        "model": provider.settings.model,
                        "error_type": type(exc).__name__
                    }
                )
                
                return name, MemberResult(
                    name=name,
                    provider=getattr(provider, "__class__", type(provider)).__name__,
                    model=provider.settings.model,
                    error=f"Unhandled error: {exc}",
                )

        results = await asyncio.gather(*(gather_member(name) for name in member_names))
        return dict(results)

    def _record_from_cache(self, name: str, provider: SupportsChatCompletion, cached: CacheRecord) -> MemberResult:
        metadata = cached.metadata or {}
        return MemberResult(
            name=name,
            provider=provider.settings.name,
            model=provider.settings.model,
            content=cached.response,
            usage=metadata.get("usage"),
        )

    async def _rate_members(self, question: str, members: Dict[str, MemberResult]) -> Dict[str, MemberResult]:
        rater_name = self.config.council.rater
        rater = self.providers.get(rater_name)
        if not rater:
            logger.warning(
                "Rater unavailable; skipping rating",
                extra={"rater": rater_name, "reason": "not_configured"}
            )
            return members
        
        self._rating_payload = None
        self._overall_feedback = None

        responses_block = "\n\n".join(
            f"### {name}\n{member.content or member.error or 'No response'}"
            for name, member in members.items()
        )
        prompt = RATING_PROMPT.format(question=question, responses=responses_block)
        
        try:
            logger.debug(
                "Starting rating phase",
                extra={
                    "rater": rater_name,
                    "member_count": len(members),
                    "prompt_length": len(prompt)
                }
            )
            
            response = await rater.complete(prompt)
            
            logger.debug(
                "Rating response received",
                extra={
                    "rater": rater_name,
                    "response_length": len(response.content) if response.content else 0
                }
            )
            
        except Exception as exc:
            logger.error(
                "Rating step failed",
                extra={
                    "rater": rater_name,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc)
                }
            )
            
            for member in members.values():
                member.feedback = MemberFeedback(feedback=f"Rating failed: {exc}")
            return members

        rating_payload = self._parse_rating_payload(response.content)
        self._rating_payload = rating_payload
        
        rated_count = 0
        for name, member in members.items():
            entry = rating_payload.get("scores", {}).get(name)
            if entry:
                member.feedback = MemberFeedback(
                    score=entry.get("score"),
                    feedback=entry.get("feedback"),
                )
                rated_count += 1
        
        overall = rating_payload.get("overall_feedback")
        if overall:
            self._overall_feedback = overall
        
        logger.debug(
            "Ratings applied",
            extra={
                "total_members": len(members),
                "rated_members": rated_count,
                "has_overall_feedback": bool(overall)
            }
        )
        
        return members

    async def _synthesize_answer(
        self,
        question: str,
        members: Dict[str, MemberResult],
        rated: Dict[str, MemberResult],
    ) -> Tuple[Optional[str], Optional[str]]:
        synth_name = self.config.council.synthesizer
        synthesizer = self.providers.get(synth_name)
        if not synthesizer:
            logger.warning("Synthesizer '%s' unavailable; skipping.", synth_name)
            return None, None

        scored_members = [
            (name, member)
            for name, member in rated.items()
            if name != "_overall" and member.content
        ]
        scored_members.sort(
            key=lambda item: (item[1].feedback.score or 0),
            reverse=True,
        )
        top_block = "\n\n".join(
            f"### {name} (score: {member.feedback.score or 'n/a'})\n{member.content}"
            for name, member in scored_members
        )
        prompt = SYNTHESIS_PROMPT.format(question=question, top_responses=top_block)
        try:
            response = await synthesizer.complete(prompt)
            overall = self._overall_feedback
            return response.content, overall
        except Exception as exc:
            logger.error("Synthesis step failed: %s", exc)
            return None, f"Synthesis failed: {exc}"

    def _parse_rating_payload(self, content: str) -> Dict[str, Any]:
        try:
            cleaned = content.strip().strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            result = json.loads(cleaned)
            
            logger.debug(
                "Successfully parsed rating payload",
                extra={
                    "scores_count": len(result.get("scores", {})),
                    "has_overall_feedback": "overall_feedback" in result
                }
            )
            
            return result
        except json.JSONDecodeError as exc:
            logger.warning(
                "Failed to parse rating payload as JSON",
                extra={
                    "content_preview": content[:200] if content else None,
                    "json_error": str(exc)
                }
            )
            return {}


async def run_council(question: str, enable_cache: bool = True) -> CouncilResult:
    engine = CouncilEngine(enable_cache=enable_cache)
    return await engine.run(question)
