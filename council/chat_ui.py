"""
Interactive CLI chat interface for The Council system.

This module provides a conversational interface where users can ask questions
and get responses from The Council in real-time.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text
from rich.live import Live
from rich.spinner import Spinner
from rich.columns import Columns

from .engine import CouncilEngine, MemberResult
from .exceptions import CouncilError, ConfigurationError
from .logging_config import setup_logging, get_cli_logger, LogContext

console = Console()


class ChatUI:
    """Interactive chat interface for The Council."""
    
    def __init__(self, enable_cache: bool = True, log_level: str = "WARNING") -> None:
        """
        Initialize the chat UI.
        
        Args:
            enable_cache: Whether to enable response caching
            log_level: Logging level for the session
        """
        setup_logging(level=log_level.upper())
        self.logger = get_cli_logger()
        self.enable_cache = enable_cache
        self.engine: Optional[CouncilEngine] = None
        self.session_count = 0
        
    async def initialize(self) -> bool:
        """
        Initialize The Council engine.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            self.engine = CouncilEngine(enable_cache=self.enable_cache)
            
            # Test that we have at least one working provider
            if not self.engine.providers:
                console.print("[red]No providers configured. Please check your API keys.[/]")
                return False
            
            self.logger.info("Chat UI initialized successfully")
            return True
            
        except ConfigurationError as exc:
            console.print(Panel(
                f"Configuration Error: {exc}",
                title="Setup Required",
                style="red"
            ))
            if exc.suggestion:
                console.print(f"\n[yellow]Suggestion:[/] {exc.suggestion}")
            console.print("\n[blue]Run 'python -m council health' for detailed setup guidance.[/]")
            return False
            
        except Exception as exc:
            console.print(f"[red]Failed to initialize The Council: {exc}[/]")
            self.logger.exception("Failed to initialize chat UI")
            return False
    
    def show_welcome(self) -> None:
        """Display welcome message and instructions."""
        welcome_text = """
Welcome to The Council Interactive Chat!

The Council is a multi-AI consensus system that queries multiple AI models,
rates their responses, and synthesizes the best answer for you.

Commands:
  • Type your question and press Enter
  • /help - Show this help message
  • /status - Show system status
  • /members - Show council member details
  • /clear - Clear the screen
  • /quit or /exit - Exit the chat

Tips:
  • Ask complex questions to see the power of multiple AI perspectives
  • The Council works best with analytical, research, or decision-making queries
  • Each response shows individual member scores and overall synthesis
        """
        
        console.print(Panel(
            welcome_text.strip(),
            title="🏛️  The Council Chat",
            style="bold blue",
            padding=(1, 2)
        ))
    
    def show_status(self) -> None:
        """Show current system status."""
        if not self.engine:
            console.print("[red]Engine not initialized[/]")
            return
        
        console.print(Panel("System Status", style="bold blue"))
        
        # Basic info
        console.print(f"Cache enabled: {'✓' if self.enable_cache else '✗'}")
        console.print(f"Providers available: {len(self.engine.providers)}")
        console.print(f"Questions asked this session: {self.session_count}")
        
        # Council configuration
        console.print(f"\nCouncil members: {len(list(self.engine.config.council.members))}")
        console.print(f"Rater: {self.engine.config.council.rater}")
        console.print(f"Synthesizer: {self.engine.config.council.synthesizer}")
    
    def show_members(self) -> None:
        """Show detailed member information."""
        if not self.engine:
            console.print("[red]Engine not initialized[/]")
            return
        
        table = Table(title="Council Members")
        table.add_column("Name", style="bold")
        table.add_column("Provider")
        table.add_column("Model")
        table.add_column("Role")
        table.add_column("Status")
        
        for name, provider in self.engine.providers.items():
            # Determine role
            roles = []
            if name in self.engine.config.council.members:
                roles.append("Member")
            if name == self.engine.config.council.rater:
                roles.append("Rater")
            if name == self.engine.config.council.synthesizer:
                roles.append("Synthesizer")
            role_text = ", ".join(roles) if roles else "—"
            
            table.add_row(
                name,
                provider.settings.name,
                provider.settings.model,
                role_text,
                Text("✓ Ready", style="green")
            )
        
        console.print(table)
    
    def show_help(self) -> None:
        """Show help information."""
        help_text = """
Available Commands:

/help     - Show this help message
/status   - Show system status and configuration
/members  - Show detailed information about council members
/clear    - Clear the screen
/quit     - Exit the chat (also /exit)

Usage Tips:

• Ask open-ended questions for best results
• Try questions like:
  - "What are the pros and cons of remote work?"
  - "How should I approach learning a new programming language?"
  - "What factors should I consider when choosing a database?"

• The Council excels at:
  - Analysis and comparison
  - Decision-making guidance
  - Research synthesis
  - Multiple perspective evaluation
        """
        
        console.print(Panel(
            help_text.strip(),
            title="Help",
            style="blue"
        ))
    
    async def process_question(self, question: str) -> None:
        """
        Process a user question through The Council.
        
        Args:
            question: User's question
        """
        if not self.engine:
            console.print("[red]Engine not initialized[/]")
            return
        
        self.session_count += 1
        
        # Show thinking indicator
        with Live(
            Spinner("dots", text="The Council is deliberating..."),
            console=console,
            refresh_per_second=10
        ):
            try:
                with LogContext() as correlation_id:
                    result = await self.engine.run(question)
                    
            except Exception as exc:
                console.print(f"\n[red]Error processing question: {exc}[/]")
                self.logger.exception("Error processing question")
                return
        
        # Display results
        self.display_results(question, result)
    
    def display_results(self, question: str, result) -> None:
        """
        Display The Council's results in a formatted way.
        
        Args:
            question: Original question
            result: CouncilResult object
        """
        # Question
        console.print(f"\n[bold blue]Question:[/] {question}")
        
        # Final answer
        if result.final_answer:
            console.print(Panel(
                result.final_answer,
                title="🏛️  Council Synthesis",
                style="green",
                padding=(1, 2)
            ))
        else:
            console.print("[yellow]No synthesized answer available.[/]")
        
        # Member responses summary
        if result.members:
            self.display_member_summary(result.members)
        
        # Overall feedback
        if result.overall_feedback:
            console.print(Panel(
                result.overall_feedback,
                title="📊 Overall Assessment",
                style="blue",
                padding=(1, 1)
            ))
        
        console.print()  # Add spacing
    
    def display_member_summary(self, members: dict[str, MemberResult]) -> None:
        """Display a summary of member responses."""
        # Sort members by score (highest first)
        sorted_members = sorted(
            members.items(),
            key=lambda x: x[1].feedback.score or 0,
            reverse=True
        )
        
        member_panels = []
        for name, member in sorted_members:
            # Create status indicator
            if member.error:
                status = Text("✗ Error", style="red")
                content_preview = member.error[:100] + "..." if len(member.error) > 100 else member.error
            elif member.content:
                status = Text("✓ Success", style="green")
                content_preview = member.content[:100] + "..." if len(member.content) > 100 else member.content
            else:
                status = Text("⚠ No response", style="yellow")
                content_preview = "No content received"
            
            # Score display
            score_text = f"Score: {member.feedback.score}/100" if member.feedback.score is not None else "Score: —"
            
            # Create panel content
            panel_content = f"{status}\n{score_text}\n\n{content_preview}"
            
            member_panels.append(Panel(
                panel_content,
                title=f"{name} ({member.model})",
                style="dim",
                padding=(0, 1)
            ))
        
        if member_panels:
            console.print(Panel(
                Columns(member_panels, equal=True, expand=True),
                title="👥 Member Responses",
                style="cyan"
            ))
    
    async def run(self) -> None:
        """Run the interactive chat interface."""
        # Initialize
        if not await self.initialize():
            return
        
        # Show welcome
        self.show_welcome()
        
        # Main chat loop
        try:
            while True:
                try:
                    # Get user input
                    user_input = Prompt.ask(
                        "\n[bold cyan]You[/]",
                        default="",
                        show_default=False
                    ).strip()
                    
                    if not user_input:
                        continue
                    
                    # Handle commands
                    if user_input.startswith('/'):
                        command = user_input.lower()
                        
                        if command in ['/quit', '/exit']:
                            console.print("\n[blue]Thank you for using The Council! Goodbye! 👋[/]")
                            break
                        elif command == '/help':
                            self.show_help()
                        elif command == '/status':
                            self.show_status()
                        elif command == '/members':
                            self.show_members()
                        elif command == '/clear':
                            console.clear()
                            self.show_welcome()
                        else:
                            console.print(f"[red]Unknown command: {command}[/]")
                            console.print("[dim]Type /help for available commands[/]")
                    else:
                        # Process as question
                        await self.process_question(user_input)
                
                except KeyboardInterrupt:
                    console.print("\n[blue]Use /quit to exit gracefully[/]")
                    continue
                except EOFError:
                    console.print("\n[blue]Goodbye! 👋[/]")
                    break
                    
        except Exception as exc:
            console.print(f"\n[red]Unexpected error: {exc}[/]")
            self.logger.exception("Unexpected error in chat loop")


def build_parser() -> argparse.ArgumentParser:
    """Build argument parser for chat UI."""
    parser = argparse.ArgumentParser(
        description="Start The Council interactive chat interface.",
        prog="python -m council chat"
    )
    
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable response caching"
    )
    
    parser.add_argument(
        "--log-level",
        default="warning",
        help="Logging level (debug, info, warning, error)"
    )
    
    return parser


async def async_main(args: argparse.Namespace) -> None:
    """Async main function for chat UI."""
    chat = ChatUI(
        enable_cache=not args.no_cache,
        log_level=args.log_level
    )
    await chat.run()


def main(argv: Optional[list[str]] = None) -> None:
    """Main entry point for chat UI."""
    parser = build_parser()
    args = parser.parse_args(argv)
    
    try:
        asyncio.run(async_main(args))
    except KeyboardInterrupt:
        console.print("\n[blue]Goodbye! 👋[/]")
        sys.exit(0)
    except Exception as exc:
        console.print(f"\n[red]Unexpected error: {exc}[/]")
        sys.exit(1)


if __name__ == "__main__":
    main()