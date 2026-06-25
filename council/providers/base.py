from __future__ import annotations

import abc
import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx

from ..exceptions import ProviderError, ConfigurationError
from ..logging_config import get_provider_logger


@dataclass
class ProviderSettings:
    name: str
    model: str
    api_key: str
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderResponse:
    content: str
    provider: str
    model: str
    usage: Optional[Dict[str, Any]] = None
    raw: Optional[Dict[str, Any]] = None


class SupportsChatCompletion(abc.ABC):
    """
    Abstract base for chat-completion capable providers.
    """

    def __init__(self, settings: ProviderSettings) -> None:
        if not settings.api_key:
            raise ConfigurationError(
                f"Missing API key for provider '{settings.name}'",
                config_key=f"{settings.name}_api_key",
                suggestion=f"Set the API key for {settings.name} in your environment variables or configuration file"
            )
        self.settings = settings
        self.logger = get_provider_logger(settings.name)
        self._consecutive_failures = 0
        self._last_failure_time: Optional[float] = None

    @abc.abstractmethod
    async def _make_request(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """
        Make the actual API request. Subclasses should implement this method
        instead of complete() to get automatic error handling and retry logic.
        """
        ...

    async def complete(self, prompt: str, **kwargs: Any) -> ProviderResponse:
        """
        Complete a prompt with automatic error handling and retry logic.
        """
        max_retries = kwargs.get("max_retries", 3)
        base_delay = kwargs.get("base_delay", 1.0)
        
        for attempt in range(max_retries + 1):
            try:
                # Check if we should apply backoff due to consecutive failures
                if self._should_backoff():
                    backoff_delay = self._calculate_backoff_delay()
                    self.logger.info(
                        "Applying backoff due to consecutive failures",
                        extra={
                            "backoff_delay": backoff_delay,
                            "consecutive_failures": self._consecutive_failures
                        }
                    )
                    await asyncio.sleep(backoff_delay)
                
                self.logger.debug(
                    "Making API request",
                    extra={
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "prompt_length": len(prompt)
                    }
                )
                
                response = await self._make_request(prompt, **kwargs)
                
                # Reset failure tracking on success
                self._consecutive_failures = 0
                self._last_failure_time = None
                
                self.logger.debug(
                    "API request successful",
                    extra={
                        "attempt": attempt + 1,
                        "response_length": len(response.content) if response.content else 0,
                        "model": response.model
                    }
                )
                
                return response
                
            except httpx.HTTPStatusError as exc:
                self._record_failure()
                
                if exc.response.status_code == 401:
                    raise ProviderError(
                        "Authentication failed - invalid API key",
                        provider=self.settings.name,
                        model=self.settings.model,
                        suggestion=f"Check your API key for {self.settings.name}. Ensure it's valid and has the necessary permissions.",
                        original_error=exc
                    )
                elif exc.response.status_code == 403:
                    raise ProviderError(
                        "Access forbidden - insufficient permissions",
                        provider=self.settings.name,
                        model=self.settings.model,
                        suggestion=f"Your API key for {self.settings.name} doesn't have permission to access this resource.",
                        original_error=exc
                    )
                elif exc.response.status_code == 429:
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        self.logger.warning(
                            "Rate limited, retrying",
                            extra={
                                "attempt": attempt + 1,
                                "delay": delay,
                                "status_code": exc.response.status_code
                            }
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise ProviderError(
                            "Rate limit exceeded",
                            provider=self.settings.name,
                            model=self.settings.model,
                            suggestion="Wait before making more requests or check your rate limits.",
                            original_error=exc
                        )
                elif 500 <= exc.response.status_code < 600:
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        self.logger.warning(
                            "Server error, retrying",
                            extra={
                                "attempt": attempt + 1,
                                "delay": delay,
                                "status_code": exc.response.status_code
                            }
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise ProviderError(
                            f"Server error: {exc.response.status_code}",
                            provider=self.settings.name,
                            model=self.settings.model,
                            suggestion="The provider's servers are experiencing issues. Try again later.",
                            original_error=exc
                        )
                else:
                    raise ProviderError(
                        f"HTTP error: {exc.response.status_code}",
                        provider=self.settings.name,
                        model=self.settings.model,
                        original_error=exc
                    )
                    
            except httpx.TimeoutException as exc:
                self._record_failure()
                
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    self.logger.warning(
                        "Request timeout, retrying",
                        extra={
                            "attempt": attempt + 1,
                            "delay": delay
                        }
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise ProviderError(
                        "Request timeout",
                        provider=self.settings.name,
                        model=self.settings.model,
                        suggestion="The request took too long. Try again or check your network connection.",
                        original_error=exc
                    )
                    
            except httpx.NetworkError as exc:
                self._record_failure()
                
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    self.logger.warning(
                        "Network error, retrying",
                        extra={
                            "attempt": attempt + 1,
                            "delay": delay,
                            "error": str(exc)
                        }
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise ProviderError(
                        "Network error",
                        provider=self.settings.name,
                        model=self.settings.model,
                        suggestion="Check your internet connection and try again.",
                        original_error=exc
                    )
                    
            except Exception as exc:
                self._record_failure()
                
                self.logger.exception(
                    "Unexpected error in provider",
                    extra={
                        "attempt": attempt + 1,
                        "error_type": type(exc).__name__
                    }
                )
                
                raise ProviderError(
                    f"Unexpected error: {exc}",
                    provider=self.settings.name,
                    model=self.settings.model,
                    suggestion="This is an unexpected error. Please check the logs for more details.",
                    original_error=exc
                )
        
        # This should never be reached due to the exception handling above
        raise ProviderError(
            "Maximum retries exceeded",
            provider=self.settings.name,
            model=self.settings.model,
            suggestion="All retry attempts failed. Check your configuration and network connection."
        )
    
    def _record_failure(self) -> None:
        """Record a failure for backoff calculation."""
        self._consecutive_failures += 1
        self._last_failure_time = time.time()
    
    def _should_backoff(self) -> bool:
        """Check if we should apply backoff due to consecutive failures."""
        return (
            self._consecutive_failures >= 2 and
            self._last_failure_time is not None and
            time.time() - self._last_failure_time < 300  # 5 minutes
        )
    
    def _calculate_backoff_delay(self) -> float:
        """Calculate backoff delay based on consecutive failures."""
        # Exponential backoff: 2^(failures-2) seconds, max 60 seconds
        return min(2 ** (self._consecutive_failures - 2), 60.0)
