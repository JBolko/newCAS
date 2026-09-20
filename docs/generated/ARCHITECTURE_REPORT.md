# newCAS — Generated Architecture Report

> **AUTO-GENERATED — DO NOT EDIT MANUALLY.**
>
> Generated from the current newCAS source and analysis reports.

## Runtime API

- Public newCAS symbols: **35**
- BASE_CONTEXT symbols: **948**
- Forbidden symbols: **40**

### Runtime consistency

- Registry → BASE_CONTEXT: **OK**
- Public symbols protected: **OK**

## Parser and Transformer

- Parser: `src/js/parser.mjs`
- Transformer: `src/js/transformer.js`
- AST node types: **15**

### AST node types

- `Access`
- `Assignment`
- `BinaryExpression`
- `Conversion`
- `Derivative`
- `Equation`
- `FunctionCall`
- `FunctionDefinition`
- `List`
- `Literal`
- `PowerExpression`
- `Quantity`
- `UnaryExpression`
- `Variable`
- `Vector`

### Parser / Transformer consistency

- Parser → Transformer: **OK**
- Transformer → parser cases: **OK**

## Public newCAS functions

- `arclength` → `calculus.arclength`
- `binomcdf` → `distributions.binomcdf`
- `binompdf` → `distributions.binompdf`
- `binomtest` → `distributions.binomtest`
- `chi2gof` → `distributions.chi2gof`
- `chi2ind` → `distributions.chi2ind`
- `diff` → `calculus.diff`
- `expReg` → `statistics.expReg`
- `integrate` → `calculus.integrate_cas`
- `invnorm` → `distributions.invnorm`
- `limit` → `calculus.limit`
- `linReg` → `statistics.linReg`
- `logReg` → `statistics.logReg`
- `max` → `statistics.max_func`
- `mean` → `statistics.mean`
- `mean_B` → `distributions.mean_B`
- `mean_N` → `distributions.mean_N`
- `mean_Po` → `distributions.mean_Po`
- `median` → `statistics.median`
- `min` → `statistics.min_func`
- `normcdf` → `distributions.normcdf`
- `normpdf` → `distributions.normpdf`
- `poissoncdf` → `distributions.poissoncdf`
- `poissonpdf` → `distributions.poissonpdf`
- `powReg` → `statistics.powReg`
- `Q1` → `statistics.Q1`
- `Q3` → `statistics.Q3`
- `std_B` → `distributions.std_B`
- `std_N` → `distributions.std_N`
- `std_Po` → `distributions.std_Po`
- `ttest1` → `distributions.ttest1`
- `ttest2` → `distributions.ttest2`
- `var_B` → `distributions.var_B`
- `var_N` → `distributions.var_N`
- `var_Po` → `distributions.var_Po`

---

This file contains machine-derived facts.
Architectural decisions and rationale belong in the
human-maintained styredokumenter and ADRs.
