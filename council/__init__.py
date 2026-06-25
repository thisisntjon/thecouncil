"""
Core package for The Council Python implementation.
"""

from .exceptions import (
    CouncilError,
    ProviderError,
    ConfigurationError,
    RatingError,
    SynthesisError,
    CacheError,
)

__all__ = [
    "__version__",
    "CouncilError",
    "ProviderError", 
    "ConfigurationError",
    "RatingError",
    "SynthesisError",
    "CacheError",
]
__version__ = "0.1.0"
