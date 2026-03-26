/**
 * cas-engine.js - Håndterer kommunikation med Pyodide (WASM Python).
 */

let pyodide = null;

export async function initCAS() {
  if (pyodide) return pyodide;
  
  // 1. Load Pyodide (skal inkluderes via CDN i index.html)
  pyodide = await loadPyodide();
  
  // 2. Load SymPy pakken
  await pyodide.loadPackage("sympy");
  
  // 3. Setup Python miljøet med de nødvendige imports og hjælpefunktioner
  await pyodide.runPythonAsync(`
    from sympy import *
    from sympy.physics.units import *
    from sympy.physics.units.systems.si import SI
    
    # Definer standard symboler
    x, y, t = symbols('x y t')
    
    # Enhedshåndtering: Vi laver en sikker ordbog til eval
    # Vi henter alle enheder fra sympy.physics.units
    import sympy.physics.units as u
    unit_dict = {name: getattr(u, name) for name in dir(u) if not name.startsWith('_')}

    def parse_units(u_str):
        # 1. Gør potenser Python-venlige: m/s^2 -> m/s**2
        safe_str = u_str.replace('^', '**')
        
        # 2. Evaluer strengen i konteksten af SymPy units
        try:
            # Vi bruger unit_dict for at sikre, at 'm' bliver til 'meter' osv.
            return eval(safe_str, {"__builtins__": None}, unit_dict)
        except Exception as e:
            print(f"Enhedsfejl: {e}")
            return 1
`);
  
  return pyodide;
}

export async function calculate(pythonCode) {
  if (!pyodide) throw new Error("CAS ikke initialiseret");
  
  try {
    const result = await pyodide.runPythonAsync(pythonCode);
    return result ? result.toString() : "Success";
  } catch (err) {
    return `Fejl: ${err.message}`;
  }
}