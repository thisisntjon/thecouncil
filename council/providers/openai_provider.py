from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from .base import ProviderResponse, ProviderSettings, SupportsChatCompletion


class OpenAIProvider(SupportsChatCompletion):
    """
    Adapter for OpenAI's chat completion API.
    """

    endpoint = "https://api.openai.com/v1/chat/completions"

    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        payload = self._build_payload(prompt, kwargs)
        headers = {
            "Authorization": f"Bearer {self.settings.api_key}",
        }
        timeout = kwargs.get("timeout", 60.0)
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                self.endpoint,
                headers=headers,
                json=payload,
            )
        
        response.raise_for_status()
        data = response.json()
        
        if not data.get("choices"):
            raise ValueError("No choices returned from OpenAI API")
        
        choice = data["choices"][0]["message"]
        return ProviderResponse(
            content=choice.get("content", ""),
            provider="openai",
            model=data.get("model", self.settings.model),
            usage=data.get("usage"),
            raw=data,
        )

    def _build_payload(self, prompt: str, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        messages: Optional[List[Dict[str, Any]]] = kwargs.get("messages")
        if not messages:
            messages = [{"role": "user", "content": prompt}]
        payload = {
            "model": self.settings.model,
            "messages": messages,
            **self.settings.params,
        }
        payload.update(kwargs.get("payload_overrides", {}))
        return payload
