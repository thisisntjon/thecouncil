from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from .base import ProviderResponse, ProviderSettings, SupportsChatCompletion


class AnthropicProvider(SupportsChatCompletion):
    """
    Adapter for Anthropic Claude messages API.
    """

    endpoint = "https://api.anthropic.com/v1/messages"
    api_version = "2023-06-01"

    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        payload = self._build_payload(prompt, kwargs)
        headers = {
            "x-api-key": self.settings.api_key,
            "anthropic-version": self.api_version,
            "content-type": "application/json",
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
        
        content_blocks = data.get("content", [])
        text = ""
        if content_blocks:
            text = "".join(block.get("text", "") for block in content_blocks if block.get("type") == "text")
        
        return ProviderResponse(
            content=text,
            provider="anthropic",
            model=data.get("model", self.settings.model),
            usage=data.get("usage"),
            raw=data,
        )

    def _build_payload(self, prompt: str, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        messages: Optional[List[Dict[str, Any]]] = kwargs.get("messages")
        if not messages:
            messages = [{"role": "user", "content": prompt}]
        normalized_messages: List[Dict[str, Any]] = []
        for message in messages:
            content = message.get("content", "")
            if isinstance(content, str):
                parts = [{"type": "text", "text": content}]
            elif isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict) and "type" in part:
                        parts.append(part)
                    else:
                        parts.append({"type": "text", "text": str(part)})
            else:
                parts = [{"type": "text", "text": str(content)}]
            normalized_messages.append(
                {
                    "role": message.get("role", "user"),
                    "content": parts,
                }
            )
        payload = {
            "model": self.settings.model,
            "messages": normalized_messages,
            **self.settings.params,
        }
        payload.setdefault("max_tokens", 1024)
        payload.update(kwargs.get("payload_overrides", {}))
        return payload
