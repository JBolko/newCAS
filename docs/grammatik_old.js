{{
  // Her kan vi indsætte små JS-hjælpefunktioner
  function makeNode(type, data) {
    return { type: type, ...data };
  }
}}

// Start-reglen
Program
  = _ head:Statement tail:(_ ";" _ s:Statement { return s; })* _ ";"? _
    { return [head, ...tail]; }

Statement
  = Assignment
  / Expression

Assignment
  = id:Identifier _ "(" _ params:Params _ ")" _ ":=" _ expr:Expression
    { return { type: "FunctionDefinition", name: id, params: params, body: expr }; }
  / id:Identifier _ ":=" _ expr:Expression
    { return { type: "Assignment", name: id, value: expr }; }

Expression
  = head:Term tail:(_ op:[+-] _ next:Term { return {op, next}; })*
    {
      return tail.reduce((result, element) => {
        return { type: "BinaryExpression", op: element.op, left: result, right: element.next };
      }, head);
    }

// Denne nye regel håndterer 4x og 2(x+1)
// Term håndterer de hårde operatorer (* og /)
Term
  = head:ImplicitTerm tail:(_ op:[*/] _ next:ImplicitTerm { return {op, next}; })*
    {
      return tail.reduce((result, element) => {
        return { type: "BinaryExpression", op: element.op, left: result, right: element.next };
      }, head);
    }

// ImplicitTerm håndterer 4x, xy, 2(x+1)
// Den tjekker &(_ [a-zA-ZæøåÆØÅ_({]) for at sikre at det næste er noget, 
// der må ganges implicit med (bogstav, parentes eller start-klods)
ImplicitTerm
  = head:Factor tail:(_ &([a-zA-ZæøåÆØÅ_({]) next:Factor { return { op: "*", next }; })*
    {
      return tail.reduce((result, element) => {
        return { type: "BinaryExpression", op: element.op, left: result, right: element.next };
      }, head);
    }
Factor
  = left:Primary _ "^" _ right:Factor
    { return { type: "PowerExpression", base: left, exponent: right }; }
  / Primary

Primary
  = "(" _ expr:Expression _ ")" { return expr; }
  / "-" _ p:Primary { return { type: "UnaryExpression", op: "-", argument: p }; }
  / id:Identifier _ "[" _ idx:Expression _ "]" {
      return { type: "Access", container: id, index: idx }; 
    }
  / call:FunctionCall
  / id:Identifier { return { type: "Variable", name: id }; }
  / List
  / Vector
  / num:Number _ unit:Unit { return { type: "Quantity", value: num, unit: unit }; }
  / num:Number { return { type: "Literal", value: num }; }

FunctionCall
  = id:Identifier "(" _ args:Args _ ")"
    { return makeNode("FunctionCall", { name: id, args: args }); }

Equation
  = left:Expression _ op:("=" / "<=" / ">=" / "<" / ">") _ right:Expression
    { return { type: "Equation", operator: op, left: left, right: right }; }
  / Expression

Args
  = head:Equation tail:(_ [;,] _ e:Equation { return e; })*
    { return [head, ...tail]; }
  / "" { return []; }

Params
  = head:Identifier tail:(_ "," _ i:Identifier { return i; })*
    { return [head, ...tail]; }
  / "" { return []; }

Identifier "id" = [a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]* { return text(); }

Number "number" = [0-9]+("."[0-9]+)? { return parseFloat(text()); }
_ "whitespace" = [ \t\n\r]* { return null; }

Unit
  = "[" _ u:[^\]]+ _ "]" { return u.join("").trim(); }
 
List
  = "{" _ args:Args _ "}" { return { type: "List", elements: args }; }

Vector
  = "[" _ args:Args _ "]" { return { type: "Vector", components: args }; }
