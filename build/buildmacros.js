var parser = require('../dist/mochascriptParser');
require('../dist/stdlib');
var fs = require('fs');

// TODO: make a way to pass args to the parser
// instead of this
global.dumpMacros = 'dumpMacros';

console.log(parser.parse(fs.readFileSync('../src/ms/stdmacros.ms', 'utf8')));

