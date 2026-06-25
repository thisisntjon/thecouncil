from __future__ import annotations

from typing import Any, Dict

import httpx

from .base import ProviderResponse, ProviderSettings, SupportsChatCompletion


class HuggingFaceProvider(SupportsChatCompletion):
    """
    Adapter for Hugging Face Inference Endpoints.
    """

    endpoint_template = "https://api-inference.huggingface.co/models/{model}"

    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        payload = self._build_payload(prompt, kwargs)
        headers = {
            "Authorization": f"Bearer {self.settings.api_key}",
        }
        timeout = kwargs.get("timeout", 60.0)
        url = self.endpoint_template.format(model=self.settings.model)
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, headers=headers, json=payload)
        
        response.raise_for_status()
        data = response.json()
        
        text = ""
        if isinstance(data, list) and data:
            text = data[0].get("generated_text", "")
        elif isinstance(data, dict):
            text = data.get("generated_text") or data.get("text", "")
        
        return ProviderResponse(
            content=text,
            provider="huggingface",
            model=self.settings.model,
            usage=data if isinstance(data, dict) else None,
            raw=data,
        )

    def _build_payload(self, prompt: str, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"inputs": prompt}
        parameters = dict(self.settings.params)
        overrides = kwargs.get("payload_overrides", {})
        if overrides:
            parameters.update(overrides)
        if parameters:
            payload["parameters"] = parameters
        return payload
