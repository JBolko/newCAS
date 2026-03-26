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

Term
  = head:Factor tail:(_ op:[*/] _ next:Factor { return {op, next}; })*
    {
      return tail.reduce((result, element) => {
        return { type: "BinaryExpression", op: element.op, left: result, right: element.next };
      }, head);
    }

Factor
  = primary:Primary _ "^" _ exp:Factor
    { return makeNode("PowerExpression", { base: primary, exponent: exp }); }
  / Primary

Primary
  = "(" _ expr:Expression _ ")" { return expr; }
  / "-" _ p:Primary { return { type: "UnaryExpression", op: "-", argument: p }; }
  / id:Identifier _ "[" _ idx:Expression _ "]" { // <--- TILFØJ DENNE (Access)
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
