"""
Setup helper utilities for The Council system.

This module provides utilities to help users set up and configure
The Council system, including API key management and troubleshooting.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

from .config import AppConfig, load_config
from .exceptions import ConfigurationError
from .logging_config import get_config_logger

logger = get_config_logger()


def check_api_key_setup() -> Dict[str, Dict[str, str]]:
    """
    Check the status of all API keys and provide setup guidance.
    
    Returns:
        Dictionary with API key status and setup instructions
    """
    try:
        config = load_config(validate=False)  # Don't validate to avoid errors
    except Exception as exc:
        logger.error("Failed to load configuration", extra={"error": str(exc)})
        return {"error": {"message": str(exc), "suggestion": "Check your configuration file syntax"}}
    
    validation_result = config.validate()
    setup_instructions = config.get_setup_instructions()
    provider_status = config.get_provider_status()
    
    result = {}
    
    for name, model in config.models.items():
        status = provider_status[name]
        provider_name = model.provider
        
        if status["has_api_key"]:
            result[name] = {
                "status": "configured",
                "provider": provider_name,
                "model": model.model,
                "message": f"✓ {name} is properly configured"
            }
        else:
            result[name] = {
                "status": "missing_key",
                "provider": provider_name,
                "model": model.model,
                "env_var": model.api_key_env,
                "message": f"✗ {name} is missing API key",
                "instructions": setup_instructions.get(provider_name, "No setup instructions available")
            }
    
    return result


def get_provider_setup_guide(provider: str) -> Optional[str]:
    """
    Get detailed setup instructions for a specific provider.
    
    Args:
        provider: Provider name (openai, anthropic, gemini, xai, huggingface)
    
    Returns:
        Detailed setup instructions or None if provider not found
    """
    guides = {
        "openai": """
OpenAI Setup Guide:

1. Visit https://platform.openai.com/api-keys
2. Sign in to your OpenAI account (create one if needed)
3. Click "Create new secret key"
4. Copy the key (starts with 'sk-')
5. Set environment variable:
   - Windows: set OPENAI_API_KEY=sk-your-key-here
   - Linux/Mac: export OPENAI_API_KEY=sk-your-key-here
   - Or add to .env file: OPENAI_API_KEY=sk-your-key-here

Note: You'll need billing set up to use the API.
""",
        "anthropic": """
Anthropic (Claude) Setup Guide:

1. Visit https://console.anthropic.com/
2. Sign in to your Anthropic account (create one if needed)
3. Go to API Keys section
4. Click "Create Key"
5. Copy the key (starts with 'sk-ant-')
6. Set environment variable:
   - Windows: set ANTHROPIC_API_KEY=sk-ant-your-key-here
   - Linux/Mac: export ANTHROPIC_API_KEY=sk-ant-your-key-here
   - Or add to .env file: ANTHROPIC_API_KEY=sk-ant-your-key-here

Note: You'll need to add credits to your account to use the API.
""",
        "gemini": """
Google Gemini Setup Guide:

1. Visit https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key (starts with 'AIza')
5. Set environment variable:
   - Windows: set GOOGLE_API_KEY=your-key-here
   - Linux/Mac: export GOOGLE_API_KEY=your-key-here
   - Or add to .env file: GOOGLE_API_KEY=your-key-here

Note: Gemini API has a generous free tier.
""",
        "xai": """
xAI (Grok) Setup Guide:

1. Visit https://console.x.ai/
2. Sign in to your xAI account (create one if needed)
3. Go to API Keys section
4. Click "Create new API key"
5. Copy the key (starts with 'xai-')
6. Set environment variable:
   - Windows: set GROK_API_KEY=xai-your-key-here
   - Linux/Mac: export GROK_API_KEY=xai-your-key-here
   - Or add to .env file: GROK_API_KEY=xai-your-key-here

Note: You'll need billing set up to use the API.
""",
        "huggingface": """
HuggingFace Setup Guide:

1. Visit https://huggingface.co/settings/tokens
2. Sign in to your HuggingFace account (create one if needed)
3. Click "New token"
4. Choose "Read" permissions (or "Write" if you plan to upload)
5. Copy the token (starts with 'hf_')
6. Set environment variable:
   - Windows: set HUGGINGFACE_API_KEY=hf_your-key-here
   - Linux/Mac: export HUGGINGFACE_API_KEY=hf_your-key-here
   - Or add to .env file: HUGGINGFACE_API_KEY=hf_your-key-here

Note: Many models on HuggingFace are free to use.
"""
    }
    
    return guides.get(provider.lower())


def diagnose_configuration_issues() -> List[str]:
    """
    Diagnose common configuration issues and provide solutions.
    
    Returns:
        List of diagnostic messages and solutions
    """
    issues = []
    
    try:
        config = load_config(validate=False)
        validation_result = config.validate()
        
        if validation_result.errors:
            issues.append("Configuration Errors Found:")
            for error in validation_result.errors:
                issues.append(f"  ✗ {error}")
        
        if validation_result.missing_keys:
            issues.append("\nMissing API Keys:")
            for key in validation_result.missing_keys:
                issues.append(f"  ✗ {key}")
            issues.append("\nUse 'python -m council.setup --help' for setup instructions")
        
        if validation_result.warnings:
            issues.append("\nConfiguration Warnings:")
            for warning in validation_result.warnings:
                issues.append(f"  ⚠ {warning}")
        
        if not validation_result.errors and not validation_result.missing_keys:
            issues.append("✓ Configuration appears to be valid")
            
            # Test basic functionality
            try:
                # Try to initialize providers (this will catch API key format issues)
                from .engine import CouncilEngine
                engine = CouncilEngine(config=config)
                if engine.providers:
                    issues.append(f"✓ {len(engine.providers)} providers initialized successfully")
                else:
                    issues.append("⚠ No providers were initialized (check API keys)")
            except Exception as exc:
                issues.append(f"✗ Provider initialization failed: {exc}")
    
    except ConfigurationError as exc:
        issues.append(f"Configuration Error: {exc}")
        if exc.suggestion:
            issues.append(f"Suggestion: {exc.suggestion}")
    except Exception as exc:
        issues.append(f"Unexpected error during diagnosis: {exc}")
    
    return issues


def create_sample_env_file() -> str:
    """
    Create a sample .env file content with all supported API keys.
    
    Returns:
        Sample .env file content
    """
    return """# The Council - API Keys Configuration
# Copy this file to .env and fill in your actual API keys

# OpenAI API Key (required for GPT models)
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic API Key (required for Claude models)
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Google AI API Key (required for Gemini models)
# Get from: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=your-google-api-key-here

# xAI API Key (required for Grok models)
# Get from: https://console.x.ai/
GROK_API_KEY=xai-your-xai-key-here

# HuggingFace API Key (required for HuggingFace models)
# Get from: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=hf_your-huggingface-key-here

# Optional: Uncomment and modify these if you need custom configurations
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# REDIS_HOST=localhost
# REDIS_PORT=6379
"""