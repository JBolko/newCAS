# bootstrap.py
"""
Tynd entry-point til Pyodide 0.26.1+.
Kører KUN én gang ved session-start. Eksporterer run_in_task til både JS og Python.
"""
from core.executor import run_in_task

# ① Eksporter til JavaScript global scope (Pyodide 0.21+ API)
try:
    import js
    js.run_in_task = run_in_task
except ImportError:
    pass  # Kører lokalt/in CI – ingen JS-bridge nødvendig

# ② Eksporter til Python's __main__ scope (så runPythonAsync("run_in_task(...)") virker)
try:
    import __main__
    __main__.run_in_task = run_in_task
except ImportError:
    pass

__all__ = ["run_in_task"]