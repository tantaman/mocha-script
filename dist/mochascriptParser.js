if (typeof module !== 'undefined' && require.main === module) {
	var oldprocess = process; 
}

(function(root) {

function Node(type, key, text) {
	if (!(this instanceof Node))
		return new Node(type, key, text);

	this.type = type;
	this.key = key || type;
	this.text = text || key || type;
}

function quoteIfString(item) {
  if (typeof item === 'string') {
    return '"' + item + '"';
  }
  return item;
}

Node.prototype.toString = function() {
	return this.text;
};

Node.prototype.toConstructionString = function() {
  return "Node('" + this.type + "', " + quoteIfString(this.key) + ", "
        + quoteIfString(this.text) + ")";
}

function first(arr) {
	return arr[0];
}

function last(arr) {
	return arr[arr.length - 1];	
}

function rest(arr, n) {
	if (!n) n = 1;
	var result = [];
	for (var i = n; i < arr.length; ++i) {
		result.push(arr[i]);
	}

	return result;
}

if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                                 : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

if (!Array.prototype.some) {
  Array.prototype.some = function(fun /*, thisp */) {
    'use strict';

    if (this == null) {
      throw new TypeError();
    }

    var thisp, i,
        t = Object(this),
        len = t.length >>> 0;
    if (typeof fun !== 'function') {
      throw new TypeError();
    }

    thisp = arguments[1];
    for (i = 0; i < len; i++) {
      if (i in t && fun.call(thisp, t[i], i, t)) {
        return true;
      }
    }

    return false;
  };
}

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, scope) {
        'use strict';
        var i, len;
        for (i = 0, len = this.length; i < len; ++i) {
            if (i in this) {
                fn.call(scope, this[i], i, this);
            }
        }
    };
}var macros = {};

function wrapMacro(macro) {
	return function(list, userdata) {
		return process(macro(list), userdata);
	}
}

/**
* (defmacro name (list) body) -> (fn (list) body)
* that gets evaled:
* eval("var __tempMacro = " + process(list));
* macros[name] = wrapMacro(__tempMacro); // after some sanity checks on the macro
* wrapMacro just runs the macro and does a "return process(macroResult);"
*/
macros.defmacro = function(list, userdata) {
	var name = list[1];
	list = list.slice(0).splice(2);
	list.unshift(Node('fn'));

	var str = process(list, userdata);
	console.log(str);
	eval("var __tempMacro = " + str);
	if (name in macros)
		console.error('Macro ' + name + ' is being re-defined');
	macros[name] = wrapMacro(__tempMacro);

	return '';
};

// TODO: need to update the parser to allow naked keywords to occur in backtick forms.
macros['`'] = function(list, userdata) {
	list = list[1];
	return deepToConstructionString(list);
}

function deepToConstructionString(items) {
	// TODO items may not necessarily be an array.
	var result = '[';
	var first = true;

	for (var i = 0; i < items.length; ++i) {
		var item = items[i];
		if (first) first = false; else result += ',';

		if (item instanceof Array) {
			if (item[0].type == '~') {
				result += process(item[1]);
			} else {
				result += deepToConstructionString(item);
			}
		} else {
			result += item.toConstructionString();
		}
	}

	return result + ']';
}



// Not exactly macros at the moment
/**
* (defn name (params...) body) -> (def x (fn (params...) body))
*/
macros.defn = function(list, userdata) {
	return process(
		[Node('def'), list[1],
			[Node('fn'), list[2]].concat(rest(list, 3))], userdata);
};


/**
* (when exp body) -> (if exp (do body))
*/
macros.when = function(list, userdata) {
	return process([Node('if'), list[1], [Node('do')].concat(rest(list, 2))], userdata);
};

/**
* (do body) -> ((fn () body))
*/
macros.do = function(list, userdata) {
	return process([[Node('fn'), []].concat(rest(list, 1))], userdata);
};

/**
* (obj (name (params...) body)) -> {key: (fn (params..) body)}
*/
macros.obj = function(list) {
	var result = [Node('jsobject')];

	for (var i = 1; i < list.length; ++i) {
		var def = list[i];
		if (list[i][1] instanceof Array) {
			result.push(list[i][0]);
			result.push([Node('fn'), list[i][1]].concat(rest(list[i], 2)));
		} else {
			
		}
	}

	return process(result);
};

// TODO: convert to a list of existing symbols instead of generating the JS
macros.type = function(list, userdata) {
	var result = "(function() { function " + list[1] + "(";

	var methodsStart;
	var directives = list[2][0];
	if (directives.type == 'jsobject') {
		methodsStart = 3;
		directives = list[2];
	} else {
		methodsStart = 2;
		directives = [];
	}

	var methodDefs = "";
	var constructor;
	for (var i = methodsStart; i < list.length; ++i) {
		if (list[i][0].key == 'ctor')
			constructor = list[i];
		else {
			methodDefs += list[1] + ".prototype." + list[i][0] 
						+ " = function(" + processors.fnparams(list[i][1]) + ") {"
						+ processors.fnbody(rest(list[i], 2))
						+ "};\n"
		}
	}

	if (constructor) {
		result += processors.fnparams(constructor[1])
				+ ") {" + processors.fnbody(rest(constructor, 2).concat([Node('id', 'this')]))
				+ "}\n";
	} else {
		result += "){}\n";
	}

	var proto;
	var mixins;
	for (var i = 2; i < directives.length; i += 2) {
		if (directives[i-1].key == 'extend')
			proto = directives[i];
		else if (directives[i-1].key == 'mix')
			mixins = directives[i];
	}

	if (proto) {
		result += list[1] + ".prototype = Object.create(" + process(proto) + ");\n";
	}

	result += methodDefs;

	if (mixins) {
		result += "extend(" + list[1] + ".prototype, " + processors.parameters(rest(mixins, 1)) + ");\n";
	}

	return result + "return " + list[1] + "; })()";
};

macros.deftype = function(list, userdata) {
	return process([Node('def'), list[1], [Node('fncall', 'type')].concat(rest(list, 1))]);
};
function process(list, userdata) {
	if (!list) return null;
	var processor = lookupProcessor(list);
	if (!processor)
		throw "Illegal state.  No processor for " + list;
	return processor(list, userdata);
}
if (oldprocess) {
	process.argv = oldprocess.argv;
	process.exit = oldprocess.exit;
}

function lookupProcessor(list) {
	if (list instanceof Node)
		return returnText;

	var lookup = list[0];
	if (lookup instanceof Array) {
		return processors.fncall;
	}

	var processor = macros[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.type];
	return processor;
}

function returnText(node) {
	return node.text;
}
var processors = {
	number: returnText,
	id: returnText,
	string: returnText,
	mathy: function(list, userdata) {
		var op = first(list).text;
		var params = rest(list);
		var fn;
		var binaryRep = op;
		var unaryRep;
		switch(op) {
		case '=':
			fn = 'eq';
			binaryRep = '===';
			break;
		case '+':
			fn = 'plus';
			break;
		case '-':
			fn = 'minus';
			break;
		case '*':
			fn = 'mult';
			break;
		case '>':
			fn = 'gt';
			break;
		case '<':
			fn = 'lt';
			break;
		case '>=':
			fn = 'gte';
			break;
		case '<=':
			fn = 'lte';
			break;
		case '/':
			fn = 'divide';
			break;
		case 'not':
			unaryRep = '!';
			break;
		}

		var count = params.length;
		if (unaryRep) {
			return unaryRep + process(params[0], userdata);
		} else if (count == 2) {
			return '(' + process(params[0], userdata) + binaryRep + 
					process(params[1], userdata) + ')';
		} else if(count == 1) {
			return 'u' + fn + "(" + processors.parameters(params, userdata) + ")";
		} else {
			return fn + ".call(null, " + processors.parameters(params, userdata) + ")";
		}
	}
};

processors.pgm = function(list, userdata) {
	var result = "(function() {";
	result += processors.fnbody(list, userdata);
	return result + "})();"
};

processors.fnbody = function(list, userdata) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1)
			result += "return ";
		result += process(item, userdata) + ";\n";
	});
	return result;
};

processors.if = function(list, userdata) {
	return "(" + process(list[1], userdata) +
		   " ? " + process(list[2], userdata) +
		   " : " + process(list[3], userdata) + ")\n";
};

processors.fncall = function(list, userdata) {
	if (list[0] instanceof Array) {
		return "(" + process(list[0], userdata) + ")("
				+ processors.parameters(rest(list), userdata) + ")";
	} else {
		return list[0] + "(" + processors.parameters(rest(list), userdata) + ")";
	}
};

processors.let = function(list, userdata) {
	return "(function() { " + 
		processors.bindings(list[1], userdata) + 
		"\n" + 
		processors.fnbody(rest(list, 2), userdata) +
		"\n})()";
};

processors.new = function(list, userdata) {
	return "new " + process(list[1], userdata)
		 	+ "(" + processors.parameters(rest(list, 2), userdata)
			+ ")";
};

processors.parameters = function(list, userdata) {
	var result = "";
	var first = true;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += process(item, userdata);
	});

	return result;
};

processors.loop = function(list, userdata) {
	return "(function() { var __looping, __loopResult; "
		+ processors.bindings(list[1], userdata) + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ processors.loopbody(rest(list, 2), list[1])
		+ "} while(__looping);\n"
		+ "return __loopResult;})()";
};

processors.loopbody = function(list, bindings) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1)
			result += "__loopResult = ";
		result += process(item, bindings) + ";\n";
	});
	return result;
};

processors.bindings = function(list, userdata) {
	var result = "";
	for (var i = 1; i < list.length; i += 2) {
		result += "var " + list[i-1] + " = " + process(list[i], userdata) + ";\n";
	}

	return result;
};

processors.recur = function(list, bindings) {
	var result = "(__looping = true) && false";
	if (list[1]) {
		result += processors.recurparams(rest(list), bindings);
	}

	return result;
};

processors.recurparams = function(list, bindings) {
	var result = "";
	for (var i = 0, j = 0; i < list.length; ++i, j += 2) {
		result += "|| (" + bindings[j] + " = " + process(list[i], bindings) + ") && false";
	}

	return result;
};

processors.jsobject = function(list, userdata) {
	var result = "{";
	var first = true;
	for (var i = 2; i < list.length; i += 2) {
		if (first) first = false; else result += ",";
		result += list[i-1] + ":" + process(list[i], userdata);
	}

	return result + "}";
};

processors.jsarray = function(list, userdata) {
	var result = "[";
	var first = true;
	for (var i = 1; i < list.length; ++i) {
		var item = list[i];
		if (first) first = false; else result += ",";
		result += process(item, userdata);
	}

	return result + "]";
};

processors.switch = function(list, userdata) {
	var exp = list[1];
	var caselist = rest(list, 2);

	var result = "(function() {\n var __res;";
	result += "switch (" + process(exp, userdata) + ") {\n";

	for (var i = 1; i < caselist.length; i+=2) {
		result += "case " + process(caselist[i-1], userdata) + ":\n"
			+ "__res = " + process(caselist[i], userdata) + "break;\n";
	}

	return result + "\n}\n return __res;})()";
};

processors.set = function(list, userdata) {
	return "(" + process(list[1], userdata) + " = " + process(list[2], userdata) + ")";
};

processors.refprop = function(list, userdata) {
	return "(" + process(list[2], userdata) + ")." + list[1];
};

processors.def = function(list, userdata) {
	return "var " + list[1] + " = " + process(list[2], userdata) + "\n";
};

processors.mcall = function(list, userdata) {
	return "(" + process(list[2], userdata) + ")." + list[1] + "("
		 + processors.parameters(rest(list, 3), userdata) + ")";
};

// TODO: add default parameters
processors.fn = function(list, userdata) {
	return "function(" + processors.fnparams(list[1], userdata) + ") {\n" +
		processors.fnbody(rest(list, 2), userdata) + "\n}\n";
};

processors.fnparams = function(list, userdata) {
	var first = true;
	var result = "";
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += item;
	});

	return result;
};

/* parser generated by jison 0.4.10 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var mochascriptParser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"pgm":3,"explisti":4,"ENDOFFILE":5,"exp":6,"sexp":7,"slet":8,"sif":9,"sswitch":10,"sset":11,"sprop":12,"smcall":13,"sdef":14,"sfn":15,"sloop":16,"srecur":17,"LPAREN":18,"RPAREN":19,"params":20,"NEW":21,"id":22,"mathy":23,"MATHY":24,"LOOP":25,"letparams":26,"RECUR":27,"recurparams":28,"LET":29,"IF":30,"NUMBER":31,"STRING":32,"jsdata":33,"tilde":34,"backtick":35,"TILDE":36,"BACKTICK":37,"jsobject":38,"jsarray":39,"LCURLY":40,"jskeyvalpairs":41,"RCURLY":42,"jskey":43,"COLON":44,"LBRACKET":45,"jsarrayentries":46,"RBRACKET":47,"SWITCH":48,"caselist":49,"SET":50,"DEF":51,"mcall":52,"propaccess":53,"FN":54,"fnparams":55,"ID":56,"MCALL":57,"PROPACCESS":58,"$accept":0,"$end":1},
terminals_: {2:"error",5:"ENDOFFILE",18:"LPAREN",19:"RPAREN",21:"NEW",24:"MATHY",25:"LOOP",27:"RECUR",29:"LET",30:"IF",31:"NUMBER",32:"STRING",36:"TILDE",37:"BACKTICK",40:"LCURLY",42:"RCURLY",44:"COLON",45:"LBRACKET",47:"RBRACKET",48:"SWITCH",50:"SET",51:"DEF",54:"FN",56:"ID",57:"MCALL",58:"PROPACCESS"},
productions_: [0,[3,2],[4,2],[4,0],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,2],[7,4],[7,5],[7,4],[7,4],[23,1],[20,2],[20,0],[16,7],[17,4],[28,2],[28,0],[8,7],[26,3],[26,0],[9,5],[9,6],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[34,2],[35,2],[33,1],[33,1],[38,3],[41,4],[41,0],[43,1],[43,1],[39,3],[46,2],[46,0],[10,5],[49,3],[49,0],[11,5],[11,5],[14,5],[13,5],[12,4],[15,7],[55,2],[55,0],[22,1],[52,1],[53,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:return processors.pgm($$[$0-1])
break;
case 2:this.$ = [$$[$0-1]].concat($$[$0]);
break;
case 3:this.$ = [];
break;
case 4:this.$ = $$[$0];
break;
case 5:this.$ = $$[$0];
break;
case 6:this.$ = $$[$0];
break;
case 7:this.$ = $$[$0];
break;
case 8:this.$ = $$[$0];
break;
case 9:this.$ = $$[$0];
break;
case 10:this.$ = $$[$0];
break;
case 11:this.$ = $$[$0];
break;
case 12:this.$ = $$[$0];
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = []
break;
case 15:this.$ = [$$[$0-2]].concat($$[$0-1]);
break;
case 16:this.$ = [Node('new'), $$[$0-2]].concat($$[$0-1]);
break;
case 17:this.$ = [Node('fncall', $$[$0-2].key)].concat($$[$0-1]);
break;
case 18:this.$ = [$$[$0-2]].concat($$[$0-1]);
break;
case 19:this.$ = Node('mathy', $$[$0])
break;
case 20:this.$ = [$$[$0-1]].concat($$[$0]);
break;
case 21:this.$ = [];
break;
case 22:this.$ = [Node('loop'), $$[$0-3]].concat($$[$0-1]);
break;
case 23:this.$ = [Node('recur')].concat($$[$0-1]);
break;
case 24:this.$ = [$$[$0-1]].concat($$[$0])
break;
case 25:this.$ = []
break;
case 26:this.$ = [Node('let'), $$[$0-3]].concat($$[$0-1]);
break;
case 27:this.$ = [$$[$0-2], $$[$0-1]].concat($$[$0]);
break;
case 28:this.$ = [];
break;
case 29:this.$ = [Node('if'), $$[$0-2], $$[$0-1]];
break;
case 30:this.$ = [Node('if'), $$[$0-3], $$[$0-2], $$[$0-1]];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = Node('number', yytext);
break;
case 33:this.$ = Node('string', yytext);
break;
case 34:this.$ = $$[$0];
break;
case 35:this.$ = $$[$0];
break;
case 36:this.$ = $$[$0];
break;
case 37:this.$ = $$[$0];
break;
case 38:this.$ = [Node('~', ''), $$[$0]];
break;
case 39:this.$ = [Node('`'), $$[$0]];
break;
case 40:this.$ = $$[$0]
break;
case 41:this.$ = $$[$0]
break;
case 42:this.$ = [Node('jsobject', '')].concat($$[$0-1]);
break;
case 43:this.$ = [$$[$0-3], $$[$0-1]].concat($$[$0]);
break;
case 44:this.$ = [];
break;
case 45:this.$ = $$[$0];
break;
case 46:this.$ = Node('string', yytext);
break;
case 47:this.$ = [Node('jsarray', '')].concat($$[$0-1]);
break;
case 48:this.$ = [$$[$0-1]].concat($$[$0])
break;
case 49:this.$ = [];
break;
case 50:this.$ = [Node('switch'), exp].concat(caselist);
break;
case 51:this.$ = [exp, exp].concat(caselist);
break;
case 52:this.$ = [];
break;
case 53:this.$ = [Node('set'), $$[$0-2], $$[$0-1]];
break;
case 54:this.$ = [Node('set'), $$[$0-2], $$[$0-1]];
break;
case 55:this.$ = [Node('def'), $$[$0-2], $$[$0-1]];
break;
case 56:this.$ = [Node('mcall', ''), $$[$0-3], $$[$0-2]].concat($$[$0-1]);
break;
case 57:this.$ = [Node('refprop', ''), $$[$0-2], $$[$0-1]];
break;
case 58:this.$ = [Node('fn'), $$[$0-3]].concat($$[$0-1]);
break;
case 59:this.$ = [$$[$0-1]].concat($$[$0]);
break;
case 60:this.$ = [];
break;
case 61:this.$ = Node('id', yytext);
break;
case 62:this.$ = Node('id', yytext.substring(1));
break;
case 63:this.$ = Node('id', yytext.substring(1));
break;
}
},
table: [{3:1,4:2,5:[2,3],6:3,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{1:[3]},{5:[1,29]},{4:30,5:[2,3],6:3,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,3],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{5:[2,31],18:[2,31],19:[2,31],31:[2,31],32:[2,31],36:[2,31],37:[2,31],40:[2,31],42:[2,31],45:[2,31],47:[2,31],56:[2,31]},{5:[2,32],18:[2,32],19:[2,32],31:[2,32],32:[2,32],36:[2,32],37:[2,32],40:[2,32],42:[2,32],45:[2,32],47:[2,32],56:[2,32]},{5:[2,33],18:[2,33],19:[2,33],31:[2,33],32:[2,33],36:[2,33],37:[2,33],40:[2,33],42:[2,33],45:[2,33],47:[2,33],56:[2,33]},{5:[2,34],18:[2,34],19:[2,34],31:[2,34],32:[2,34],36:[2,34],37:[2,34],40:[2,34],42:[2,34],45:[2,34],47:[2,34],56:[2,34]},{5:[2,35],18:[2,35],19:[2,35],31:[2,35],32:[2,35],36:[2,35],37:[2,35],40:[2,35],42:[2,35],45:[2,35],47:[2,35],56:[2,35]},{5:[2,36],18:[2,36],19:[2,36],31:[2,36],32:[2,36],36:[2,36],37:[2,36],40:[2,36],42:[2,36],45:[2,36],47:[2,36],56:[2,36]},{5:[2,37],18:[2,37],19:[2,37],31:[2,37],32:[2,37],36:[2,37],37:[2,37],40:[2,37],42:[2,37],45:[2,37],47:[2,37],56:[2,37]},{5:[2,61],18:[2,61],19:[2,61],31:[2,61],32:[2,61],36:[2,61],37:[2,61],40:[2,61],42:[2,61],44:[2,61],45:[2,61],47:[2,61],56:[2,61]},{5:[2,40],18:[2,40],19:[2,40],31:[2,40],32:[2,40],36:[2,40],37:[2,40],40:[2,40],42:[2,40],45:[2,40],47:[2,40],56:[2,40]},{5:[2,41],18:[2,41],19:[2,41],31:[2,41],32:[2,41],36:[2,41],37:[2,41],40:[2,41],42:[2,41],45:[2,41],47:[2,41],56:[2,41]},{6:31,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:32,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{5:[2,4],18:[2,4],19:[2,4],31:[2,4],32:[2,4],36:[2,4],37:[2,4],40:[2,4],42:[2,4],45:[2,4],47:[2,4],56:[2,4]},{5:[2,5],18:[2,5],19:[2,5],31:[2,5],32:[2,5],36:[2,5],37:[2,5],40:[2,5],42:[2,5],45:[2,5],47:[2,5],56:[2,5]},{5:[2,6],18:[2,6],19:[2,6],31:[2,6],32:[2,6],36:[2,6],37:[2,6],40:[2,6],42:[2,6],45:[2,6],47:[2,6],56:[2,6]},{5:[2,7],18:[2,7],19:[2,7],31:[2,7],32:[2,7],36:[2,7],37:[2,7],40:[2,7],42:[2,7],45:[2,7],47:[2,7],56:[2,7]},{5:[2,8],18:[2,8],19:[2,8],31:[2,8],32:[2,8],36:[2,8],37:[2,8],40:[2,8],42:[2,8],45:[2,8],47:[2,8],56:[2,8]},{5:[2,9],18:[2,9],19:[2,9],31:[2,9],32:[2,9],36:[2,9],37:[2,9],40:[2,9],42:[2,9],45:[2,9],47:[2,9],56:[2,9]},{5:[2,10],18:[2,10],19:[2,10],31:[2,10],32:[2,10],36:[2,10],37:[2,10],40:[2,10],42:[2,10],45:[2,10],47:[2,10],56:[2,10]},{5:[2,11],18:[2,11],19:[2,11],31:[2,11],32:[2,11],36:[2,11],37:[2,11],40:[2,11],42:[2,11],45:[2,11],47:[2,11],56:[2,11]},{5:[2,12],18:[2,12],19:[2,12],31:[2,12],32:[2,12],36:[2,12],37:[2,12],40:[2,12],42:[2,12],45:[2,12],47:[2,12],56:[2,12]},{5:[2,13],18:[2,13],19:[2,13],31:[2,13],32:[2,13],36:[2,13],37:[2,13],40:[2,13],42:[2,13],45:[2,13],47:[2,13],56:[2,13]},{7:34,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[1,33],21:[1,35],22:36,23:37,24:[1,48],25:[1,46],27:[1,47],29:[1,38],30:[1,39],48:[1,40],50:[1,41],51:[1,44],52:43,53:42,54:[1,45],56:[1,11],57:[1,50],58:[1,49]},{22:53,32:[1,54],41:51,42:[2,44],43:52,56:[1,11]},{6:56,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],46:55,47:[2,49],56:[1,11]},{1:[2,1]},{5:[2,2],19:[2,2]},{5:[2,38],18:[2,38],19:[2,38],31:[2,38],32:[2,38],36:[2,38],37:[2,38],40:[2,38],42:[2,38],45:[2,38],47:[2,38],56:[2,38]},{5:[2,39],18:[2,39],19:[2,39],31:[2,39],32:[2,39],36:[2,39],37:[2,39],40:[2,39],42:[2,39],45:[2,39],47:[2,39],56:[2,39]},{5:[2,14],18:[2,14],19:[2,14],31:[2,14],32:[2,14],36:[2,14],37:[2,14],40:[2,14],42:[2,14],45:[2,14],47:[2,14],56:[2,14]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:57,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{22:59,56:[1,11]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:60,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:61,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{18:[1,62]},{6:63,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:64,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{12:66,18:[1,67],22:65,56:[1,11]},{6:68,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:69,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{22:70,56:[1,11]},{18:[1,71]},{18:[1,72]},{6:74,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,25],22:4,28:73,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{18:[2,19],19:[2,19],31:[2,19],32:[2,19],36:[2,19],37:[2,19],40:[2,19],45:[2,19],56:[2,19]},{18:[2,63],31:[2,63],32:[2,63],36:[2,63],37:[2,63],40:[2,63],45:[2,63],56:[2,63]},{18:[2,62],31:[2,62],32:[2,62],36:[2,62],37:[2,62],40:[2,62],45:[2,62],56:[2,62]},{42:[1,75]},{44:[1,76]},{44:[2,45]},{44:[2,46]},{47:[1,77]},{6:56,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],46:78,47:[2,49],56:[1,11]},{19:[1,79]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:80,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:81,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[1,82]},{19:[1,83]},{19:[2,28],22:85,26:84,56:[1,11]},{6:86,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:88,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,52],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],49:87,56:[1,11]},{6:89,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:90,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{53:42,58:[1,49]},{19:[1,91]},{6:58,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,21],20:92,22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:93,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[2,60],22:95,55:94,56:[1,11]},{19:[2,28],22:85,26:96,56:[1,11]},{19:[1,97]},{6:74,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,25],22:4,28:98,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{5:[2,42],18:[2,42],19:[2,42],31:[2,42],32:[2,42],36:[2,42],37:[2,42],40:[2,42],42:[2,42],45:[2,42],47:[2,42],56:[2,42]},{6:99,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{5:[2,47],18:[2,47],19:[2,47],31:[2,47],32:[2,47],36:[2,47],37:[2,47],40:[2,47],42:[2,47],45:[2,47],47:[2,47],56:[2,47]},{47:[2,48]},{5:[2,15],18:[2,15],19:[2,15],31:[2,15],32:[2,15],36:[2,15],37:[2,15],40:[2,15],42:[2,15],45:[2,15],47:[2,15],56:[2,15]},{19:[2,20]},{19:[1,100]},{5:[2,17],18:[2,17],19:[2,17],31:[2,17],32:[2,17],36:[2,17],37:[2,17],40:[2,17],42:[2,17],45:[2,17],47:[2,17],56:[2,17]},{5:[2,18],18:[2,18],19:[2,18],31:[2,18],32:[2,18],36:[2,18],37:[2,18],40:[2,18],42:[2,18],45:[2,18],47:[2,18],56:[2,18]},{19:[1,101]},{6:102,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{6:104,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[1,103],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[1,105]},{6:106,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[1,107]},{19:[1,108]},{5:[2,57],18:[2,57],19:[2,57],31:[2,57],32:[2,57],36:[2,57],37:[2,57],40:[2,57],42:[2,57],45:[2,57],47:[2,57],56:[2,57]},{19:[1,109]},{19:[1,110]},{19:[1,111]},{19:[2,60],22:95,55:112,56:[1,11]},{19:[1,113]},{5:[2,23],18:[2,23],19:[2,23],31:[2,23],32:[2,23],36:[2,23],37:[2,23],40:[2,23],42:[2,23],45:[2,23],47:[2,23],56:[2,23]},{19:[2,24]},{22:53,32:[1,54],41:114,42:[2,44],43:52,56:[1,11]},{5:[2,16],18:[2,16],19:[2,16],31:[2,16],32:[2,16],36:[2,16],37:[2,16],40:[2,16],42:[2,16],45:[2,16],47:[2,16],56:[2,16]},{4:115,6:3,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,3],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[2,28],22:85,26:116,56:[1,11]},{5:[2,29],18:[2,29],19:[2,29],31:[2,29],32:[2,29],36:[2,29],37:[2,29],40:[2,29],42:[2,29],45:[2,29],47:[2,29],56:[2,29]},{19:[1,117]},{5:[2,50],18:[2,50],19:[2,50],31:[2,50],32:[2,50],36:[2,50],37:[2,50],40:[2,50],42:[2,50],45:[2,50],47:[2,50],56:[2,50]},{6:88,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,52],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],49:118,56:[1,11]},{5:[2,53],18:[2,53],19:[2,53],31:[2,53],32:[2,53],36:[2,53],37:[2,53],40:[2,53],42:[2,53],45:[2,53],47:[2,53],56:[2,53]},{5:[2,54],18:[2,54],19:[2,54],31:[2,54],32:[2,54],36:[2,54],37:[2,54],40:[2,54],42:[2,54],45:[2,54],47:[2,54],56:[2,54]},{5:[2,56],18:[2,56],19:[2,56],31:[2,56],32:[2,56],36:[2,56],37:[2,56],40:[2,56],42:[2,56],45:[2,56],47:[2,56],56:[2,56]},{5:[2,55],18:[2,55],19:[2,55],31:[2,55],32:[2,55],36:[2,55],37:[2,55],40:[2,55],42:[2,55],45:[2,55],47:[2,55],56:[2,55]},{4:119,6:3,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,3],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{19:[2,59]},{4:120,6:3,7:10,8:16,9:17,10:18,11:19,12:20,13:21,14:22,15:23,16:24,17:25,18:[1,26],19:[2,3],22:4,31:[1,5],32:[1,6],33:7,34:8,35:9,36:[1,14],37:[1,15],38:12,39:13,40:[1,27],45:[1,28],56:[1,11]},{42:[2,43]},{19:[1,121]},{19:[2,27]},{5:[2,30],18:[2,30],19:[2,30],31:[2,30],32:[2,30],36:[2,30],37:[2,30],40:[2,30],42:[2,30],45:[2,30],47:[2,30],56:[2,30]},{19:[2,51]},{19:[1,122]},{19:[1,123]},{5:[2,26],18:[2,26],19:[2,26],31:[2,26],32:[2,26],36:[2,26],37:[2,26],40:[2,26],42:[2,26],45:[2,26],47:[2,26],56:[2,26]},{5:[2,58],18:[2,58],19:[2,58],31:[2,58],32:[2,58],36:[2,58],37:[2,58],40:[2,58],42:[2,58],45:[2,58],47:[2,58],56:[2,58]},{5:[2,22],18:[2,22],19:[2,22],31:[2,22],32:[2,22],36:[2,22],37:[2,22],40:[2,22],42:[2,22],45:[2,22],47:[2,22],56:[2,22]}],
defaultActions: {29:[2,1],53:[2,45],54:[2,46],78:[2,48],80:[2,20],98:[2,24],112:[2,59],114:[2,43],116:[2,27],118:[2,51]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == 'undefined') {
        this.lexer.yylloc = {};
    }
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === 'function') {
        this.parseError = this.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || EOF;
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + this.lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: this.lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: this.lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.2.1 */
var lexer = (function(){
var lexer = {

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input) {
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len - 1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* ignore comments */
break;
case 1:return 18;
break;
case 2:return 19;
break;
case 3:return 50;
break;
case 4:return 36;
break;
case 5:return 37;
break;
case 6:return 32;
break;
case 7:return 32;
break;
case 8:return 31;
break;
case 9:return 24;
break;
case 10:return 21;
break;
case 11:return 51;
break;
case 12:return 29;
break;
case 13:return 30;
break;
case 14:return 48;
break;
case 15:return 54;
break;
case 16:return 25;
break;
case 17:return 27;
break;
case 18:return 57;
break;
case 19:return 58;
break;
case 20:return 56;
break;
case 21:return 44;
break;
case 22:return 'COMMA';
break;
case 23:return 40;
break;
case 24:return 42;
break;
case 25:return 45;
break;
case 26:return 47;
break;
case 27:return 24;
break;
case 28:return 24;
break;
case 29:return 24;
break;
case 30:return 24;
break;
case 31:return 24;
break;
case 32:return 24;
break;
case 33:return 24;
break;
case 34:return 24;
break;
case 35:return 24;
break;
case 36:/* skip whitespace */
break;
case 37:return 5;
break;
}
},
rules: [/^(?:;.*)/,/^(?:\()/,/^(?:\))/,/^(?:!)/,/^(?:~)/,/^(?:`)/,/^(?:"[^"]*")/,/^(?:'[^']*')/,/^(?:([-]?[0-9]*\.?[0-9]+))/,/^(?:not\b)/,/^(?:new\b)/,/^(?:def\b)/,/^(?:let\b)/,/^(?:if\b)/,/^(?:switch\b)/,/^(?:fn\b)/,/^(?:loop\b)/,/^(?:recur\b)/,/^(?:(\.[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:(:[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:([a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?::)/,/^(?:,)/,/^(?:\{)/,/^(?:\})/,/^(?:\[)/,/^(?:\])/,/^(?:=)/,/^(?:\+)/,/^(?:-)/,/^(?:\*)/,/^(?:>)/,/^(?:<)/,/^(?:>=)/,/^(?:<=)/,/^(?:\/)/,/^(?:\s+)/,/^(?:$)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37],"inclusive":true}}
};
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = mochascriptParser;
exports.Parser = mochascriptParser.Parser;
exports.parse = function () { return mochascriptParser.parse.apply(mochascriptParser, arguments); };
exports.main = function commonjsMain(args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
root.mochascriptParser = mochascriptParser;
}).call(this, this);