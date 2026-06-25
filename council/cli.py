from __future__ import annotations

import argparse
import asyncio
import sys
import logging
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .engine import CouncilEngine, MemberResult
from .logging_config import setup_logging, get_cli_logger, LogContext
from .web import DEFAULT_INSTRUCTION, build_prompt as build_prompt_with_context

console = Console()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a Council session across GPT, Claude, and Gemini.",
    )
    parser.add_argument("question", nargs="?", help="Question to send to the council.")
    parser.add_argument(
        "-f",
        "--file",
        type=str,
        help="Read question text from a file.",
    )
    parser.add_argument(
        "--context",
        type=str,
        help="Inline context string to accompany the question.",
    )
    parser.add_argument(
        "--context-file",
        type=str,
        help="Path to a file containing long-form context for the council.",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable SQLite caching of prompts.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print raw JSON result instead of formatted tables.",
    )
    parser.add_argument(
        "--show-prompt",
        action="store_true",
        help="Print the final composed prompt sent to the council.",
    )
    parser.add_argument(
        "--log-level",
        default="warning",
        help="Logging level for troubleshooting (debug, info, warning, error).",
    )
    return parser


def read_question(args: argparse.Namespace) -> str:
    if args.question:
        return args.question
    if args.file:
        path = Path(args.file)
        if not path.exists():
            console.print(f"[red]Question file not found: {path}[/]")
            raise SystemExit(1)
        return path.read_text(encoding="utf-8").strip()
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    return console.input("[bold cyan]?[/] Enter your question: ").strip()


def read_context(args: argparse.Namespace) -> str:
    parts: list[str] = []
    if args.context:
        parts.append(args.context)
    if args.context_file:
        path = Path(args.context_file)
        if not path.exists():
            console.print(f"[red]Context file not found: {path}[/]")
            raise SystemExit(1)
        parts.append(path.read_text(encoding="utf-8"))
    return "\n\n".join(part.strip() for part in parts if part.strip())


async def async_main(args: argparse.Namespace) -> None:
    # Set up logging based on CLI arguments
    setup_logging(level=args.log_level.upper())
    logger = get_cli_logger()
    
    with LogContext() as correlation_id:
        logger.info(
            "Starting CLI session",
            extra={
                "cache_enabled": not args.no_cache,
                "json_output": args.json,
                "show_prompt": args.show_prompt
            }
        )
        
        question = read_question(args)
        context = read_context(args)
        if not question and not context:
            console.print("[red]Provide at least a question or context.[/]")
            logger.error("No question or context provided")
            sys.exit(1)

        prompt, effective_question = build_prompt_with_context(question.strip(), context.strip() or None)
        
        logger.debug(
            "Prepared prompt",
            extra={
                "question_length": len(question) if question else 0,
                "context_length": len(context) if context else 0,
                "prompt_length": len(prompt)
            }
        )
        
        if args.show_prompt:
            console.rule("Final Prompt")
            console.print(prompt)
            console.rule()

        engine = CouncilEngine(enable_cache=not args.no_cache)
        result = await engine.run(prompt)

        if args.json:
            from dataclasses import asdict
            import json

            payload = asdict(result)
            console.print_json(data=payload)
            logger.info("Output rendered as JSON")
            return

        render_summary(effective_question or DEFAULT_INSTRUCTION, result.final_answer)
        render_member_table(result.members)
        if result.overall_feedback:
            console.print(Panel(result.overall_feedback, title="Overall Feedback", style="blue"))
        
        logger.info("CLI session completed successfully")


def render_summary(question: str, final_answer: Optional[str]) -> None:
    console.print(Panel(question, title="Question", style="magenta"))
    if final_answer:
        console.print(Panel(final_answer, title="Council Synthesis", style="green"))
    else:
        console.print("[yellow]No synthesized answer available.[/]")


def render_member_table(members: dict[str, MemberResult]) -> None:
    table = Table(title="Member Responses")
    table.add_column("Member", style="bold cyan")
    table.add_column("Model")
    table.add_column("Score")
    table.add_column("Feedback")
    table.add_column("Excerpt", overflow="fold")
    for name, member in members.items():
        excerpt = (member.content or member.error or "").strip()
        if len(excerpt) > 300:
            excerpt = f"{excerpt[:297]}..."
        score = str(member.feedback.score) if member.feedback.score is not None else "n/a"
        table.add_row(
            name,
            member.model,
            score,
            member.feedback.feedback or "—",
            excerpt or "—",
        )
    console.print(table)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    
    try:
        asyncio.run(async_main(args))
    except KeyboardInterrupt:
        console.print("\n[red]Interrupted by user.[/]")
        logger = get_cli_logger()
        logger.info("CLI session interrupted by user")
        sys.exit(130)
    except Exception as exc:
        console.print(f"\n[red]Unexpected error: {exc}[/]")
        logger = get_cli_logger()
        logger.exception("Unexpected error in CLI")
        sys.exit(1)


if __name__ == "__main__":
    main()
