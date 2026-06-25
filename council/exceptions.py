"""
Custom exception classes for The Council system.

This module defines a hierarchy of exceptions that provide clear error context
and actionable guidance for different types of failures in the Council system.
"""

from __future__ import annotations

from typing import Optional


class CouncilError(Exception):
    """
    Base exception for all Council-related errors.
    
    This is the root exception class that all other Council exceptions inherit from.
    It provides a consistent interface for error handling throughout the system.
    """
    
    def __init__(
        self, 
        message: str, 
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None
    ) -> None:
        """
        Initialize a Council error.
        
        Args:
            message: Human-readable error description
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
        """
        super().__init__(message)
        self.message = message
        self.suggestion = suggestion
        self.correlation_id = correlation_id
    
    def __str__(self) -> str:
        """Return a formatted error message with optional suggestion."""
        result = self.message
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        return result


class ProviderError(CouncilError):
    """
    Exception for provider-specific errors (API failures, authentication issues, etc.).
    
    This exception is raised when there are issues with AI provider integrations,
    such as API failures, authentication problems, or network issues.
    """
    
    def __init__(
        self,
        message: str,
        provider: str,
        model: Optional[str] = None,
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ) -> None:
        """
        Initialize a provider error.
        
        Args:
            message: Human-readable error description
            provider: Name of the provider that failed
            model: Optional model name that was being used
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
            original_error: Optional original exception that caused this error
        """
        super().__init__(message, suggestion, correlation_id)
        self.provider = provider
        self.model = model
        self.original_error = original_error
    
    def __str__(self) -> str:
        """Return a formatted error message with provider context."""
        result = f"Provider '{self.provider}'"
        if self.model:
            result += f" (model: {self.model})"
        result += f": {self.message}"
        
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        if self.original_error:
            result += f"\n\nOriginal error: {self.original_error}"
        
        return result


class ConfigurationError(CouncilError):
    """
    Exception for configuration and setup errors.
    
    This exception is raised when there are issues with system configuration,
    such as missing API keys, invalid configuration files, or setup problems.
    """
    
    def __init__(
        self,
        message: str,
        config_key: Optional[str] = None,
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None
    ) -> None:
        """
        Initialize a configuration error.
        
        Args:
            message: Human-readable error description
            config_key: Optional configuration key that caused the error
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
        """
        super().__init__(message, suggestion, correlation_id)
        self.config_key = config_key
    
    def __str__(self) -> str:
        """Return a formatted error message with configuration context."""
        result = "Configuration error"
        if self.config_key:
            result += f" (key: {self.config_key})"
        result += f": {self.message}"
        
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        
        return result


class RatingError(CouncilError):
    """
    Exception for errors in the rating phase.
    
    This exception is raised when the rating engine fails to evaluate
    responses from providers, such as JSON parsing errors or rating failures.
    """
    
    def __init__(
        self,
        message: str,
        rater_provider: Optional[str] = None,
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ) -> None:
        """
        Initialize a rating error.
        
        Args:
            message: Human-readable error description
            rater_provider: Optional name of the provider used for rating
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
            original_error: Optional original exception that caused this error
        """
        super().__init__(message, suggestion, correlation_id)
        self.rater_provider = rater_provider
        self.original_error = original_error
    
    def __str__(self) -> str:
        """Return a formatted error message with rating context."""
        result = "Rating error"
        if self.rater_provider:
            result += f" (rater: {self.rater_provider})"
        result += f": {self.message}"
        
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        if self.original_error:
            result += f"\n\nOriginal error: {self.original_error}"
        
        return result


class SynthesisError(CouncilError):
    """
    Exception for errors in the synthesis phase.
    
    This exception is raised when the synthesis engine fails to combine
    responses into a final answer.
    """
    
    def __init__(
        self,
        message: str,
        synthesizer_provider: Optional[str] = None,
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ) -> None:
        """
        Initialize a synthesis error.
        
        Args:
            message: Human-readable error description
            synthesizer_provider: Optional name of the provider used for synthesis
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
            original_error: Optional original exception that caused this error
        """
        super().__init__(message, suggestion, correlation_id)
        self.synthesizer_provider = synthesizer_provider
        self.original_error = original_error
    
    def __str__(self) -> str:
        """Return a formatted error message with synthesis context."""
        result = "Synthesis error"
        if self.synthesizer_provider:
            result += f" (synthesizer: {self.synthesizer_provider})"
        result += f": {self.message}"
        
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        if self.original_error:
            result += f"\n\nOriginal error: {self.original_error}"
        
        return result


class CacheError(CouncilError):
    """
    Exception for cache-related errors.
    
    This exception is raised when there are issues with the caching system,
    such as database connection problems or cache corruption.
    """
    
    def __init__(
        self,
        message: str,
        cache_operation: Optional[str] = None,
        suggestion: Optional[str] = None,
        correlation_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ) -> None:
        """
        Initialize a cache error.
        
        Args:
            message: Human-readable error description
            cache_operation: Optional cache operation that failed (get, set, etc.)
            suggestion: Optional actionable guidance for resolving the error
            correlation_id: Optional correlation ID for tracking related operations
            original_error: Optional original exception that caused this error
        """
        super().__init__(message, suggestion, correlation_id)
        self.cache_operation = cache_operation
        self.original_error = original_error
    
    def __str__(self) -> str:
        """Return a formatted error message with cache context."""
        result = "Cache error"
        if self.cache_operation:
            result += f" (operation: {self.cache_operation})"
        result += f": {self.message}"
        
        if self.suggestion:
            result += f"\n\nSuggestion: {self.suggestion}"
        if self.correlation_id:
            result += f"\n\nCorrelation ID: {self.correlation_id}"
        if self.original_error:
            result += f"\n\nOriginal error: {self.original_error}"
        
        return result