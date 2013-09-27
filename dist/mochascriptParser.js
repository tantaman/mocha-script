
if (typeof module !== 'undefined' && require.main === module) {
	var oldprocess = process; 
}

if (typeof module == 'object' && module.exports) {
	require('./stdlib');
}

(function(root) {

function Node(type, key, text) {
	if (!(this instanceof Node))
		return new Node(type, key, text);

	this.type = type;
	this.key = key || type;
	this.text = text || key || type;
}

Node.prototype.toString = function() {
	return this.text;
};

Node.prototype.toConstructionString = function() {
  var key = quoteIfString(this.key);
  var text = quoteIfString(this.text);

  return "Node('" + this.type + "', " + key + ", "
        + text + ")";
}

function Refprop(type, key, text) {
  if (!(this instanceof Refprop))
    return new Refprop(type, key, text);

  Node.call(this, type, key, text);
}

Refprop.prototype = Object.create(Node.prototype);
Refprop.prototype.toString = function() {
  return this.text.substring(1);
}
Refprop.prototype.toConstructionString = function() {
  var key = quoteIfString(this.key);
  var text = quoteIfString(this.text);
  return "Refprop('" + this.type + "', " + key + ", " + text + ")";
}

function quoteIfString(item) {
  if (typeof item === 'string') {
    item = item.replace(/"/g, '\\"');
    return '"' + item + '"';
  }
  return item;
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
	eval("var __tempMacro = " + str);
	if (name in macros)
		console.error('Macro ' + name + ' is being re-defined');
	macros[name] = wrapMacro(__tempMacro);

	if (typeof ms_dumpMacros != 'undefined' && ms_dumpMacros === true) {
		return "macros['" + name + "'] = wrapMacro(" + str + ");\n";
	} else {
		return '';
	}
};

// TODO: need to update the parser to allow naked keywords to occur in backtick forms.
macros['`'] = function(list, userdata) {
	list = list[1];
	return deepToConstructionString(list);
}

function deepToConstructionString(items) {
	// TODO items may not necessarily be an array.
	var result = '[';
	for (var i = 0; i < items.length; ++i) {
		var item = items[i];
		if (i != 0) result += ',';

		if (item instanceof Array) {
			if (item[0].type == '~') {
				result += process(item[1]);
			} else if (item[0].type == '~@') {
				var arr = process(item[1]);
				for (var j = 0; j < arr.length; ++j) {
					if (j != 0) result += ',';
					result += arr[i];
				}
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
						+ " = function(" + processors.fnparams(list[i][1], userdata) + ") {"
						+ processors.fnbody(rest(list[i], 2), userdata)
						+ "};\n"
		}
	}

	if (constructor) {
		result += processors.fnparams(constructor[1], userdata)
				+ ") {" + processors.fnbody(rest(constructor, 2).concat([Node('id', 'this')]), userdata)
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
		result += "extend(" + list[1] + ".prototype, " + processors.parameters(rest(mixins, 1), userdata) + ");\n";
	}

	return result + "return " + list[1] + "; })()";
};

macros.deftype = function(list, userdata) {
	return process([Node('def'), list[1], [Node('fncall', 'type')].concat(rest(list, 1))], userdata);
};
(function() {macros['!!'] = wrapMacro(function(syms) {
return [Node('fncall', "let", "let"),[Node('fncall', "obj", "obj"),get(syms,1),Node('id', "newValue", "newValue"),get(syms,3),Node('id', "oldValue", "oldValue"),[get(syms,2),Node('id', "obj", "obj")]],[Node('fncall', "!", "!"),[get(syms,2),Node('id', "obj", "obj")],Node('id', "newValue", "newValue")],[Node('fncall', "msdispatch.propChange", "msdispatch.propChange"),Node('id', "obj", "obj"),get(syms,2),Node('id', "newValue", "newValue"),Node('id', "oldValue", "oldValue")],Node('id', "newValue", "newValue")];
});
;
macros['assoc!'] = wrapMacro(function(syms) {
return [Node('fncall', "let", "let"),[Node('fncall', "obj", "obj"),get(syms,1)],[Node('fncall', "!", "!"),Node('id', "obj", "obj"),get(syms,2),get(syms,3)],Node('id', "obj", "obj")];
});
;
return macros['obj'] = wrapMacro(function(syms) {
return (function() { var values = map(function(prop) {
return ((prop.length===2) ? (prop)[1] : [Node('fncall', "fn", "fn"),(prop)[1],rest(prop,2)])
;
},rest(syms));
var keys = map(function(prop) {
return (prop)[0];
},rest(syms));

return ([Node("jsobject")]).concat(flatten(zip(keys,values),true));

})();
});
;
})();
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

// TODO: are there any conflicts with this method of lookup?
// mainly worried about the id to fncall conversion stuff...

// TODO: we need to make the lookup smarter
// It shouldn't be just by name anymore but
// by name, num args, & arg types.
// this will allow us to construct much simpler macros
// as well as overload macro definitions.
function lookupProcessor(list) {
	if (list instanceof Node)
		return returnText;

	var lookup = list[0];
	if (lookup instanceof Array) {
		return processors.fncall;
	}

	// TODO: evaluate the sanity of this.
	if (list[0].type == "string" || list[0].type == "number")
		return processors.refprop;

	var processor = macros[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.type];
	if (processor) return processor;

	return processors.fncall;
}

function returnText(node) {
	return node.toString();
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
	var result = "";
	userdata = userdata || {};
	var unwrap = (typeof ms_unwrap != 'undefined' && ms_unwrap === true) ? true : false;
	if (!unwrap)
		result = "(function() {";
	userdata.unwrap = unwrap;

	result += processors.fnbody(list, userdata);
	return result + ((unwrap) ? "" : "})();");
};

processors.fnbody = function(list, userdata) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1) {
			if (item instanceof Array && (item[0].key == 'def' || item[0].key == 'defn')) {
				result += process(item, userdata) + ";\n";
				if (!userdata.unwrap)
					result += "return ";
				result += item[1] + ";\n";
			} else {
				if (!userdata.unwrap)
					result += "return ";
				result += process(item, userdata) + ";\n";
			}
		} else {
			result += process(item, userdata) + ";\n";
		}
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
		if (item.type == 'refprop')
			result += '"' + item.toString() + '"';
		else
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

processors['!'] = function(list, userdata) {
	if (list.length == 4) {
		// TODO: return the object upon which the value was set?
		return "(" + processors.refprop([list[2], list[1]], userdata) + " = " + process(list[3], userdata) + ")";
	} else {
		return "(" + process(list[1], userdata) + " = " + process(list[2], userdata) + ")";
	}
};

processors.refprop = function(list, userdata) {
	if (list[0].type == "refprop") {
		return "(" + process(list[1], userdata) + ")." + list[0];
	} else {
		return "(" + process(list[1], userdata) + ")[" + process(list[0]) + "]";
	}
};

processors.def = function(list, userdata) {
	return "var " + list[1] + " = " + process(list[2], userdata);
};

processors.mcall = function(list, userdata) {
	return "(" + process(list[1], userdata) + ")" + list[0] + "("
	 + processors.parameters(rest(list, 2), userdata) + ")";
};

// TODO: add default parameters
processors.fn = function(list, userdata) {
	return "function(" + processors.fnparams(list[1], userdata) + ") {\n" +
		processors.fnbody(rest(list, 2), userdata) + "}";
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
symbols_: {"error":2,"pgm":3,"explisti":4,"ENDOFFILE":5,"exp":6,"sexp":7,"LPAREN":8,"RPAREN":9,"mathy":10,"MATHY":11,"id":12,"NUMBER":13,"STRING":14,"jsdata":15,"tilde":16,"tildeat":17,"backtick":18,"mcall":19,"propaccess":20,"TILDE":21,"TILDE_AT":22,"BACKTICK":23,"jsobject":24,"jsarray":25,"LCURLY":26,"jskeyvalpairs":27,"RCURLY":28,"jskey":29,"COLON":30,"LBRACKET":31,"jsarrayentries":32,"RBRACKET":33,"ID":34,"MCALL":35,"PROPACCESS":36,"$accept":0,"$end":1},
terminals_: {2:"error",5:"ENDOFFILE",8:"LPAREN",9:"RPAREN",11:"MATHY",13:"NUMBER",14:"STRING",21:"TILDE",22:"TILDE_AT",23:"BACKTICK",26:"LCURLY",28:"RCURLY",30:"COLON",31:"LBRACKET",33:"RBRACKET",34:"ID",35:"MCALL",36:"PROPACCESS"},
productions_: [0,[3,2],[4,2],[4,0],[7,3],[10,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[6,1],[16,2],[17,2],[18,2],[15,1],[15,1],[24,3],[27,4],[27,0],[29,1],[29,1],[25,3],[32,2],[32,0],[12,1],[19,1],[20,1]],
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
case 4:if ($$[$0-1].length && $$[$0-1][0].type == 'id')
			$$[$0-1][0].type = 'fncall';
		this.$ = $$[$0-1];
break;
case 5:this.$ = Node('mathy', $$[$0])
break;
case 6:this.$ = $$[$0];
break;
case 7:this.$ = Node('number', yytext);
break;
case 8:this.$ = Node('string', yytext);
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
case 14:this.$ = $$[$0];
break;
case 15:this.$ = $$[$0];
break;
case 16:this.$ = $$[$0];
break;
case 17:this.$ = [Node('~', ''), $$[$0]];
break;
case 18:this.$ = [Node('~@', ''), $$[$0]];
break;
case 19:this.$ = [Node('`'), $$[$0]];
break;
case 20:this.$ = $$[$0]
break;
case 21:this.$ = $$[$0]
break;
case 22:this.$ = [Node('jsobject', '')].concat($$[$0-1]);
break;
case 23:this.$ = [$$[$0-3], $$[$0-1]].concat($$[$0]);
break;
case 24:this.$ = [];
break;
case 25:this.$ = $$[$0];
break;
case 26:this.$ = Node('string', yytext);
break;
case 27:this.$ = [Node('jsarray', '')].concat($$[$0-1]);
break;
case 28:this.$ = [$$[$0-1]].concat($$[$0])
break;
case 29:this.$ = [];
break;
case 30:this.$ = Node('id', yytext);
break;
case 31:this.$ = Node('mcall', yytext);
break;
case 32:this.$ = Refprop('refprop', yytext);
break;
}
},
table: [{3:1,4:2,5:[2,3],6:3,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{1:[3]},{5:[1,27]},{4:28,5:[2,3],6:3,7:11,8:[1,21],9:[2,3],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{5:[2,6],8:[2,6],9:[2,6],11:[2,6],13:[2,6],14:[2,6],21:[2,6],22:[2,6],23:[2,6],26:[2,6],28:[2,6],31:[2,6],33:[2,6],34:[2,6],35:[2,6],36:[2,6]},{5:[2,7],8:[2,7],9:[2,7],11:[2,7],13:[2,7],14:[2,7],21:[2,7],22:[2,7],23:[2,7],26:[2,7],28:[2,7],31:[2,7],33:[2,7],34:[2,7],35:[2,7],36:[2,7]},{5:[2,8],8:[2,8],9:[2,8],11:[2,8],13:[2,8],14:[2,8],21:[2,8],22:[2,8],23:[2,8],26:[2,8],28:[2,8],31:[2,8],33:[2,8],34:[2,8],35:[2,8],36:[2,8]},{5:[2,9],8:[2,9],9:[2,9],11:[2,9],13:[2,9],14:[2,9],21:[2,9],22:[2,9],23:[2,9],26:[2,9],28:[2,9],31:[2,9],33:[2,9],34:[2,9],35:[2,9],36:[2,9]},{5:[2,10],8:[2,10],9:[2,10],11:[2,10],13:[2,10],14:[2,10],21:[2,10],22:[2,10],23:[2,10],26:[2,10],28:[2,10],31:[2,10],33:[2,10],34:[2,10],35:[2,10],36:[2,10]},{5:[2,11],8:[2,11],9:[2,11],11:[2,11],13:[2,11],14:[2,11],21:[2,11],22:[2,11],23:[2,11],26:[2,11],28:[2,11],31:[2,11],33:[2,11],34:[2,11],35:[2,11],36:[2,11]},{5:[2,12],8:[2,12],9:[2,12],11:[2,12],13:[2,12],14:[2,12],21:[2,12],22:[2,12],23:[2,12],26:[2,12],28:[2,12],31:[2,12],33:[2,12],34:[2,12],35:[2,12],36:[2,12]},{5:[2,13],8:[2,13],9:[2,13],11:[2,13],13:[2,13],14:[2,13],21:[2,13],22:[2,13],23:[2,13],26:[2,13],28:[2,13],31:[2,13],33:[2,13],34:[2,13],35:[2,13],36:[2,13]},{5:[2,14],8:[2,14],9:[2,14],11:[2,14],13:[2,14],14:[2,14],21:[2,14],22:[2,14],23:[2,14],26:[2,14],28:[2,14],31:[2,14],33:[2,14],34:[2,14],35:[2,14],36:[2,14]},{5:[2,15],8:[2,15],9:[2,15],11:[2,15],13:[2,15],14:[2,15],21:[2,15],22:[2,15],23:[2,15],26:[2,15],28:[2,15],31:[2,15],33:[2,15],34:[2,15],35:[2,15],36:[2,15]},{5:[2,16],8:[2,16],9:[2,16],11:[2,16],13:[2,16],14:[2,16],21:[2,16],22:[2,16],23:[2,16],26:[2,16],28:[2,16],31:[2,16],33:[2,16],34:[2,16],35:[2,16],36:[2,16]},{5:[2,30],8:[2,30],9:[2,30],11:[2,30],13:[2,30],14:[2,30],21:[2,30],22:[2,30],23:[2,30],26:[2,30],28:[2,30],30:[2,30],31:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30]},{5:[2,20],8:[2,20],9:[2,20],11:[2,20],13:[2,20],14:[2,20],21:[2,20],22:[2,20],23:[2,20],26:[2,20],28:[2,20],31:[2,20],33:[2,20],34:[2,20],35:[2,20],36:[2,20]},{5:[2,21],8:[2,21],9:[2,21],11:[2,21],13:[2,21],14:[2,21],21:[2,21],22:[2,21],23:[2,21],26:[2,21],28:[2,21],31:[2,21],33:[2,21],34:[2,21],35:[2,21],36:[2,21]},{6:29,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{6:30,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{6:31,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{4:32,6:3,7:11,8:[1,21],9:[2,3],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{5:[2,5],8:[2,5],9:[2,5],11:[2,5],13:[2,5],14:[2,5],21:[2,5],22:[2,5],23:[2,5],26:[2,5],28:[2,5],31:[2,5],33:[2,5],34:[2,5],35:[2,5],36:[2,5]},{5:[2,31],8:[2,31],9:[2,31],11:[2,31],13:[2,31],14:[2,31],21:[2,31],22:[2,31],23:[2,31],26:[2,31],28:[2,31],31:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31]},{5:[2,32],8:[2,32],9:[2,32],11:[2,32],13:[2,32],14:[2,32],21:[2,32],22:[2,32],23:[2,32],26:[2,32],28:[2,32],31:[2,32],33:[2,32],34:[2,32],35:[2,32],36:[2,32]},{12:35,14:[1,36],27:33,28:[2,24],29:34,34:[1,15]},{6:38,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],32:37,33:[2,29],34:[1,15],35:[1,23],36:[1,24]},{1:[2,1]},{5:[2,2],9:[2,2]},{5:[2,17],8:[2,17],9:[2,17],11:[2,17],13:[2,17],14:[2,17],21:[2,17],22:[2,17],23:[2,17],26:[2,17],28:[2,17],31:[2,17],33:[2,17],34:[2,17],35:[2,17],36:[2,17]},{5:[2,18],8:[2,18],9:[2,18],11:[2,18],13:[2,18],14:[2,18],21:[2,18],22:[2,18],23:[2,18],26:[2,18],28:[2,18],31:[2,18],33:[2,18],34:[2,18],35:[2,18],36:[2,18]},{5:[2,19],8:[2,19],9:[2,19],11:[2,19],13:[2,19],14:[2,19],21:[2,19],22:[2,19],23:[2,19],26:[2,19],28:[2,19],31:[2,19],33:[2,19],34:[2,19],35:[2,19],36:[2,19]},{9:[1,39]},{28:[1,40]},{30:[1,41]},{30:[2,25]},{30:[2,26]},{33:[1,42]},{6:38,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],32:43,33:[2,29],34:[1,15],35:[1,23],36:[1,24]},{5:[2,4],8:[2,4],9:[2,4],11:[2,4],13:[2,4],14:[2,4],21:[2,4],22:[2,4],23:[2,4],26:[2,4],28:[2,4],31:[2,4],33:[2,4],34:[2,4],35:[2,4],36:[2,4]},{5:[2,22],8:[2,22],9:[2,22],11:[2,22],13:[2,22],14:[2,22],21:[2,22],22:[2,22],23:[2,22],26:[2,22],28:[2,22],31:[2,22],33:[2,22],34:[2,22],35:[2,22],36:[2,22]},{6:44,7:11,8:[1,21],10:12,11:[1,22],12:4,13:[1,5],14:[1,6],15:7,16:8,17:9,18:10,19:13,20:14,21:[1,18],22:[1,19],23:[1,20],24:16,25:17,26:[1,25],31:[1,26],34:[1,15],35:[1,23],36:[1,24]},{5:[2,27],8:[2,27],9:[2,27],11:[2,27],13:[2,27],14:[2,27],21:[2,27],22:[2,27],23:[2,27],26:[2,27],28:[2,27],31:[2,27],33:[2,27],34:[2,27],35:[2,27],36:[2,27]},{33:[2,28]},{12:35,14:[1,36],27:45,28:[2,24],29:34,34:[1,15]},{28:[2,23]}],
defaultActions: {27:[2,1],35:[2,25],36:[2,26],43:[2,28],45:[2,23]},
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
case 1:return 8;
break;
case 2:return 9;
break;
case 3:return 21;
break;
case 4:return 22;
break;
case 5:return 23;
break;
case 6:return 14;
break;
case 7:return 14;
break;
case 8:return 13;
break;
case 9:return 11;
break;
case 10:return 35;
break;
case 11:return 36;
break;
case 12:return 34;
break;
case 13:return 30;
break;
case 14:return 'COMMA';
break;
case 15:return 26;
break;
case 16:return 28;
break;
case 17:return 31;
break;
case 18:return 33;
break;
case 19:return 11;
break;
case 20:return 11;
break;
case 21:return 11;
break;
case 22:return 11;
break;
case 23:return 11;
break;
case 24:return 11;
break;
case 25:return 11;
break;
case 26:return 11;
break;
case 27:return 11;
break;
case 28:/* skip whitespace */
break;
case 29:return 5;
break;
}
},
rules: [/^(?:;.*)/,/^(?:\()/,/^(?:\))/,/^(?:~)/,/^(?:~@)/,/^(?:`)/,/^(?:"[^"]*")/,/^(?:'[^']*')/,/^(?:([-]?[0-9]*\.?[0-9]+))/,/^(?:not\b)/,/^(?:(\.[a-zA-Z$_!][a-zA-Z0-9$_!.]*))/,/^(?:(:[a-zA-Z$_!][a-zA-Z0-9$_!.]*))/,/^(?:([a-zA-Z$_!][a-zA-Z0-9$_!.]*))/,/^(?::)/,/^(?:,)/,/^(?:\{)/,/^(?:\})/,/^(?:\[)/,/^(?:\])/,/^(?:=)/,/^(?:\+)/,/^(?:-)/,/^(?:\*)/,/^(?:>)/,/^(?:<)/,/^(?:>=)/,/^(?:<=)/,/^(?:\/)/,/^(?:\s+)/,/^(?:$)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],"inclusive":true}}
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