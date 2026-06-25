"""
Main entrance point for The Council system.

This module provides a user-friendly menu to access different interfaces
and tools available in The Council system.
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

console = Console()


def show_banner() -> None:
    """Display The Council banner."""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║                    🏛️  THE COUNCIL 🏛️                        ║
    ║                                                              ║
    ║              Multi-AI Consensus System                       ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    
    console.print(Text(banner, style="bold blue"))


def show_menu() -> None:
    """Display the main menu options."""
    menu_text = """
Welcome to The Council! Choose how you'd like to interact:

1. 💬 Interactive Chat    - Conversational interface (recommended)
2. 🖥️  Command Line       - Single question mode
3. 🌐 Web Interface       - Browser-based UI
4. 🔧 System Health       - Check configuration and diagnose issues
5. ❓ Help & Setup        - Get help with setup and usage

Enter your choice (1-5) or 'q' to quit:
    """
    
    console.print(Panel(
        menu_text.strip(),
        title="Main Menu",
        style="cyan",
        padding=(1, 2)
    ))


def show_help() -> None:
    """Show help information."""
    help_text = """
The Council - Multi-AI Consensus System

OVERVIEW:
The Council queries multiple AI models (GPT, Claude, Gemini, etc.), 
rates their responses, and synthesizes the best answer for you.

INTERFACES:

💬 Interactive Chat (Recommended)
   • Conversational interface with commands
   • Real-time responses with detailed breakdowns
   • Best for exploration and multiple questions
   • Command: python -m council chat

🖥️  Command Line
   • Single question mode
   • Good for scripting and automation
   • Command: python -m council "Your question here"

🌐 Web Interface
   • Browser-based interface
   • Good for longer documents and context
   • Command: python -m council web

🔧 System Health
   • Check configuration and API keys
   • Diagnose common issues
   • Get setup instructions
   • Command: python -m council health

SETUP:
1. Install dependencies: pip install -r requirements.txt
2. Set up API keys (get help with: python -m council health)
3. Start with: python -m council

For detailed setup help: python -m council health --help
    """
    
    console.print(Panel(
        help_text.strip(),
        title="Help & Information",
        style="blue",
        padding=(1, 2)
    ))


def launch_interface(choice: str) -> None:
    """
    Launch the selected interface.
    
    Args:
        choice: User's menu choice
    """
    if choice == "1":
        console.print("[green]Launching Interactive Chat...[/]")
        from .chat_ui import main
        main()
    elif choice == "2":
        console.print("[green]Launching Command Line Interface...[/]")
        console.print("[dim]Enter your question as an argument: python -m council \"Your question\"[/]")
        question = Prompt.ask("\n[cyan]Your question")
        if question.strip():
            from .cli import main
            sys.argv = ["council", question]
            main()
    elif choice == "3":
        console.print("[green]Launching Web Interface...[/]")
        console.print("[dim]The web interface will start on http://localhost:8000[/]")
        console.print("[dim]Press Ctrl+C to stop the server[/]")
        from .web import main
        main()
    elif choice == "4":
        console.print("[green]Running System Health Check...[/]")
        from .health_check import main
        main()
    elif choice == "5":
        show_help()
        input("\nPress Enter to return to menu...")
    else:
        console.print(f"[red]Invalid choice: {choice}[/]")


def interactive_menu() -> None:
    """Run the interactive menu system."""
    while True:
        try:
            console.clear()
            show_banner()
            show_menu()
            
            choice = Prompt.ask(
                "[bold cyan]Choice[/]",
                choices=["1", "2", "3", "4", "5", "q", "quit"],
                default="1",
                show_choices=False
            )
            
            if choice.lower() in ["q", "quit"]:
                console.print("\n[blue]Thank you for using The Council! Goodbye! 👋[/]")
                break
            
            console.clear()
            launch_interface(choice)
            
            # Return to menu after interface exits (except for web which blocks)
            if choice != "3":
                input("\nPress Enter to return to main menu...")
            
        except KeyboardInterrupt:
            console.print("\n[blue]Thank you for using The Council! Goodbye! 👋[/]")
            break
        except Exception as exc:
            console.print(f"\n[red]Error: {exc}[/]")
            input("Press Enter to continue...")


def build_parser() -> argparse.ArgumentParser:
    """Build argument parser for entrance."""
    parser = argparse.ArgumentParser(
        description="The Council - Multi-AI Consensus System",
        prog="python -m council"
    )
    
    parser.add_argument(
        "--menu",
        action="store_true",
        help="Show interactive menu (default behavior)"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version="The Council v0.1.0"
    )
    
    return parser


def main(argv: Optional[list[str]] = None) -> None:
    """Main entry point for The Council entrance."""
    parser = build_parser()
    args = parser.parse_args(argv)
    
    try:
        # Show interactive menu
        interactive_menu()
    except KeyboardInterrupt:
        console.print("\n[blue]Goodbye! 👋[/]")
        sys.exit(0)
    except Exception as exc:
        console.print(f"\n[red]Unexpected error: {exc}[/]")
        sys.exit(1)


if __name__ == "__main__":
    main()