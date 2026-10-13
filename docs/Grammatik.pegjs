{{
  function makeNode(type, data) {
    return { type: type, ...data };
  }
}}

Program
  = _ head:Statement tail:(_ ";" _ s:Statement { return s; })* _ ";"? _
    { return [head, ...tail]; }

// Function names are intentionally NOT enumerated here.
// Any Identifier(...) is parsed as a generic FunctionCall.
// The authoritative list of available CAS functions lives in
// the OperationSpec catalog. Parsing alone does not resolve built-in
// operations versus document-defined functions.

Statement
  = Conversion 
  / Assignment
  / Equation 
  / Expression

Conversion
  = expr:(Assignment / Equation / Expression) _ "->" _ unit:Unit
    { return { type: "Conversion", expr: expr, targetUnit: unit }; }

Assignment
  = id:Identifier _ "(" _ params:Params _ ")" _ ":=" _ expr:Expression
    { return { type: "FunctionDefinition", name: id, params: params, body: expr }; }
  / id:Identifier _ ":=" _ expr:Expression
    { return { type: "Assignment", name: id, value: expr }; }

Expression
  = head:Term tail:(_ op:[+-] _ next:Term { return {op, next}; })*
    {
      return tail.reduce((result, element) => makeNode("BinaryExpression", { op: element.op, left: result, right: element.next }), head);
    }

Term
  = head:ImplicitMulti tail:(_ op:[*/] _ next:ImplicitMulti { return {op, next}; })*
    {
      return tail.reduce((result, element) =>
        makeNode("BinaryExpression", { op: element.op, left: result, right: element.next }), head);
    }

ImplicitMulti
  = head:Unary tail:(_ &([a-zA-ZæøåÆØÅ_(]) next:Unary { return { op: "*", next }; })*
    {
      return tail.reduce((result, element) =>
        makeNode("BinaryExpression", { op: element.op, left: result, right: element.next }), head);
    }

// 1. UNARY ligger nu YDERST (lavest præcedens af de tre)
Unary
  = "-" _ p:Unary { return { type: "UnaryExpression", op: "-", argument: p }; }
  / Power

// 2. POWER ligger INDENI Unary (højere præcedens)
Power
  = base:Primary _ "^" _ exponent:Power
    { return makeNode("PowerExpression", { base: base, exponent: exponent }); }
  / Primary
  
Primary
  = "(" _ expr:Expression _ ")" { return expr; }
  / call:DerivativeCall 
  / call:FunctionCall
  / id:Identifier _ "[" _ idx:Expression _ "]" { return { type: "Access", container: id, index: idx }; }
  / id:Identifier { return { type: "Variable", name: id }; }
  / List
  / Vector
  / num:Number _ unit:Unit { return { type: "Quantity", value: num, unit: unit }; }
  / num:Number { return { type: "Literal", value: num }; }
  
DerivativeCall
  = name:Identifier ticks:"'"+ _ "(" _ args:Args _ ")"
    {
      return makeNode("Derivative", {
        name:  name,
        order: ticks.length,   // f' = 1, f'' = 2, f''' = 3
        args:  args
      });
    }

FunctionCall
  = id:Identifier "(" _ args:Args _ ")"
    { return makeNode("FunctionCall", { name: id, args: args }); }
  // Bemærk: ingen _ (whitespace) mellem identifier og (.
  // "sin(x)"  → FunctionCall  ✓
  // "sin (x)" → ImplicitMulti: Variable("sin") * Unary("(x)") — intentionelt!
  // "x (x-2)" → ImplicitMulti: Variable("x")  * Expression("x-2") ✓
  // "x(x-2)"  → FunctionCall  ✗ — kan ikke løses grammatisk, kræver scope-kendskab.
  //             Workaround: skriv "x*(x-2)" eksplicit.
  //             Langsigtet løsning: se backlog "scope-aware preprocessor".

Equation
  = left:Expression _ op:("=" / "<=" / ">=" / "<" / ">") _ right:Expression
    { return { type: "Equation", operator: op, left: left, right: right }; }
  / Expression

Args
  = head:Equation tail:(_ [;,] _ e:Equation { return e; })*
    { return [head, ...tail]; }
  / "" { return []; }

Params
  = head:Identifier tail:(_ [;,] _ i:Identifier { return i; })*
    { return [head, ...tail]; }
  / "" { return []; }

Identifier "id" = [a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]* { return text(); }

// Canonical parser notation: dot decimal, comma or semicolon argument separator.
// Locale-specific input normalization is a separate, not-yet-implemented UI step.
Number "number" = [0-9]+("." [0-9]+)?
    { return parseFloat(text()); }

_ "whitespace" = [ \t\n\r]*

Unit
  = "[" _ u:[^\]]+ _ "]" { return u.join("").trim(); }

List
  = "{" _ args:Args _ "}" { return { type: "List", elements: args }; }

Vector
  = "[" _ args:Args _ "]" { return { type: "Vector", components: args }; }