# bootstrap.py
"""
Tynd entry-point til Pyodide 0.26.1+.
Kører KUN én gang ved session-start. Eksporterer runtime-funktioner til både JS og Python.
"""

from core.executor import (
    run_in_task,
    get_task_state_json,
    reset_task_state,
)

# ① Eksporter til JavaScript global scope (Pyodide 0.21+ API)
try:
    import js
    js.run_in_task = run_in_task
    js.get_task_state_json = get_task_state_json
    js.reset_task_state = reset_task_state
except ImportError:
    pass

try:
    import __main__
    __main__.run_in_task = run_in_task
    __main__.get_task_state_json = get_task_state_json
    __main__.reset_task_state = reset_task_state
except ImportError:
    pass

__all__ = [
    "run_in_task",
    "get_task_state_json",
    "reset_task_state",
]