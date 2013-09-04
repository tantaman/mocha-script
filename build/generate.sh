jison ../src/mochascriptParser.jison ../src/mochascriptLexer.jisonlex

cp ../src/lib/stdlib.js ../dist
cp ../src/lib/stdlib-dashlo.js ../dist

cat ../src/js/common.js \
	../src/js/macros.js \
	../src/js/processors.js \
	mochascriptParser.js > ../dist/mochascriptParser.js
rm mochascriptParser.js