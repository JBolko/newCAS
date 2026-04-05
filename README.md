# newCAS

**An open-source Computer Algebra System (CAS) running entirely in the browser** — with a strong focus on pedagogy, accessibility, and flexible notation.

newCAS combines a custom mathematical parser with **SymPy** (via Pyodide) to deliver powerful symbolic computation directly in the browser — no server required.

The project aims to create a tool that is both mathematically robust and genuinely user-friendly, especially for students, including those with dyslexia or who prefer Danish-style notation (comma as decimal separator, implicit multiplication, etc.).

---

## Why newCAS?

Most existing CAS tools are either:
- Too complex for beginners and school students
- Server-dependent (Wolfram Alpha, Symbolab, GeoGebra CAS)
- Not optimized for accessibility or regional notation preferences

newCAS addresses this by being:
- Fully client-side (runs offline after initial load)
- Focused on syntactic sugar and forgiving input (`3x` → `3*x`)
- Designed with accessibility in mind (sepia/dark themes, font options)
- Pedagogically oriented with clear, readable output

---

## Current Status

- **Phase 1: Foundation** — ✅ Completed  
  (Parser, AST, SymPy integration via Pyodide, basic UI)

- **Phase 2: Intelligent Output** — 🟡 In progress (next priority)

See the full [roadmap.md](roadmap.md) for details.

---

## Features

**Currently supported:**
- Natural mathematical input with implicit multiplication
- Assignments (`x := 5`)
- Symbolic computation via SymPy (simplify, factor, solve, etc.)
- Beautiful math rendering with KaTeX

**Planned features:**
- Structured JSON output (type, domain, LaTeX)
- Intervals and piecewise functions
- Vectors and matrices
- Function plotting
- Statistics tools
- Advanced accessibility settings

---

## How to Run

1. Clone the repository:
   ```bash
   git clone https://github.com/JBolko/newCAS.git
   cd newCAS
