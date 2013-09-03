jison ../src/mochascriptParser.jison ../src/mochascriptLexer.jisonlex
cat ../src/common.js \
	../src/scopes.js \
	../src/nodes.js \
	mochascriptParser.js > ../dist/mochascriptParser.js
rm mochascriptParser.js
cp ../src/stdlib/stdlib.js ../dist
cp ../src/stdlib/stdlib-dashlo.js ../dist
