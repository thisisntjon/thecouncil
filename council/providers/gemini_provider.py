from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from .base import ProviderResponse, ProviderSettings, SupportsChatCompletion


class GeminiProvider(SupportsChatCompletion):
    """
    Adapter for Google Gemini Generative Language API.
    """

    base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        payload = self._build_payload(prompt, kwargs)
        params = {"key": self.settings.api_key}
        timeout = kwargs.get("timeout", 60.0)
        url = f"{self.base_url}/models/{self.settings.model}:generateContent"
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, params=params, json=payload)
        
        response.raise_for_status()
        data = response.json()
        
        text = ""
        if "candidates" in data and data["candidates"]:
            parts = data["candidates"][0].get("content", {}).get("parts", [])
            text = "".join(part.get("text", "") for part in parts)
        
        return ProviderResponse(
            content=text,
            provider="gemini",
            model=data.get("model", self.settings.model),
            usage=data.get("usageMetadata"),
            raw=data,
        )

    def _build_payload(self, prompt: str, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        messages: Optional[List[Dict[str, Any]]] = kwargs.get("messages")
        if messages:
            contents = [
                {
                    "role": message.get("role", "user"),
                    "parts": [{"text": message.get("content", "")}],
                }
                for message in messages
            ]
        else:
            contents = [{"role": "user", "parts": [{"text": prompt}]}]

        payload: Dict[str, Any] = {"contents": contents}
        if self.settings.params:
            payload.setdefault("generationConfig", self.settings.params)
        overrides = kwargs.get("payload_overrides", {})
        if overrides:
            payload.update(overrides)
        return payload
