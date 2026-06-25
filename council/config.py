from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import yaml
from dotenv import load_dotenv

from .exceptions import ConfigurationError
from .logging_config import get_config_logger

logger = get_config_logger()


@dataclass
class ProviderModelConfig:
    """
    Configuration for a single LLM provider/model pairing.
    """

    name: str
    provider: str
    model: str
    api_key_env: str
    api_key: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CouncilSettings:
    """
    Settings defining which models participate in each phase.
    """

    members: Iterable[str]
    rater: str
    synthesizer: str


@dataclass
class ConfigValidationResult:
    """
    Result of configuration validation.
    """
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    missing_keys: List[str] = field(default_factory=list)


@dataclass
class AppConfig:
    """
    Aggregate application configuration.
    """

    models: Dict[str, ProviderModelConfig]
    council: CouncilSettings
    
    def validate(self) -> ConfigValidationResult:
        """
        Validate the configuration and return detailed results.
        
        Returns:
            ConfigValidationResult with validation status and details
        """
        result = ConfigValidationResult(is_valid=True)
        
        logger.debug("Starting configuration validation")
        
        # Validate models
        self._validate_models(result)
        
        # Validate council settings
        self._validate_council_settings(result)
        
        # Check for API keys
        self._validate_api_keys(result)
        
        # Set overall validity
        result.is_valid = len(result.errors) == 0
        
        logger.info(
            "Configuration validation complete",
            extra={
                "is_valid": result.is_valid,
                "error_count": len(result.errors),
                "warning_count": len(result.warnings),
                "missing_key_count": len(result.missing_keys)
            }
        )
        
        return result
    
    def _validate_models(self, result: ConfigValidationResult) -> None:
        """Validate model configurations."""
        if not self.models:
            result.errors.append("No models configured")
            return
        
        for name, model in self.models.items():
            # Validate model name
            if not name or not isinstance(name, str):
                result.errors.append(f"Invalid model name: {name}")
                continue
            
            # Validate provider
            valid_providers = {"openai", "anthropic", "gemini", "xai", "huggingface"}
            if model.provider not in valid_providers:
                result.errors.append(
                    f"Model '{name}': Invalid provider '{model.provider}'. "
                    f"Valid providers: {', '.join(sorted(valid_providers))}"
                )
            
            # Validate model string
            if not model.model or not isinstance(model.model, str):
                result.errors.append(f"Model '{name}': Invalid model string")
            
            # Validate API key environment variable
            if not model.api_key_env or not isinstance(model.api_key_env, str):
                result.errors.append(f"Model '{name}': Invalid api_key_env")
            
            # Check API key format for specific providers
            if model.api_key:
                self._validate_api_key_format(name, model, result)
    
    def _validate_council_settings(self, result: ConfigValidationResult) -> None:
        """Validate council settings."""
        # Validate members
        if not self.council.members:
            result.errors.append("No council members configured")
        else:
            for member in self.council.members:
                if member not in self.models:
                    result.errors.append(f"Council member '{member}' not found in models")
        
        # Validate rater
        if not self.council.rater:
            result.errors.append("No rater configured")
        elif self.council.rater not in self.models:
            result.errors.append(f"Rater '{self.council.rater}' not found in models")
        
        # Validate synthesizer
        if not self.council.synthesizer:
            result.errors.append("No synthesizer configured")
        elif self.council.synthesizer not in self.models:
            result.errors.append(f"Synthesizer '{self.council.synthesizer}' not found in models")
    
    def _validate_api_keys(self, result: ConfigValidationResult) -> None:
        """Validate API keys are present and have correct format."""
        for name, model in self.models.items():
            if not model.api_key:
                result.missing_keys.append(f"{name} ({model.api_key_env})")
                result.warnings.append(
                    f"Model '{name}': API key not found in environment variable '{model.api_key_env}'"
                )
    
    def _validate_api_key_format(self, name: str, model: ProviderModelConfig, result: ConfigValidationResult) -> None:
        """Validate API key format for specific providers."""
        if not model.api_key:
            return
        
        # OpenAI API keys
        if model.provider == "openai":
            if not model.api_key.startswith("sk-"):
                result.warnings.append(f"Model '{name}': OpenAI API key should start with 'sk-'")
            elif len(model.api_key) < 20:
                result.warnings.append(f"Model '{name}': OpenAI API key seems too short")
        
        # Anthropic API keys
        elif model.provider == "anthropic":
            if not model.api_key.startswith("sk-ant-"):
                result.warnings.append(f"Model '{name}': Anthropic API key should start with 'sk-ant-'")
        
        # Google API keys
        elif model.provider == "gemini":
            if not re.match(r"^AIza[0-9A-Za-z_-]{35}$", model.api_key):
                result.warnings.append(f"Model '{name}': Google API key format appears invalid")
        
        # xAI API keys
        elif model.provider == "xai":
            if not model.api_key.startswith("xai-"):
                result.warnings.append(f"Model '{name}': xAI API key should start with 'xai-'")
        
        # HuggingFace API keys
        elif model.provider == "huggingface":
            if not model.api_key.startswith("hf_"):
                result.warnings.append(f"Model '{name}': HuggingFace API key should start with 'hf_'")
    
    def get_setup_instructions(self) -> Dict[str, str]:
        """
        Get setup instructions for missing API keys.
        
        Returns:
            Dictionary mapping provider names to setup instructions
        """
        instructions = {
            "openai": (
                "Get your OpenAI API key from https://platform.openai.com/api-keys\n"
                "Set environment variable: OPENAI_API_KEY=sk-your-key-here"
            ),
            "anthropic": (
                "Get your Anthropic API key from https://console.anthropic.com/\n"
                "Set environment variable: ANTHROPIC_API_KEY=sk-ant-your-key-here"
            ),
            "gemini": (
                "Get your Google AI API key from https://makersuite.google.com/app/apikey\n"
                "Set environment variable: GOOGLE_API_KEY=your-key-here"
            ),
            "xai": (
                "Get your xAI API key from https://console.x.ai/\n"
                "Set environment variable: GROK_API_KEY=xai-your-key-here"
            ),
            "huggingface": (
                "Get your HuggingFace API key from https://huggingface.co/settings/tokens\n"
                "Set environment variable: HUGGINGFACE_API_KEY=hf_your-key-here"
            )
        }
        
        return instructions
    
    def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get status information for all configured providers.
        
        Returns:
            Dictionary with provider status information
        """
        status = {}
        
        for name, model in self.models.items():
            status[name] = {
                "provider": model.provider,
                "model": model.model,
                "has_api_key": bool(model.api_key),
                "api_key_env": model.api_key_env,
                "is_council_member": name in self.council.members,
                "is_rater": name == self.council.rater,
                "is_synthesizer": name == self.council.synthesizer,
            }
        
        return status


def _default_models() -> Dict[str, ProviderModelConfig]:
    return {
        "gpt-4o-mini": ProviderModelConfig(
            name="gpt-4o-mini",
            provider="openai",
            model="gpt-4o-mini",
            api_key_env="OPENAI_API_KEY",
            params={"temperature": 0.7, "max_tokens": 800},
        ),
        "claude-3-haiku": ProviderModelConfig(
            name="claude-3-haiku",
            provider="anthropic",
            model="claude-3-haiku-20240307",
            api_key_env="ANTHROPIC_API_KEY",
            params={"temperature": 0.7, "max_tokens": 1024},
        ),
        "gemini-2-5-flash": ProviderModelConfig(
            name="gemini-2-5-flash",
            provider="gemini",
            model="gemini-2.5-flash",
            api_key_env="GOOGLE_API_KEY",
            params={"temperature": 0.5, "maxOutputTokens": 800},
        ),
        "gpt-4o": ProviderModelConfig(
            name="gpt-4o",
            provider="openai",
            model="gpt-4o",
            api_key_env="OPENAI_API_KEY",
            params={"temperature": 0.2, "max_tokens": 1200},
        ),
        "grok-beta": ProviderModelConfig(
            name="grok-beta",
            provider="xai",
            model="grok-beta",
            api_key_env="GROK_API_KEY",
            params={"temperature": 0.6, "max_tokens": 900},
        ),
        "mixtral-8x7b": ProviderModelConfig(
            name="mixtral-8x7b",
            provider="huggingface",
            model="mistralai/Mixtral-8x7B-Instruct-v0.1",
            api_key_env="HUGGINGFACE_API_KEY",
            params={"max_new_tokens": 600, "temperature": 0.6},
        ),
    }


def _default_council() -> CouncilSettings:
    return CouncilSettings(
        members=("gpt-4o-mini", "claude-3-haiku", "gemini-2-5-flash"),
        rater="gpt-4o",
        synthesizer="gpt-4o",
    )


def load_config(config_path: Optional[Path] = None, validate: bool = True) -> AppConfig:
    """
    Load configuration from environment and optional YAML file.
    
    Args:
        config_path: Optional path to configuration file
        validate: Whether to validate the configuration after loading
    
    Returns:
        AppConfig instance
        
    Raises:
        ConfigurationError: If validation fails and validate=True
    """
    logger.debug("Loading configuration", extra={"config_path": str(config_path) if config_path else None})
    
    load_dotenv()

    raw_cfg = {}
    if config_path is None:
        config_path = _discover_config_path()
    
    if config_path and config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as stream:
                raw_cfg = yaml.safe_load(stream) or {}
            logger.debug("Configuration file loaded", extra={"config_path": str(config_path)})
        except yaml.YAMLError as exc:
            raise ConfigurationError(
                f"Failed to parse configuration file: {exc}",
                config_key="config_file",
                suggestion=f"Check the YAML syntax in {config_path}"
            )
        except Exception as exc:
            raise ConfigurationError(
                f"Failed to read configuration file: {exc}",
                config_key="config_file",
                suggestion=f"Check that {config_path} exists and is readable"
            )

    models = _build_models(raw_cfg.get("models", {}))
    council_cfg = raw_cfg.get("council", {})
    council = CouncilSettings(
        members=council_cfg.get("members", _default_council().members),
        rater=council_cfg.get("rater", _default_council().rater),
        synthesizer=council_cfg.get("synthesizer", _default_council().synthesizer),
    )

    config = AppConfig(models=models, council=council)
    
    if validate:
        validation_result = config.validate()
        if not validation_result.is_valid:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in validation_result.errors)
            
            if validation_result.missing_keys:
                error_msg += "\n\nMissing API keys:\n" + "\n".join(f"  - {key}" for key in validation_result.missing_keys)
                error_msg += "\n\nSetup instructions available via get_setup_instructions()"
            
            raise ConfigurationError(
                error_msg,
                suggestion="Fix the configuration errors listed above and ensure all required API keys are set"
            )
        
        if validation_result.warnings:
            logger.warning(
                "Configuration loaded with warnings",
                extra={"warnings": validation_result.warnings}
            )

    logger.info("Configuration loaded successfully", extra={"model_count": len(models)})
    return config


def _build_models(custom_models: Dict[str, Dict[str, Any]]) -> Dict[str, ProviderModelConfig]:
    models = _default_models()
    for name, overrides in custom_models.items():
        existing = models.get(name)
        if existing:
            merged_params = {**existing.params, **overrides.get("params", {})}
            models[name] = ProviderModelConfig(
                name=overrides.get("name", existing.name),
                provider=overrides.get("provider", existing.provider),
                model=overrides.get("model", existing.model),
                api_key_env=overrides.get("api_key_env", existing.api_key_env),
                params=merged_params,
            )
        else:
            models[name] = ProviderModelConfig(
                name=name,
                provider=overrides["provider"],
                model=overrides["model"],
                api_key_env=overrides["api_key_env"],
                params=overrides.get("params", {}),
            )

    for model in models.values():
        model.api_key = os.getenv(model.api_key_env)

    return models


def _discover_config_path() -> Optional[Path]:
    candidates = [
        Path("config") / "council.yaml",
        Path("config") / "council.yml",
        Path("council.yaml"),
        Path("council.yml"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None
