var parser = require('../dist/mochascriptParser');
require('../dist/stdlib');
var fs = require('fs');

// TODO: make a way to pass args to the parser
// instead of this
global.ms_dumpMacros = true;

console.log(parser.parse(fs.readFileSync('../src/ms/stdmacros.ms', 'utf8')));

