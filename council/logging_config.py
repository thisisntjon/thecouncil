"""
Structured logging configuration for The Council system.

This module provides centralized logging configuration with correlation IDs,
structured formatting, and appropriate log levels for different components.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any, Dict, Optional

# Context variable to store correlation ID across async operations
correlation_id_context: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


def generate_correlation_id() -> str:
    """Generate a new correlation ID for tracking related operations."""
    return str(uuid.uuid4())[:8]


def set_correlation_id(correlation_id: str) -> None:
    """Set the correlation ID for the current context."""
    correlation_id_context.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get the current correlation ID from context."""
    return correlation_id_context.get()


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs with correlation IDs.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        # Create base log entry
        log_entry: Dict[str, Any] = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add correlation ID if available
        correlation_id = get_correlation_id()
        if correlation_id:
            log_entry['correlation_id'] = correlation_id
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add any extra fields from the log record
        extra_fields = {
            key: value for key, value in record.__dict__.items()
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                'filename', 'module', 'lineno', 'funcName', 'created',
                'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'getMessage', 'exc_info',
                'exc_text', 'stack_info'
            }
        }
        
        if extra_fields:
            log_entry['extra'] = extra_fields
        
        return json.dumps(log_entry, default=str)


class SimpleFormatter(logging.Formatter):
    """
    Simple formatter for human-readable console output with correlation IDs.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with correlation ID if available."""
        formatted = super().format(record)
        
        correlation_id = get_correlation_id()
        if correlation_id:
            formatted = f"[{correlation_id}] {formatted}"
        
        return formatted


def setup_logging(
    level: str = "INFO",
    structured: bool = False,
    logger_name: Optional[str] = None
) -> logging.Logger:
    """
    Set up structured logging for The Council system.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
        structured: Whether to use structured JSON logging
        logger_name: Optional specific logger name, defaults to 'council'
    
    Returns:
        Configured logger instance
    """
    # Convert string level to logging constant
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    
    # Get or create logger
    logger_name = logger_name or 'council'
    logger = logging.getLogger(logger_name)
    logger.setLevel(numeric_level)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)
    
    # Set formatter based on structured flag
    if structured:
        formatter = StructuredFormatter()
    else:
        formatter = SimpleFormatter(
            fmt='%(asctime)s | %(name)s | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Prevent propagation to root logger to avoid duplicate messages
    logger.propagate = False
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the specified name under the council hierarchy.
    
    Args:
        name: Logger name (will be prefixed with 'council.')
    
    Returns:
        Logger instance
    """
    full_name = f"council.{name}" if not name.startswith('council.') else name
    return logging.getLogger(full_name)


class LogContext:
    """
    Context manager for setting correlation ID and additional log context.
    
    Usage:
        with LogContext(correlation_id="abc123", extra={"user_id": "user123"}):
            logger.info("Processing request")
    """
    
    def __init__(
        self,
        correlation_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize log context.
        
        Args:
            correlation_id: Optional correlation ID, generates one if not provided
            extra: Optional extra fields to include in log records
        """
        self.correlation_id = correlation_id or generate_correlation_id()
        self.extra = extra or {}
        self.previous_correlation_id: Optional[str] = None
    
    def __enter__(self) -> str:
        """Enter the context and set correlation ID."""
        self.previous_correlation_id = get_correlation_id()
        set_correlation_id(self.correlation_id)
        return self.correlation_id
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit the context and restore previous correlation ID."""
        set_correlation_id(self.previous_correlation_id)


# Pre-configured loggers for common components
def get_engine_logger() -> logging.Logger:
    """Get logger for the Council engine."""
    return get_logger("engine")


def get_provider_logger(provider_name: str) -> logging.Logger:
    """Get logger for a specific provider."""
    return get_logger(f"providers.{provider_name}")


def get_cache_logger() -> logging.Logger:
    """Get logger for the cache system."""
    return get_logger("cache")


def get_config_logger() -> logging.Logger:
    """Get logger for configuration system."""
    return get_logger("config")


def get_cli_logger() -> logging.Logger:
    """Get logger for CLI interface."""
    return get_logger("cli")


def get_web_logger() -> logging.Logger:
    """Get logger for web interface."""
    return get_logger("web")