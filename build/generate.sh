jison ../src/mochascriptParser.jison ../src/mochascriptLexer.jisonlex
mv mochascriptParser.js ../dist
cp ../src/stdlib/stdlib.js ../dist
cp ../src/stdlib/stdlib-dashlo.js ../dist
