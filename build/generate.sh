jison ../src/mochascriptParser.jison ../src/mochascriptLexer.jisonlex

cp ../src/lib/stdlib.js ../dist
cp ../src/lib/stdlib-dashlo.js ../dist

cat ../src/head.js \
	../src/js/common.js \
	../src/js/macros.js \
	../src/js/processors.js \
	mochascriptParser.js \
	../src/tail.js > ../dist/mochascriptParser.js

node buildmacros.js > builtmacros

cat ../src/head.js \
	../src/js/common.js \
	../src/js/macros.js \
	builtmacros \
	../src/js/processors.js \
	mochascriptParser.js \
	../src/tail.js > ../dist/mochascriptParser.js

rm mochascriptParser.js
rm builtmacros

# run the parser on stdmacros with dumpMacros set to true
# concat the result with macros.js
# re-cat everything
