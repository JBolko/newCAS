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
   ```
2. Open index.html in a modern browser (Chrome/Edge/Firefox recommended).

**Note:** The first load downloads Pyodide (≈20–40 MB), so it may take 15–40 seconds to initialize.

---

## Target Audience

- High school and university students
- Teachers looking for an open and customizable tool
- Users with dyslexia or other accessibility needs
- Anyone who wants a free, local CAS without tracking or paywalls

---

## Roadmap
Detailed development plan is available in roadmap.md.
The project is structured in five main phases:

1. Foundation
2. Intelligent Output
3. Advanced Mathematics & Notation
4. Visualization & Statistics
5. UI & Accessibility

---

## Tech Stack

- Frontend: Vanilla ES6 JavaScript (modular)
- Parser: Peggy
- CAS Engine: Pyodide + SymPy (WebAssembly)
- Rendering: KaTeX
- Architecture: Clean separation between parser → transformer → engine → UI

---

## Contributing
Contributions are welcome! The project is still early-stage, but feel free to:

- Open issues with bugs, feature requests or ideas
- Submit pull requests (especially parser improvements, UI, tests or documentation)

---

## License
This project is licensed under the MIT License (see LICENSE when added).

---

## Author
Created by **Jakob Bolko** as an open educational and hobby project.
Feedback, ideas or questions? Feel free to open an issue.

**Thank you for visiting!**
We hope newCAS can become a useful tool for students and educators
