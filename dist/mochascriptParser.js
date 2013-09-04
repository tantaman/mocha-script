function Node(type, key, text) {
	this.key = key;
	this.text = text || key;
	this.type = type;
}

Node.prototype.toString = function() {
	return this.text;
};

function List() {
  var arr = [ ];
  arr.push.apply(arr, arguments);
  arr.__proto__ = List.prototype;
  return arr;
}
List.prototype = new Array;
List.prototype.last = function() {
  return this[this.length - 1];
};
List.prototype.first = function() {
	return this[0];
};

function process(list, userdata) {
	var processor = lookupProcessor(list);
	if (!processor)
		throw "Illegal state.  No processor for " + list;
	return processor(list, userdata);
}

function lookupProcessor(list) {
	var lookup = list[0];
	if (lookup instanceof List) {
		return processors.fncall;
	}

	var processor = macros[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.type];
	return processor;
}var macros = {};

function JsBackend() {

}

JsBackend.prototype = {

};

function returnText(node) {
	return node.text;
}
var processors = {
	number: returnText,
	id: returnText,
	string: returnText,
	mathy: function(list) {
		var op = list.first().text;
		var params = list.rest();
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
			return unaryRep + process(params[0]);
		} else if (count == 2) {
			$$ = '(' + process(params[0]) + binaryRep + process(params[1]) + ')';
		} else if(count == 1) {
			return 'u' + fn + "(" + process(params) + ")";
		} else {
			return fn + ".call(null, " + process(params) + ")";
		}
	}
};

processors.pgm = function(list) {
	var result = "(function() {";
	result += processors.fnbody(list);
	return result + "})();"
};

processors.fnbody = function(list) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1)
			result += "return ";
		result += process(item) + ";\n";
	});
	return result;
};

processors.if = function(list) {
	return "(" + process(list[1]) +
		   " ? " + process(list[2]) +
		   " : " + process(list[3]) + ")\n";
};

processors.fncall = function(list) {
	if (list[0] instanceof List) {
		return "(" + process(list[0]) + ")(" + processors.parameters(list.rest()) + ")";
	} else {
		return list[0] + "(" + processors.parameters(list.rest()) + ")";
	}
};

processors.let = function(list) {
	return "(function() { " + 
		processors.bindings(list[1]) + 
		"\n" + 
		processors.fnbody(list[2]) +
		"\n})()";
};

processors.new = function(list) {
	return "new " + process(list[1]) + "(" + processors.parameters(list.rest(2))
			+ ")";
};

processors.parameters = function(list) {
	var result = "";
	boolean first = true;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += process(item);
	});
};

processors.loop = function(list) {
	return "(function() { var __looping, __loopResult; "
		+ processors.bindings(list[1]) + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ processors.loopbody(list.rest(2), list[1])
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

processors.bindings = function(list) {
	var result = "";
	for (var i = 1; i < list.lenngth; i += 2) {
		result += "var " + list[i-1] + " = " + process(list[i]) + ";\n";
	}

	return result;
};

processors.recur = function(list, bindings) {
	var result = "(__looping = true) && false";
	if (list[1]) {
		result += processors.recurparams(list.rest(), bindings);
	}

	return result;
};

processors.recurparams = function(list, bindings) {
	var result = "";
	for (var i = 0, j = 0; i < list.length; ++i, j += 2) {
		result += "|| (" + bindings[j] + " = " + process(list[i]) + ") && false";
	}

	return result;
};

processors.jsobject = function(list) {
	var result = "{";
	boolean first = true;
	for (var i = 1; i < list.length; i += 2) {
		if (first) first = false; else result += ",";
		result += list[i-1] + ":" + process(list[i]);
	}

	return result + "}";
};

processors.jsarray = function(list) {
	var result = "[";
	boolean first = true;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += process(item);
	});

	return result + "]";
};

processors.switch = function(list) {
	var exp = list[1];
	var caselist = list.rest(2);

	var result = "(function() {\n var __res;";
	result += "switch (" + process(exp) + ") {\n";

	for (var i = 1; i < caselist.length; i+=2) {
		result += "case " + process(caselist[i-1]) + ":\n"
			+ "__res = " + process(caselist[i]) + "break;\n";
	}

	return result + "\n}\n return __res;})()";
};

processors.set = function(list) {
	return "(" + process(list[1]) + " = " + process(list[2]) + ")";
};

processors.refprop = function(list) {
	return "(" + process(list[2]) + ")." + list[1];
};

processors.def = function(list) {
	return "var " + list[1] + " = " + list[2] + "\n";
};

processors.mcall = function(list) {
	return "(" + process(list[2]) + ")." + list[1] + "("
		 + processors.parameters(list[3]) + ")";
};

// TODO: add default parameters
processors.fn = function(list) {
	return "function(" + processors.fnparams(list[1]) + ") {\n" +
		processors.fnbody(list[2]) + "\n}\n";
};

processors.fnparams = function(list) {
	boolean first = true;
	var result = "";
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += item;
	});

	return result;
};

/* parser generated by jison 0.4.11 */
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
symbols_: {"error":2,"pgm":3,"explist":4,"ENDOFFILE":5,"explisti":6,"exp":7,"sexp":8,"slet":9,"sif":10,"sswitch":11,"sset":12,"sprop":13,"smcall":14,"sdef":15,"sfn":16,"sloop":17,"srecur":18,"LPAREN":19,"params":20,"RPAREN":21,"NEW":22,"id":23,"mathy":24,"MATHY":25,"LOOP":26,"letparams":27,"RECUR":28,"recurparams":29,"LET":30,"IF":31,"NUMBER":32,"STRING":33,"jsdata":34,"jsobject":35,"jsarray":36,"LCURLY":37,"jskeyvalpairs":38,"RCURLY":39,"jskey":40,"COLON":41,"LBRACKET":42,"jsarrayentries":43,"RBRACKET":44,"SWITCH":45,"caselist":46,"SET":47,"DEF":48,"mcall":49,"propaccess":50,"FN":51,"fnparams":52,"ID":53,"MCALL":54,"PROPACCESS":55,"$accept":0,"$end":1},
terminals_: {2:"error",5:"ENDOFFILE",19:"LPAREN",21:"RPAREN",22:"NEW",25:"MATHY",26:"LOOP",28:"RECUR",30:"LET",31:"IF",32:"NUMBER",33:"STRING",37:"LCURLY",39:"RCURLY",41:"COLON",42:"LBRACKET",44:"RBRACKET",45:"SWITCH",47:"SET",48:"DEF",51:"FN",53:"ID",54:"MCALL",55:"PROPACCESS"},
productions_: [0,[3,2],[4,1],[6,2],[6,0],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,4],[8,5],[8,4],[8,4],[24,1],[20,2],[20,0],[17,7],[18,4],[29,3],[29,0],[9,7],[27,3],[27,0],[10,5],[10,6],[7,1],[7,1],[7,1],[7,1],[7,1],[34,1],[34,1],[35,3],[38,4],[38,0],[40,1],[40,1],[36,3],[43,2],[43,0],[11,5],[46,3],[46,0],[12,5],[12,5],[15,5],[14,5],[13,4],[16,7],[52,2],[52,0],[23,1],[49,1],[50,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:return "(function() {" + $$[$0-1] + "})();";
break;
case 2:
			var list = $$[$0];
			list[list.length - 1] = "return " + list[list.length - 1];
			this.$ = list.join(";\n");
		
break;
case 3:this.$ = [$$[$0-1]].concat($$[$0]);
break;
case 4:this.$ = [];
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
case 14:this.$ = $$[$0];
break;
case 15:this.$ = "(" + $$[$0-2] + ")(" + $$[$0-1] + ")";
break;
case 16:this.$ = "new " + $$[$0-2] + "(" + $$[$0-1] + ")"
break;
case 17:this.$ = $$[$0-2] + "(" + $$[$0-1] + ")"
break;
case 18:
			var fn;
			var binaryRep = $$[$0-2];
			var unaryRep;
			switch($$[$0-2]) {
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

			// TODO: another example of why we need to build a graph of nodes first.
			var split = $$[$0-1].split(",");
			var count = split.length;
			if (unaryRep) {
				this.$ = unaryRep + $$[$0-1][0];
			} else if (count == 2) {
				this.$ = '(' + split[0] + binaryRep + split[1] + ')';
			} else if(count == 1) {
				this.$ = 'u' + fn + "(" + $$[$0-1] + ")";
			} else {
				this.$ = fn + ".call(null, " + $$[$0-1] + ")";
			}
		
break;
case 19:this.$ = $$[$0]
break;
case 20:this.$ = paramStr($$[$0-1], $$[$0]);
break;
case 21:this.$ = '';
break;
case 22:
		var lastExp = $$[$0-1][$$[$0-1].length-1];
		$$[$0-1][$$[$0-1].length-1] = "__loopResult = " + lastExp;
		$$[$0-1] = $$[$0-1].join("\n;");
		this.$ = "(function() { var __looping, __loopResult; "
		+ $$[$0-3] + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ $$[$0-1] 
		+ "} while(__looping);\n"
		+ "return __loopResult;})()"
break;
case 23:this.$ = "(__looping = true) && false";
		if ($$[$0-1] != '') this.$ += " || " + $$[$0-1];
break;
case 24:this.$ = "(" + $$[$0-2] + " = " + $$[$0-1] + ") && false";
		if ($$[$0] != '') this.$ += " || " + $$[$0];
break;
case 25:this.$ = '';
break;
case 26:this.$ = "(function() { " + $$[$0-3] + "\n" + $$[$0-1] + "\n})()";
break;
case 27:this.$ = "var " + $$[$0-2] + " = " + $$[$0-1] + ";\n" + $$[$0];
break;
case 28:this.$ = '';
break;
case 29:this.$ = "(" + $$[$0-2] + " ? " + $$[$0-1] + " : null)\n";
break;
case 30:this.$ = "(" + $$[$0-3] + " ? " + $$[$0-2] + " : " + $$[$0-1] + ")\n";
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = yytext;
break;
case 33:this.$ = yytext;
break;
case 34:this.$ = $$[$0];
break;
case 35:this.$ = $$[$0];
break;
case 36:this.$ = $$[$0]
break;
case 37:this.$ = $$[$0]
break;
case 38:this.$ = "{" + $$[$0-1] + "}"
break;
case 39:this.$ = $$[$0-3] + ":" + paramStr($$[$0-1], $$[$0]);
break;
case 40:this.$ = '';
break;
case 41:this.$ = $$[$0]
break;
case 42:this.$ = yytext
break;
case 43:this.$ = "[" + $$[$0-1] + "]"
break;
case 44:this.$ = paramStr($$[$0-1], $$[$0]);
break;
case 45:this.$ = '';
break;
case 46:this.$ = "(function() {\n var __res; switch (" + $$[$0-2] + ") {\n" + $$[$0-1] + "\n}\n return __res;})()";
break;
case 47:this.$ = "case " + $$[$0-2] + ":\n\t (__res = " + $$[$0-1] + ") break;\n" + $$[$0];
break;
case 48:this.$ = '';
break;
case 49:this.$ = "(" + $$[$0-2] + " = " + $$[$0-1] + ")";
break;
case 50:this.$ = "(" + $$[$0-2] + " = " + $$[$0-1] + ")";
break;
case 51:this.$ = "var " + $$[$0-2] + " = " + $$[$0-1] + "\n";
break;
case 52:this.$ = "(" + $$[$0-2] + ")" + $$[$0-3] + "(" + $$[$0-1] + ")";
break;
case 53:this.$ = "(" + $$[$0-1] + ")." + $$[$0-2];
break;
case 54:this.$ = "\nfunction(" + $$[$0-3] + ") {\n" + $$[$0-1] + "\n}\n";
break;
case 55:this.$ = paramStr($$[$0-1], $$[$0]);
break;
case 56:this.$ = '';
break;
case 57:this.$ = yytext;
break;
case 58:this.$ = yytext;
break;
case 59:this.$ = yytext.substring(1);
break;
}
},
table: [{3:1,4:2,5:[2,4],6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{1:[3]},{5:[1,26]},{5:[2,2],21:[2,2]},{5:[2,4],6:27,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,4],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{5:[2,31],19:[2,31],21:[2,31],32:[2,31],33:[2,31],37:[2,31],39:[2,31],42:[2,31],44:[2,31],53:[2,31]},{5:[2,32],19:[2,32],21:[2,32],32:[2,32],33:[2,32],37:[2,32],39:[2,32],42:[2,32],44:[2,32],53:[2,32]},{5:[2,33],19:[2,33],21:[2,33],32:[2,33],33:[2,33],37:[2,33],39:[2,33],42:[2,33],44:[2,33],53:[2,33]},{5:[2,34],19:[2,34],21:[2,34],32:[2,34],33:[2,34],37:[2,34],39:[2,34],42:[2,34],44:[2,34],53:[2,34]},{5:[2,35],19:[2,35],21:[2,35],32:[2,35],33:[2,35],37:[2,35],39:[2,35],42:[2,35],44:[2,35],53:[2,35]},{5:[2,57],19:[2,57],21:[2,57],32:[2,57],33:[2,57],37:[2,57],39:[2,57],41:[2,57],42:[2,57],44:[2,57],53:[2,57]},{5:[2,36],19:[2,36],21:[2,36],32:[2,36],33:[2,36],37:[2,36],39:[2,36],42:[2,36],44:[2,36],53:[2,36]},{5:[2,37],19:[2,37],21:[2,37],32:[2,37],33:[2,37],37:[2,37],39:[2,37],42:[2,37],44:[2,37],53:[2,37]},{5:[2,5],19:[2,5],21:[2,5],32:[2,5],33:[2,5],37:[2,5],39:[2,5],42:[2,5],44:[2,5],53:[2,5]},{5:[2,6],19:[2,6],21:[2,6],32:[2,6],33:[2,6],37:[2,6],39:[2,6],42:[2,6],44:[2,6],53:[2,6]},{5:[2,7],19:[2,7],21:[2,7],32:[2,7],33:[2,7],37:[2,7],39:[2,7],42:[2,7],44:[2,7],53:[2,7]},{5:[2,8],19:[2,8],21:[2,8],32:[2,8],33:[2,8],37:[2,8],39:[2,8],42:[2,8],44:[2,8],53:[2,8]},{5:[2,9],19:[2,9],21:[2,9],32:[2,9],33:[2,9],37:[2,9],39:[2,9],42:[2,9],44:[2,9],53:[2,9]},{5:[2,10],19:[2,10],21:[2,10],32:[2,10],33:[2,10],37:[2,10],39:[2,10],42:[2,10],44:[2,10],53:[2,10]},{5:[2,11],19:[2,11],21:[2,11],32:[2,11],33:[2,11],37:[2,11],39:[2,11],42:[2,11],44:[2,11],53:[2,11]},{5:[2,12],19:[2,12],21:[2,12],32:[2,12],33:[2,12],37:[2,12],39:[2,12],42:[2,12],44:[2,12],53:[2,12]},{5:[2,13],19:[2,13],21:[2,13],32:[2,13],33:[2,13],37:[2,13],39:[2,13],42:[2,13],44:[2,13],53:[2,13]},{5:[2,14],19:[2,14],21:[2,14],32:[2,14],33:[2,14],37:[2,14],39:[2,14],42:[2,14],44:[2,14],53:[2,14]},{8:28,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],22:[1,29],23:30,24:31,25:[1,42],26:[1,40],28:[1,41],30:[1,32],31:[1,33],45:[1,34],47:[1,35],48:[1,38],49:37,50:36,51:[1,39],53:[1,10],54:[1,44],55:[1,43]},{23:47,33:[1,48],38:45,39:[2,40],40:46,53:[1,10]},{7:50,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],43:49,44:[2,45],53:[1,10]},{1:[2,1]},{5:[2,3],21:[2,3]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:51,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{23:53,53:[1,10]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:54,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:55,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{19:[1,56]},{7:57,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:58,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{13:60,19:[1,61],23:59,53:[1,10]},{7:62,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:63,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{23:64,53:[1,10]},{19:[1,65]},{19:[1,66]},{21:[2,25],23:68,29:67,53:[1,10]},{19:[2,19],21:[2,19],32:[2,19],33:[2,19],37:[2,19],42:[2,19],53:[2,19]},{19:[2,59],32:[2,59],33:[2,59],37:[2,59],42:[2,59],53:[2,59]},{19:[2,58],32:[2,58],33:[2,58],37:[2,58],42:[2,58],53:[2,58]},{39:[1,69]},{41:[1,70]},{41:[2,41]},{41:[2,42]},{44:[1,71]},{7:50,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],43:72,44:[2,45],53:[1,10]},{21:[1,73]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:74,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:75,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[1,76]},{21:[1,77]},{21:[2,28],23:79,27:78,53:[1,10]},{7:80,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:82,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,48],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],46:81,53:[1,10]},{7:83,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:84,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{50:36,55:[1,43]},{21:[1,85]},{7:52,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],20:86,21:[2,21],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:87,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[2,56],23:89,52:88,53:[1,10]},{21:[2,28],23:79,27:90,53:[1,10]},{21:[1,91]},{7:92,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{5:[2,38],19:[2,38],21:[2,38],32:[2,38],33:[2,38],37:[2,38],39:[2,38],42:[2,38],44:[2,38],53:[2,38]},{7:93,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{5:[2,43],19:[2,43],21:[2,43],32:[2,43],33:[2,43],37:[2,43],39:[2,43],42:[2,43],44:[2,43],53:[2,43]},{44:[2,44]},{5:[2,15],19:[2,15],21:[2,15],32:[2,15],33:[2,15],37:[2,15],39:[2,15],42:[2,15],44:[2,15],53:[2,15]},{21:[2,20]},{21:[1,94]},{5:[2,17],19:[2,17],21:[2,17],32:[2,17],33:[2,17],37:[2,17],39:[2,17],42:[2,17],44:[2,17],53:[2,17]},{5:[2,18],19:[2,18],21:[2,18],32:[2,18],33:[2,18],37:[2,18],39:[2,18],42:[2,18],44:[2,18],53:[2,18]},{21:[1,95]},{7:96,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{7:98,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[1,97],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[1,99]},{7:100,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[1,101]},{21:[1,102]},{5:[2,53],19:[2,53],21:[2,53],32:[2,53],33:[2,53],37:[2,53],39:[2,53],42:[2,53],44:[2,53],53:[2,53]},{21:[1,103]},{21:[1,104]},{21:[1,105]},{21:[2,56],23:89,52:106,53:[1,10]},{21:[1,107]},{5:[2,23],19:[2,23],21:[2,23],32:[2,23],33:[2,23],37:[2,23],39:[2,23],42:[2,23],44:[2,23],53:[2,23]},{21:[2,25],23:68,29:108,53:[1,10]},{23:47,33:[1,48],38:109,39:[2,40],40:46,53:[1,10]},{5:[2,16],19:[2,16],21:[2,16],32:[2,16],33:[2,16],37:[2,16],39:[2,16],42:[2,16],44:[2,16],53:[2,16]},{4:110,6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,4],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[2,28],23:79,27:111,53:[1,10]},{5:[2,29],19:[2,29],21:[2,29],32:[2,29],33:[2,29],37:[2,29],39:[2,29],42:[2,29],44:[2,29],53:[2,29]},{21:[1,112]},{5:[2,46],19:[2,46],21:[2,46],32:[2,46],33:[2,46],37:[2,46],39:[2,46],42:[2,46],44:[2,46],53:[2,46]},{7:82,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,48],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],46:113,53:[1,10]},{5:[2,49],19:[2,49],21:[2,49],32:[2,49],33:[2,49],37:[2,49],39:[2,49],42:[2,49],44:[2,49],53:[2,49]},{5:[2,50],19:[2,50],21:[2,50],32:[2,50],33:[2,50],37:[2,50],39:[2,50],42:[2,50],44:[2,50],53:[2,50]},{5:[2,52],19:[2,52],21:[2,52],32:[2,52],33:[2,52],37:[2,52],39:[2,52],42:[2,52],44:[2,52],53:[2,52]},{5:[2,51],19:[2,51],21:[2,51],32:[2,51],33:[2,51],37:[2,51],39:[2,51],42:[2,51],44:[2,51],53:[2,51]},{4:114,6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,4],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[2,55]},{6:115,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:21,18:22,19:[1,23],21:[2,4],23:5,32:[1,6],33:[1,7],34:8,35:11,36:12,37:[1,24],42:[1,25],53:[1,10]},{21:[2,24]},{39:[2,39]},{21:[1,116]},{21:[2,27]},{5:[2,30],19:[2,30],21:[2,30],32:[2,30],33:[2,30],37:[2,30],39:[2,30],42:[2,30],44:[2,30],53:[2,30]},{21:[2,47]},{21:[1,117]},{21:[1,118]},{5:[2,26],19:[2,26],21:[2,26],32:[2,26],33:[2,26],37:[2,26],39:[2,26],42:[2,26],44:[2,26],53:[2,26]},{5:[2,54],19:[2,54],21:[2,54],32:[2,54],33:[2,54],37:[2,54],39:[2,54],42:[2,54],44:[2,54],53:[2,54]},{5:[2,22],19:[2,22],21:[2,22],32:[2,22],33:[2,22],37:[2,22],39:[2,22],42:[2,22],44:[2,22],53:[2,22]}],
defaultActions: {26:[2,1],47:[2,41],48:[2,42],72:[2,44],74:[2,20],106:[2,55],108:[2,24],109:[2,39],111:[2,27],113:[2,47]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
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
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                this.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
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

	function paramStr(a1, a2) {
		if (a2 != '')
			return a1 + "," + a2;
		else
			return a1;
	}

	function sexpStr(a1, a2) {
		if (a2 != '')
			return a1 + ";\n" + a2 + ";";
		else
			return a1 + ";\n";
	}
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
case 1:return 19;
break;
case 2:return 21;
break;
case 3:return 47;
break;
case 4:return 33;
break;
case 5:return 33;
break;
case 6:return 32;
break;
case 7:return 25;
break;
case 8:return 22;
break;
case 9:return 48;
break;
case 10:return 30;
break;
case 11:return 31;
break;
case 12:return 45;
break;
case 13:return 51;
break;
case 14:return 26;
break;
case 15:return 28;
break;
case 16:return 54;
break;
case 17:return 55;
break;
case 18:return 53;
break;
case 19:return 41;
break;
case 20:return 'COMMA';
break;
case 21:return 37;
break;
case 22:return 39;
break;
case 23:return 42;
break;
case 24:return 44;
break;
case 25:return 25;
break;
case 26:return 25;
break;
case 27:return 25;
break;
case 28:return 25;
break;
case 29:return 25;
break;
case 30:return 25;
break;
case 31:return 25;
break;
case 32:return 25;
break;
case 33:return 25;
break;
case 34:/* skip whitespace */
break;
case 35:return 5;
break;
}
},
rules: [/^(?:;.*)/,/^(?:\()/,/^(?:\))/,/^(?:!)/,/^(?:"[^"]*")/,/^(?:'[^']*')/,/^(?:([-]?[0-9]*\.?[0-9]+))/,/^(?:not\b)/,/^(?:new\b)/,/^(?:def\b)/,/^(?:let\b)/,/^(?:if\b)/,/^(?:switch\b)/,/^(?:fn\b)/,/^(?:loop\b)/,/^(?:recur\b)/,/^(?:(\.[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:(:[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:([a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?::)/,/^(?:,)/,/^(?:\{)/,/^(?:\})/,/^(?:\[)/,/^(?:\])/,/^(?:=)/,/^(?:\+)/,/^(?:-)/,/^(?:\*)/,/^(?:>)/,/^(?:<)/,/^(?:>=)/,/^(?:<=)/,/^(?:\/)/,/^(?:\s+)/,/^(?:$)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35],"inclusive":true}}
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