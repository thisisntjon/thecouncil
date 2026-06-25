"""
Health check command for The Council system.

This module provides a CLI command to validate configuration,
check API keys, and diagnose common issues.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .config import load_config
from .exceptions import ConfigurationError
from .logging_config import setup_logging, get_config_logger
from .setup_helper import (
    check_api_key_setup,
    diagnose_configuration_issues,
    get_provider_setup_guide,
    create_sample_env_file
)

console = Console()


def build_parser() -> argparse.ArgumentParser:
    """Build argument parser for health check command."""
    parser = argparse.ArgumentParser(
        description="Check The Council configuration and diagnose issues.",
        prog="python -m council.health"
    )
    
    parser.add_argument(
        "--config",
        type=str,
        help="Path to configuration file (optional)"
    )
    
    parser.add_argument(
        "--provider",
        type=str,
        choices=["openai", "anthropic", "gemini", "xai", "huggingface"],
        help="Show setup guide for specific provider"
    )
    
    parser.add_argument(
        "--create-env",
        action="store_true",
        help="Create a sample .env file"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed diagnostic information"
    )
    
    parser.add_argument(
        "--log-level",
        default="warning",
        help="Logging level (debug, info, warning, error)"
    )
    
    return parser


def show_provider_guide(provider: str) -> None:
    """Show setup guide for a specific provider."""
    guide = get_provider_setup_guide(provider)
    if guide:
        console.print(Panel(guide.strip(), title=f"{provider.title()} Setup Guide", style="blue"))
    else:
        console.print(f"[red]No setup guide available for provider: {provider}[/]")


def create_env_file() -> None:
    """Create a sample .env file."""
    env_path = Path(".env")
    
    if env_path.exists():
        console.print("[yellow]Warning: .env file already exists[/]")
        response = console.input("Overwrite existing .env file? [y/N]: ")
        if response.lower() not in ["y", "yes"]:
            console.print("Cancelled.")
            return
    
    try:
        env_content = create_sample_env_file()
        env_path.write_text(env_content, encoding="utf-8")
        console.print(f"[green]✓ Created sample .env file at {env_path}[/]")
        console.print("\n[yellow]Next steps:[/]")
        console.print("1. Edit the .env file and add your actual API keys")
        console.print("2. Run 'python -m council.health' to verify your setup")
    except Exception as exc:
        console.print(f"[red]Failed to create .env file: {exc}[/]")


def show_configuration_status(config_path: Optional[str] = None, verbose: bool = False) -> bool:
    """
    Show configuration status and return whether config is valid.
    
    Args:
        config_path: Optional path to configuration file
        verbose: Whether to show verbose output
    
    Returns:
        True if configuration is valid, False otherwise
    """
    logger = get_config_logger()
    
    try:
        # Load configuration
        config_file = Path(config_path) if config_path else None
        config = load_config(config_file, validate=False)
        
        console.print(Panel("Configuration Status", style="bold blue"))
        
        # Show basic info
        console.print(f"Models configured: {len(config.models)}")
        console.print(f"Council members: {len(list(config.council.members))}")
        console.print(f"Rater: {config.council.rater}")
        console.print(f"Synthesizer: {config.council.synthesizer}")
        
        if config_path:
            console.print(f"Config file: {config_path}")
        
        console.print()
        
        # Validate configuration
        validation_result = config.validate()
        
        if validation_result.is_valid:
            console.print("[green]✓ Configuration is valid[/]")
        else:
            console.print("[red]✗ Configuration has errors[/]")
        
        # Show errors
        if validation_result.errors:
            console.print("\n[red]Errors:[/]")
            for error in validation_result.errors:
                console.print(f"  ✗ {error}")
        
        # Show warnings
        if validation_result.warnings:
            console.print("\n[yellow]Warnings:[/]")
            for warning in validation_result.warnings:
                console.print(f"  ⚠ {warning}")
        
        # Show API key status
        console.print("\n")
        show_api_key_status(verbose)
        
        # Show provider status table
        if verbose:
            console.print("\n")
            show_provider_status_table(config)
        
        return validation_result.is_valid and len(validation_result.missing_keys) == 0
        
    except ConfigurationError as exc:
        console.print(Panel(f"Configuration Error: {exc}", style="red"))
        if exc.suggestion:
            console.print(f"\n[yellow]Suggestion:[/] {exc.suggestion}")
        return False
    except Exception as exc:
        console.print(Panel(f"Unexpected error: {exc}", style="red"))
        logger.exception("Unexpected error during health check")
        return False


def show_api_key_status(verbose: bool = False) -> None:
    """Show API key status for all providers."""
    console.print(Panel("API Key Status", style="bold blue"))
    
    api_status = check_api_key_setup()
    
    if "error" in api_status:
        console.print(f"[red]Error checking API keys: {api_status['error']['message']}[/]")
        return
    
    configured_count = 0
    missing_count = 0
    
    for name, status in api_status.items():
        if status["status"] == "configured":
            console.print(f"[green]✓ {name}[/] ({status['provider']}) - {status['message']}")
            configured_count += 1
        else:
            console.print(f"[red]✗ {name}[/] ({status['provider']}) - {status['message']}")
            if verbose and "instructions" in status:
                console.print(f"    [dim]Environment variable: {status['env_var']}[/]")
            missing_count += 1
    
    console.print(f"\nConfigured: {configured_count}, Missing: {missing_count}")
    
    if missing_count > 0:
        console.print("\n[yellow]To set up missing API keys:[/]")
        console.print("  python -m council.health --provider <provider_name>")
        console.print("  python -m council.health --create-env")


def show_provider_status_table(config) -> None:
    """Show detailed provider status in a table."""
    table = Table(title="Provider Details")
    table.add_column("Name", style="bold")
    table.add_column("Provider")
    table.add_column("Model")
    table.add_column("API Key")
    table.add_column("Role")
    
    provider_status = config.get_provider_status()
    
    for name, status in provider_status.items():
        # API key status
        key_status = "✓" if status["has_api_key"] else "✗"
        key_style = "green" if status["has_api_key"] else "red"
        
        # Role information
        roles = []
        if status["is_council_member"]:
            roles.append("Member")
        if status["is_rater"]:
            roles.append("Rater")
        if status["is_synthesizer"]:
            roles.append("Synthesizer")
        role_text = ", ".join(roles) if roles else "—"
        
        table.add_row(
            name,
            status["provider"],
            status["model"],
            Text(key_status, style=key_style),
            role_text
        )
    
    console.print(table)


def run_diagnostics(verbose: bool = False) -> None:
    """Run comprehensive diagnostics."""
    console.print(Panel("System Diagnostics", style="bold blue"))
    
    issues = diagnose_configuration_issues()
    
    for issue in issues:
        if issue.startswith("✓"):
            console.print(f"[green]{issue}[/]")
        elif issue.startswith("⚠"):
            console.print(f"[yellow]{issue}[/]")
        elif issue.startswith("✗"):
            console.print(f"[red]{issue}[/]")
        else:
            console.print(issue)


def main(argv: Optional[list[str]] = None) -> None:
    """Main entry point for health check command."""
    parser = build_parser()
    args = parser.parse_args(argv)
    
    # Set up logging
    setup_logging(level=args.log_level.upper())
    
    try:
        if args.create_env:
            create_env_file()
            return
        
        if args.provider:
            show_provider_guide(args.provider)
            return
        
        # Show configuration status
        is_valid = show_configuration_status(args.config, args.verbose)
        
        # Run diagnostics if requested or if there are issues
        if args.verbose or not is_valid:
            console.print("\n")
            run_diagnostics(args.verbose)
        
        # Exit with appropriate code
        sys.exit(0 if is_valid else 1)
        
    except KeyboardInterrupt:
        console.print("\n[red]Interrupted by user.[/]")
        sys.exit(130)
    except Exception as exc:
        console.print(f"\n[red]Unexpected error: {exc}[/]")
        sys.exit(1)


if __name__ == "__main__":
    main()