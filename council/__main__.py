"""
Main entry point for The Council with multiple interface options.
"""

import sys

# Check which command is requested
if len(sys.argv) > 1:
    command = sys.argv[1]
    
    if command == "health":
        # Remove 'health' from argv so the health check parser works correctly
        sys.argv.pop(1)
        from .health_check import main
        main()
    elif command == "web":
        # Remove 'web' from argv so the web parser works correctly
        sys.argv.pop(1)
        from .web import main
        main()
    elif command == "chat":
        # Remove 'chat' from argv so the chat parser works correctly
        sys.argv.pop(1)
        from .chat_ui import main
        main()
    elif command == "menu":
        # Remove 'menu' from argv so the entrance parser works correctly
        sys.argv.pop(1)
        from .entrance import main
        main()
    else:
        # Treat as question for CLI
        from .cli import main
        main()
else:
    # Default to entrance menu when no arguments (most user-friendly)
    from .entrance import main
    main()