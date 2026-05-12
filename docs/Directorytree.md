tree /f /a

|   .gitignore
|   index.html
|   LICENSE
|   package-lock.json
|   package.json
|   README.md
|   test-e2e.html
|   test-parser.html
|   test-transformer.html
|   
+---assets
|       style.css
|       
+---docs
|   |   Directorytree.md
|   |   grammatik.pegjs
|   |   
|   \---Styredokumenter
|           Arkitektur_og_dataflow.md
|           Bruger_interface_og_interaktionsdesign.md
|           DESIGN_LOG.md
|           Formål.md
|           Funktionskatalog.md
|           roadmap.md
|           units-mapping.md
|           
+---lib
|   \---katex
|       |   katex.min.css
|       |   katex.min.js
|       |   
|       \---fonts
|               KaTeX_AMS-Regular.ttf
|               KaTeX_AMS-Regular.woff
|               KaTeX_AMS-Regular.woff2
|               KaTeX_Caligraphic-Bold.ttf
|               KaTeX_Caligraphic-Bold.woff
|               KaTeX_Caligraphic-Bold.woff2
|               KaTeX_Caligraphic-Regular.ttf
|               KaTeX_Caligraphic-Regular.woff
|               KaTeX_Caligraphic-Regular.woff2
|               KaTeX_Fraktur-Bold.ttf
|               KaTeX_Fraktur-Bold.woff
|               KaTeX_Fraktur-Bold.woff2
|               KaTeX_Fraktur-Regular.ttf
|               KaTeX_Fraktur-Regular.woff
|               KaTeX_Fraktur-Regular.woff2
|               KaTeX_Main-Bold.ttf
|               KaTeX_Main-Bold.woff
|               KaTeX_Main-Bold.woff2
|               KaTeX_Main-BoldItalic.ttf
|               KaTeX_Main-BoldItalic.woff
|               KaTeX_Main-BoldItalic.woff2
|               KaTeX_Main-Italic.ttf
|               KaTeX_Main-Italic.woff
|               KaTeX_Main-Italic.woff2
|               KaTeX_Main-Regular.ttf
|               KaTeX_Main-Regular.woff
|               KaTeX_Main-Regular.woff2
|               KaTeX_Math-BoldItalic.ttf
|               KaTeX_Math-BoldItalic.woff
|               KaTeX_Math-BoldItalic.woff2
|               KaTeX_Math-Italic.ttf
|               KaTeX_Math-Italic.woff
|               KaTeX_Math-Italic.woff2
|               KaTeX_SansSerif-Bold.ttf
|               KaTeX_SansSerif-Bold.woff
|               KaTeX_SansSerif-Bold.woff2
|               KaTeX_SansSerif-Italic.ttf
|               KaTeX_SansSerif-Italic.woff
|               KaTeX_SansSerif-Italic.woff2
|               KaTeX_SansSerif-Regular.ttf
|               KaTeX_SansSerif-Regular.woff
|               KaTeX_SansSerif-Regular.woff2
|               KaTeX_Script-Regular.ttf
|               KaTeX_Script-Regular.woff
|               KaTeX_Script-Regular.woff2
|               KaTeX_Size1-Regular.ttf
|               KaTeX_Size1-Regular.woff
|               KaTeX_Size1-Regular.woff2
|               KaTeX_Size2-Regular.ttf
|               KaTeX_Size2-Regular.woff
|               KaTeX_Size2-Regular.woff2
|               KaTeX_Size3-Regular.ttf
|               KaTeX_Size3-Regular.woff
|               KaTeX_Size3-Regular.woff2
|               KaTeX_Size4-Regular.ttf
|               KaTeX_Size4-Regular.woff
|               KaTeX_Size4-Regular.woff2
|               KaTeX_Typewriter-Regular.ttf
|               KaTeX_Typewriter-Regular.woff
|               KaTeX_Typewriter-Regular.woff2
|               
+---node_modules
|   |   .package-lock.json
|   |   
|   +---.bin
|   |       peggy
|   |       peggy.cmd
|   |       peggy.ps1
|   |       semver
|   |       semver.cmd
|   |       semver.ps1
|   |       
|   +---@peggyjs
|   |   \---from-mem
|   |       |   LICENSE
|   |       |   package.json
|   |       |   README.md
|   |       |   
|   |       +---lib
|   |       |       child.js
|   |       |       console.js
|   |       |       global.js
|   |       |       importString.js
|   |       |       index.js
|   |       |       parent.js
|   |       |       requireString.js
|   |       |       utils.js
|   |       |       
|   |       \---types
|   |               child.d.ts
|   |               console.d.ts
|   |               global.d.ts
|   |               importString.d.ts
|   |               index.d.ts
|   |               parent.d.ts
|   |               requireString.d.ts
|   |               utils.d.ts
|   |               
|   +---commander
|   |   |   esm.mjs
|   |   |   index.js
|   |   |   LICENSE
|   |   |   package-support.json
|   |   |   package.json
|   |   |   Readme.md
|   |   |   
|   |   +---lib
|   |   |       argument.js
|   |   |       command.js
|   |   |       error.js
|   |   |       help.js
|   |   |       option.js
|   |   |       suggestSimilar.js
|   |   |       
|   |   \---typings
|   |           esm.d.mts
|   |           index.d.ts
|   |           
|   +---peggy
|   |   |   AUTHORS
|   |   |   LICENSE
|   |   |   package.json
|   |   |   README.md
|   |   |   
|   |   +---bin
|   |   |       generated_template.d.ts
|   |   |       opts.js
|   |   |       peggy-cli.js
|   |   |       peggy.js
|   |   |       utils.js
|   |   |       watcher.js
|   |   |       
|   |   +---browser
|   |   |       peggy.min.d.ts
|   |   |       peggy.min.js
|   |   |       
|   |   \---lib
|   |       |   grammar-error.js
|   |       |   grammar-location.js
|   |       |   parser.d.ts
|   |       |   parser.js
|   |       |   peg.d.ts
|   |       |   peg.js
|   |       |   tsconfig.json
|   |       |   version.js
|   |       |   
|   |       \---compiler
|   |           |   asts.js
|   |           |   index.js
|   |           |   intern.js
|   |           |   opcodes.js
|   |           |   session.js
|   |           |   stack.js
|   |           |   utils.js
|   |           |   visitor.js
|   |           |   
|   |           \---passes
|   |                   add-imported-rules.js
|   |                   fix-library-numbers.js
|   |                   generate-bytecode.js
|   |                   generate-js.js
|   |                   inference-match-result.js
|   |                   merge-character-classes.js
|   |                   remove-proxy-rules.js
|   |                   remove-unused-rules.js
|   |                   report-duplicate-imports.js
|   |                   report-duplicate-labels.js
|   |                   report-duplicate-rules.js
|   |                   report-incorrect-plucking.js
|   |                   report-infinite-recursion.js
|   |                   report-infinite-repetition.js
|   |                   report-undefined-rules.js
|   |                   report-unreachable.js
|   |                   
|   +---semver
|   |   |   index.js
|   |   |   LICENSE
|   |   |   package.json
|   |   |   preload.js
|   |   |   range.bnf
|   |   |   README.md
|   |   |   
|   |   +---bin
|   |   |       semver.js
|   |   |       
|   |   +---classes
|   |   |       comparator.js
|   |   |       index.js
|   |   |       range.js
|   |   |       semver.js
|   |   |       
|   |   +---functions
|   |   |       clean.js
|   |   |       cmp.js
|   |   |       coerce.js
|   |   |       compare-build.js
|   |   |       compare-loose.js
|   |   |       compare.js
|   |   |       diff.js
|   |   |       eq.js
|   |   |       gt.js
|   |   |       gte.js
|   |   |       inc.js
|   |   |       lt.js
|   |   |       lte.js
|   |   |       major.js
|   |   |       minor.js
|   |   |       neq.js
|   |   |       parse.js
|   |   |       patch.js
|   |   |       prerelease.js
|   |   |       rcompare.js
|   |   |       rsort.js
|   |   |       satisfies.js
|   |   |       sort.js
|   |   |       valid.js
|   |   |       
|   |   +---internal
|   |   |       constants.js
|   |   |       debug.js
|   |   |       identifiers.js
|   |   |       lrucache.js
|   |   |       parse-options.js
|   |   |       re.js
|   |   |       
|   |   \---ranges
|   |           gtr.js
|   |           intersects.js
|   |           ltr.js
|   |           max-satisfying.js
|   |           min-satisfying.js
|   |           min-version.js
|   |           outside.js
|   |           simplify.js
|   |           subset.js
|   |           to-comparators.js
|   |           valid.js
|   |           
|   \---source-map-generator
|       |   LICENSE
|       |   package.json
|       |   README.md
|       |   source-map.d.ts
|       |   source-map.js
|       |   
|       \---lib
|               array-set.js
|               base64-vlq.js
|               base64.js
|               binary-search.js
|               mapping-list.js
|               source-map-generator.js
|               source-node.js
|               util.js
|               
\---src
    +---css
    |       components.css
    |       style.css
    |       style_old.css
    |       
    +---js
    |       cas-engine.js
    |       error-catalog.js
    |       main.js
    |       parser.mjs
    |       renderer.js
    |       settings.js
    |       transformer.js
    |       
    \---python
            setup.py