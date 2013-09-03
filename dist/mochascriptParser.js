function retSelf() { return this; }

function Symbol(symbol, postfix) {
	this.id = symbol;
	this.postfix = postfix;
}

Symbol.prototype.toString = function() {
	return this.id + this.postfix;
}function Scope(parent, expressions) {
	this.extractedExpressions = [];
	this.symbolTable = {};
	this.expressions = expressions || [];
	this.parent = parent;

	this.currentExtractedId = new Symbol('__ex', 0);
}

Scope.prototype = {
	addExtractedFirst: function(extracted, from) {
		this.extractedExpressions.unshift({extracted: extracted, from: from});
		this.currentExtractedId =
			new Symbol(this.currentExtractedId.id,
			this.currentExtractedId.postfix + 1);
		extracted.setResultSymbol(this.currentExtractedId);

		return this.currentExtractedId;
	},

	defineSymbol: function(symbol) {
		// they are just re-defining the same var in the same scope.
		if (this.symbolTable[symbol]) return;

		// see if the var has been defined in a parent scope.
		// if so, rename it in this one due to javascript variable hoisting.
		var existing = this.lookupSymbol(symbol);
		if (!existing)
			this.symbol[symbol] = new Symbol(symbol, 0);
		else {
			this.symbol[symbol] = new Symbol(existing.id, existing.postfix + 1);
		}
	},

	lookupSymbol: function(symbol) {
		var result = this.symbolTable[symbol];
		if (result) return result;
		if (this.parent) return this.parent.lookupSymbol(symbol);
	},

	setResultSymbol: function(symbol) {
		this.resultSymbol = symbol;
	},

	generate: function() {
		// call generate on all sub-expressions
		// those will extract epxressions and hopefully generate those as well
		// then toString all expressions and extracted expressions?

		// We need to get the ordering of extracted expressions correct.
		// Some may come after a given subexpression...
		// The extract expressions should be inserted just before their "from" expression

		// so we'll call generate on everyone
		// and then concatenate all of our code up by to-stringing everything...
		// generate extracts expressions and re-orders code
		// toString takes the results of generate and stringifies it.
		this.expressions.forEach(function(expression) {
			expression.generate(this);
		});

		return this;
	},

	_createExpressionsString: function(startIndex, endIndex) {
		var result = "";
		for (var j = startIndex; j < endIndex; ++j) {
			if (this.resultSymbol && j == this.expressions.length - 1) {
				result += this.resultSymbol + " = ";
			}

			result += this.expressions[j].toString();
		}
	},

	createBodyString: function() {
		var result = "";
		// Declare the symbols for this scope
		for (var symbol in this.symbolTable) {
			result += "var " symbol + ";";
		}

		if (this.resultSymbol)
			result += "var " + resultSymbol + ";";

		// write out expressions
		var exprIndex = 0;
		this.extractedExpressions.forEach(function(expression) {
			var i = this.expressions.indexOf(expression.from);
			if (i >= 0 && i != exprIndex) {
				result += this._createExpressionsString(exprIndex, i);
			}
			exprIndex = i;
		});

		// write out remaining expressions
		result += this._createExpressionsString(exprIndex, this.expressions.length);
	}
};

function LetScope(parentScope, bindings, expressions) {

}

function FnScope(parentScope, params, expressions) {
	Scope.call(this, parentScope, expressions);
	this.resultSymbol = new Symbol('__fnRet', 0);
	this.params = params;
	this.paramTable = {};

	params.each(function(param) {
		this.paramTable[param] = new Symbol(param.name, 0);
	});
}
proto = FnScope.prototype = Object.create(Scope.prototype);
proto.toString = function() {
	return "function(" + this.params + ") {" + this.createBodyString() 
			+ "return " + this.resultSymbol + ";}";
}
proto.lookupSymbol = function(symbol) {
	var result = this.paramTable[symbol];
	if (result)
		return result;

	return Scope.prototype.lookupSymbol.call(this, symbol);
}

function LoopScope() {

}

function CaseScope(parentScope, expressions, check) {
	Scope.call(this, parentScope, expressions);
	this.check = check;
}
proto = CaseScope.prototype = Object.create(Scope.prototype);
proto.toString = function(caseSymbol) {
	this.setResultSymbol(caseSymbol);
	return "case " + this.check + ":\n" + this.createBodyString() + "break;";
}

function GlobalScope(expressions) {
	Scope.call(this, null, expressions);
}
GlobalScope.prototype = Object.create(Scope.prototype);

function DoScope() {

}function PropAccess(property) {
	this.property = property;
}
var proto = PropAccess.prototype;
proto.toString = function() {
	return this.property;
}
proto.generate = retSelf;

function MCall(method) {
	this.method = method;
}
proto = MCall.prototype;
proto.toString = function() {
	return this.method;
}
proto.generate = retSelf;

function Id(identifier) {
	this.identifier = identifier;
}
proto = Id.prototype;
proto.toString = function() {
	return this.identifier;
};
proto.generate = retSelf;

function FnParams(param, rest) {
	if (rest) {
		rest.add(param);
		return rest;
	} else if (param) {
		this.params = [param];
	} else {
		this.params = [];
	}
}
proto = FnParams.prototype;
proto.add = function(param) {
	if (param) {
		this.params.unshift(param);
	}
};
proto.toString = function() {
	return this.params.join(",");
};
proto.each = function(cb) {
	this.params.forEach(cb);
};
proto.generate = retSelf;

function SFn(params, body) {
	this.params = params;
	this.body = body;
}
proto = SFn.prototype;
proto.toString = function() {
	return this.scope.toString();
}
proto.generate = function(scope, line) {
	this.scope = new FnScope(scope, this.params, this.body);
	this.scope.generate();
	return this;
}

function SProp(property, expression) {
	this.property = property;
	this.expression = expression;
}
proto = SProp.prototype;
proto.toString = function() {
	return this.expression + "." + this.property;
}
proto.generate = function(scope, line) {
	this.expression = this.expression.generate(scope, line);
	return this;
}

function SMCall(expression, method, parameters) {
	this.expression = expression;
	this.method = method;
	this.parameters = parameters;
}
SMCall.prototype = {
	toString: function() {
		return this.expression + "." + this.method + "(" + this.parameters + ")";
	},

	generate: function(scope, line) {
		this.expression = this.expression.generate(scope, line);
		return this;
	}
};

function SDef(id, expression) {
	this.id = id;
	this.expression = expression;
}
SDef.prototype = {
	toString: function() {
		return this.id + " = " + this.expression + ";";
	},

	generate: function(scope, line) {
		scope.defineSymbol(this.id);
		this.expression = this.expression.generate(scope, line);
		return this;
	}
}

function SSet(id, expression) {
	this.id = id;
	this.expression = expression;
}
SSet.prototype = {
	toString: function() {
		return "(" + this.id + " = " + this.expression + ")";
	},

	generate: function(scope, line) {
		this.expression = this.expression.generate(scope, line);
		return this;
	}
}

function Case(check, expression) {
	this.check = check;
	this.expression = expression;
}
Case.prototype = {
	toString: function(caseSymbol) {
		if (!caseSymbol) throw "Illegal state.  Must have case symbol"
		return this.scope.toString(caseSymbol);
	},

	generate: function(scope, line) {
		this.check = this.check.generate(scope, line);
		this.scope = new CaseScope(scope, [this.expression], this.check);
		this.scope.generate();
		return this;
	}
}

function CaseList(check, expression, caselist) {
	if (caselist) {
		caselist.add(check, expression);
		return caselist;
	}

	this.cases = [];
	this.add(check, expression);
}
// TODO: cases are a new scope...
// can't extract things outside of their case body!
CaseList.prototype = {
	add: function(check, expression) {
		this.cases.unshift(new Case(check, expression));
	},

	toString: function(caseSymbol) {
		if (!caseSymbol)
			throw "Illegal state.  Must have case symbol."

		var result = "";
		this.cases.forEach(function(kase) {
			result += kase.toString(caseSymbol);
		});

		return result;
	},

	generate: function(scope, line) {
		this.cases.forEach(funciton(kase) {
			kase.generate(scope, line);
		});

		return this;
	}
};

function SSwitch(expression, caselist) {
	this.caselist = caselist;
	this.expression = expression;
}
SSwitch.prototype = {
	toString: function() {
		var result = "switch (" + this.expression + ") {" + this.caselist.toString(this.switchReturn);
		+ "}";
	},

	generate: function(scope, line) {
		this.switchReturn = scope.addExtractedFirst(this, line);
		this.expression = this.expression.generate(scope, line);
		this.caselist = this.caselist.generate(scope, line);
		return this.switchReturn;
		
	}
}

function JSArrayEntries(entry, jsarrayentries) {
	if (jsarrayentries) {
		jsarrayentries.add(entry);
		return jsarrayentries;
	} else if (entry != null) {
		this.entries = [entry];
	} else {
		this.entries = [];
	}
}
JSArrayEntries.prototype = {
	toString: function() {
		var result = "";
		boolean first = true;
		this.entries.forEach(function(entry) {
			if (!first) { result += ","; first = false }
			result += entry;;
		});

		return result;
	},

	generate: function(scope, line) {
		for(var i = this.entries.length - 1; i > -1; --i) {
			this.entries[i] = this.entries[i].generate(scope, line);
		}
		return this;
	},

	add: function(entry) {
		this.entries.unshift(entry);
	}
}

function JSArray(entries) {
	this.entries = entries;
}

JSArray.prototype = {
	toString: function() {
		return "[" + this.entries + "]";
	},

	generate: function(scope, line) {
		this.entries.generate(scope, line);
		return this;
	}
}

function JSKey(key) {
	this.key = key;
}

JSKey.prototype = {
	toString: function() {
		return this.key;
	},
	generate: retSelf;
}

function JSKeyValPairs(key, expression, keyvalpairs) {

}

JSKeyValPairs.prototype = {
	toString: function() {

	},

	generate: function() {

	}
}/* parser generated by jison 0.4.11 */
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
symbols_: {"error":2,"pgm":3,"explist":4,"ENDOFFILE":5,"explisti":6,"exp":7,"sexp":8,"slet":9,"sif":10,"sswitch":11,"sset":12,"sprop":13,"smcall":14,"sdef":15,"sfn":16,"LPAREN":17,"params":18,"RPAREN":19,"NEW":20,"id":21,"mathy":22,"MATHY":23,"LET":24,"letparams":25,"IF":26,"NUMBER":27,"STRING":28,"jsdata":29,"jsobject":30,"jsarray":31,"LCURLY":32,"jskeyvalpairs":33,"RCURLY":34,"jskey":35,"COLON":36,"LBRACKET":37,"jsarrayentries":38,"RBRACKET":39,"SWITCH":40,"caselist":41,"SET":42,"DEF":43,"mcall":44,"propaccess":45,"FN":46,"fnparams":47,"ID":48,"MCALL":49,"PROPACCESS":50,"$accept":0,"$end":1},
terminals_: {2:"error",5:"ENDOFFILE",17:"LPAREN",19:"RPAREN",20:"NEW",23:"MATHY",24:"LET",26:"IF",27:"NUMBER",28:"STRING",32:"LCURLY",34:"RCURLY",36:"COLON",37:"LBRACKET",39:"RBRACKET",40:"SWITCH",42:"SET",43:"DEF",46:"FN",48:"ID",49:"MCALL",50:"PROPACCESS"},
productions_: [0,[3,2],[4,1],[6,2],[6,0],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,1],[8,4],[8,5],[8,4],[8,4],[22,1],[18,2],[18,0],[9,7],[25,3],[25,0],[10,5],[10,6],[7,1],[7,1],[7,1],[7,1],[7,1],[29,1],[29,1],[30,3],[33,4],[33,0],[35,1],[35,1],[31,3],[38,2],[38,0],[11,5],[41,3],[41,0],[12,5],[12,5],[15,5],[14,5],[13,4],[16,7],[47,2],[47,0],[21,1],[44,1],[45,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:return new GlobalScope($$[$0-1]).generate().toString();
break;
case 2:this.$ = $$[$0];
break;
case 3:this.$ = new ExpList($$[$0-1], $$[$0]);
break;
case 4:this.$ = new ExpList();
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
case 13:this.$ = new LambdaCallSExp($$[$0-2], $$[$0-1])
break;
case 14:this.$ = new NewSExp($$[$0-2], $$[$0-1]);
break;
case 15:this.$ = new CallSExp($$[$0-2], $$[$0-1]);
break;
case 16:this.$ = new MathSExp($$[$0-2], $$[$0-1]);
break;
case 17:this.$ = new Mathy($$[$0]);
break;
case 18:this.$ = new Params($$[$0-1], $$[$0]);
break;
case 19:this.$ = new Params();
break;
case 20:this.$ = new SLet($$[$0-3], $$[$0-1]);
break;
case 21:this.$ = new LetParams($$[$0-2], $$[$0-1], $$[$0]);
break;
case 22:this.$ = new LetParams();
break;
case 23:this.$ = new SIf($$[$0-2], $$[$0-1]);
break;
case 24:this.$ = new SIf($$[$0-3], $$[$0-2], $$[$0-1]);
break;
case 25:this.$ = $$[$0];
break;
case 26:this.$ = new Number(yytext);
break;
case 27:this.$ = new Str(yytext);
break;
case 28:this.$ = $$[$0];
break;
case 29:this.$ = $$[$0];
break;
case 30:this.$ = $$[$0];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = new JSObject($$[$0-1]);
break;
case 33:this.$ = new JSKeyValPairs($$[$0-3], $$[$0-1], $$[$0]);
break;
case 34:this.$ = new JSKeyValPairs();
break;
case 35:this.$ = new JSKey($$[$0]);
break;
case 36:this.$ = jew JSKey(yytext);
break;
case 37:this.$ = new JSArray($$[$0-1]);
break;
case 38:this.$ = new JSArrayEntries($$[$0-1], $$[$0]);
break;
case 39:this.$ = new JSArrayEntries();
break;
case 40:this.$ = new SSwitch($$[$0-2], $$[$0-1]);
break;
case 41:this.$ = new CaseList($$[$0-2], $$[$0-1], $$[$0]);
break;
case 42:this.$ = new CaseList();
break;
case 43:this.$ = new SSet($$[$0-2], $$[$0-1]);
break;
case 44:this.$ = new SSet($$[$0-2], $$[$0-1]);
break;
case 45:this.$ = new SDef($$[$0-2], $$[$0-1]);
break;
case 46:this.$ = new SMCall($$[$0-2], $$[$0-3], $$[$0-1]);
break;
case 47:this.$ = new SProp($$[$0-1], $$[$0-2]);
break;
case 48:this.$ = new SFn($$[$0-3], $$[$0-1]);
break;
case 49:this.$ = new FnParams($$[$0-1], $$[$0]);
break;
case 50:this.$ = new FnParams();
break;
case 51:this.$ = new Id(yytext);
break;
case 52:this.$ = new MCall(yytext);
break;
case 53:this.$ = new PropAccess(yytext.substring(1));
break;
}
},
table: [{3:1,4:2,5:[2,4],6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{1:[3]},{5:[1,24]},{5:[2,2],19:[2,2]},{5:[2,4],6:25,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[2,4],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{5:[2,25],17:[2,25],19:[2,25],27:[2,25],28:[2,25],32:[2,25],34:[2,25],37:[2,25],39:[2,25],48:[2,25]},{5:[2,26],17:[2,26],19:[2,26],27:[2,26],28:[2,26],32:[2,26],34:[2,26],37:[2,26],39:[2,26],48:[2,26]},{5:[2,27],17:[2,27],19:[2,27],27:[2,27],28:[2,27],32:[2,27],34:[2,27],37:[2,27],39:[2,27],48:[2,27]},{5:[2,28],17:[2,28],19:[2,28],27:[2,28],28:[2,28],32:[2,28],34:[2,28],37:[2,28],39:[2,28],48:[2,28]},{5:[2,29],17:[2,29],19:[2,29],27:[2,29],28:[2,29],32:[2,29],34:[2,29],37:[2,29],39:[2,29],48:[2,29]},{5:[2,51],17:[2,51],19:[2,51],27:[2,51],28:[2,51],32:[2,51],34:[2,51],36:[2,51],37:[2,51],39:[2,51],48:[2,51]},{5:[2,30],17:[2,30],19:[2,30],27:[2,30],28:[2,30],32:[2,30],34:[2,30],37:[2,30],39:[2,30],48:[2,30]},{5:[2,31],17:[2,31],19:[2,31],27:[2,31],28:[2,31],32:[2,31],34:[2,31],37:[2,31],39:[2,31],48:[2,31]},{5:[2,5],17:[2,5],19:[2,5],27:[2,5],28:[2,5],32:[2,5],34:[2,5],37:[2,5],39:[2,5],48:[2,5]},{5:[2,6],17:[2,6],19:[2,6],27:[2,6],28:[2,6],32:[2,6],34:[2,6],37:[2,6],39:[2,6],48:[2,6]},{5:[2,7],17:[2,7],19:[2,7],27:[2,7],28:[2,7],32:[2,7],34:[2,7],37:[2,7],39:[2,7],48:[2,7]},{5:[2,8],17:[2,8],19:[2,8],27:[2,8],28:[2,8],32:[2,8],34:[2,8],37:[2,8],39:[2,8],48:[2,8]},{5:[2,9],17:[2,9],19:[2,9],27:[2,9],28:[2,9],32:[2,9],34:[2,9],37:[2,9],39:[2,9],48:[2,9]},{5:[2,10],17:[2,10],19:[2,10],27:[2,10],28:[2,10],32:[2,10],34:[2,10],37:[2,10],39:[2,10],48:[2,10]},{5:[2,11],17:[2,11],19:[2,11],27:[2,11],28:[2,11],32:[2,11],34:[2,11],37:[2,11],39:[2,11],48:[2,11]},{5:[2,12],17:[2,12],19:[2,12],27:[2,12],28:[2,12],32:[2,12],34:[2,12],37:[2,12],39:[2,12],48:[2,12]},{16:26,17:[1,38],20:[1,27],21:28,22:29,23:[1,39],24:[1,30],26:[1,31],40:[1,32],42:[1,33],43:[1,36],44:35,45:34,46:[1,37],48:[1,10],49:[1,41],50:[1,40]},{21:44,28:[1,45],33:42,34:[2,34],35:43,48:[1,10]},{7:47,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],38:46,39:[2,39],48:[1,10]},{1:[2,1]},{5:[2,3],19:[2,3]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:48,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{21:50,48:[1,10]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:51,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:52,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{17:[1,53]},{7:54,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:55,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{13:57,17:[1,58],21:56,48:[1,10]},{7:59,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:60,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{21:61,48:[1,10]},{17:[1,62]},{46:[1,37]},{17:[2,17],19:[2,17],27:[2,17],28:[2,17],32:[2,17],37:[2,17],48:[2,17]},{17:[2,53],27:[2,53],28:[2,53],32:[2,53],37:[2,53],48:[2,53]},{17:[2,52],27:[2,52],28:[2,52],32:[2,52],37:[2,52],48:[2,52]},{34:[1,63]},{36:[1,64]},{36:[2,35]},{36:[2,36]},{39:[1,65]},{7:47,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],38:66,39:[2,39],48:[1,10]},{19:[1,67]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:68,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:69,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[1,70]},{19:[1,71]},{19:[2,22],21:73,25:72,48:[1,10]},{7:74,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:76,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[2,42],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],41:75,48:[1,10]},{7:77,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:78,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{45:34,50:[1,40]},{19:[1,79]},{7:49,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],18:80,19:[2,19],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:81,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[2,50],21:83,47:82,48:[1,10]},{5:[2,32],17:[2,32],19:[2,32],27:[2,32],28:[2,32],32:[2,32],34:[2,32],37:[2,32],39:[2,32],48:[2,32]},{7:84,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{5:[2,37],17:[2,37],19:[2,37],27:[2,37],28:[2,37],32:[2,37],34:[2,37],37:[2,37],39:[2,37],48:[2,37]},{39:[2,38]},{5:[2,13],17:[2,13],19:[2,13],27:[2,13],28:[2,13],32:[2,13],34:[2,13],37:[2,13],39:[2,13],48:[2,13]},{19:[2,18]},{19:[1,85]},{5:[2,15],17:[2,15],19:[2,15],27:[2,15],28:[2,15],32:[2,15],34:[2,15],37:[2,15],39:[2,15],48:[2,15]},{5:[2,16],17:[2,16],19:[2,16],27:[2,16],28:[2,16],32:[2,16],34:[2,16],37:[2,16],39:[2,16],48:[2,16]},{19:[1,86]},{7:87,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{7:89,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[1,88],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[1,90]},{7:91,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[1,92]},{19:[1,93]},{5:[2,47],17:[2,47],19:[2,47],27:[2,47],28:[2,47],32:[2,47],34:[2,47],37:[2,47],39:[2,47],48:[2,47]},{19:[1,94]},{19:[1,95]},{19:[1,96]},{19:[2,50],21:83,47:97,48:[1,10]},{21:44,28:[1,45],33:98,34:[2,34],35:43,48:[1,10]},{5:[2,14],17:[2,14],19:[2,14],27:[2,14],28:[2,14],32:[2,14],34:[2,14],37:[2,14],39:[2,14],48:[2,14]},{4:99,6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[2,4],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[2,22],21:73,25:100,48:[1,10]},{5:[2,23],17:[2,23],19:[2,23],27:[2,23],28:[2,23],32:[2,23],34:[2,23],37:[2,23],39:[2,23],48:[2,23]},{19:[1,101]},{5:[2,40],17:[2,40],19:[2,40],27:[2,40],28:[2,40],32:[2,40],34:[2,40],37:[2,40],39:[2,40],48:[2,40]},{7:76,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[2,42],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],41:102,48:[1,10]},{5:[2,43],17:[2,43],19:[2,43],27:[2,43],28:[2,43],32:[2,43],34:[2,43],37:[2,43],39:[2,43],48:[2,43]},{5:[2,44],17:[2,44],19:[2,44],27:[2,44],28:[2,44],32:[2,44],34:[2,44],37:[2,44],39:[2,44],48:[2,44]},{5:[2,46],17:[2,46],19:[2,46],27:[2,46],28:[2,46],32:[2,46],34:[2,46],37:[2,46],39:[2,46],48:[2,46]},{5:[2,45],17:[2,45],19:[2,45],27:[2,45],28:[2,45],32:[2,45],34:[2,45],37:[2,45],39:[2,45],48:[2,45]},{4:103,6:3,7:4,8:9,9:13,10:14,11:15,12:16,13:17,14:18,15:19,16:20,17:[1,21],19:[2,4],21:5,27:[1,6],28:[1,7],29:8,30:11,31:12,32:[1,22],37:[1,23],48:[1,10]},{19:[2,49]},{34:[2,33]},{19:[1,104]},{19:[2,21]},{5:[2,24],17:[2,24],19:[2,24],27:[2,24],28:[2,24],32:[2,24],34:[2,24],37:[2,24],39:[2,24],48:[2,24]},{19:[2,41]},{19:[1,105]},{5:[2,20],17:[2,20],19:[2,20],27:[2,20],28:[2,20],32:[2,20],34:[2,20],37:[2,20],39:[2,20],48:[2,20]},{5:[2,48],17:[2,48],19:[2,48],27:[2,48],28:[2,48],32:[2,48],34:[2,48],37:[2,48],39:[2,48],48:[2,48]}],
defaultActions: {24:[2,1],44:[2,35],45:[2,36],66:[2,38],68:[2,18],97:[2,49],98:[2,33],100:[2,21],102:[2,41]},
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

	if (typeof module != 'undefined') {
		var nodes = require('./nodes');
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
case 1:return 17;
break;
case 2:return 19;
break;
case 3:return 42;
break;
case 4:return 28;
break;
case 5:return 28;
break;
case 6:return 27;
break;
case 7:return 20;
break;
case 8:return 43;
break;
case 9:return 24;
break;
case 10:return 26;
break;
case 11:return 40;
break;
case 12:return 46;
break;
case 13:return 49;
break;
case 14:return 50;
break;
case 15:return 48;
break;
case 16:return 36;
break;
case 17:return 'COMMA';
break;
case 18:return 32;
break;
case 19:return 34;
break;
case 20:return 37;
break;
case 21:return 39;
break;
case 22:return 23;
break;
case 23:return 23;
break;
case 24:return 23;
break;
case 25:return 23;
break;
case 26:return 23;
break;
case 27:return 23;
break;
case 28:return 23;
break;
case 29:return 23;
break;
case 30:return 23;
break;
case 31:/* skip whitespace */
break;
case 32:return 5;
break;
}
},
rules: [/^(?:;.*)/,/^(?:\()/,/^(?:\))/,/^(?:!)/,/^(?:"[^"]*")/,/^(?:'[^']*')/,/^(?:([-]?[0-9]*\.?[0-9]+))/,/^(?:new\b)/,/^(?:def\b)/,/^(?:let\b)/,/^(?:if\b)/,/^(?:switch\b)/,/^(?:fn\b)/,/^(?:(\.[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:(:[a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?:([a-zA-Z$_][a-zA-Z0-9$_]*))/,/^(?::)/,/^(?:,)/,/^(?:\{)/,/^(?:\})/,/^(?:\[)/,/^(?:\])/,/^(?:=)/,/^(?:\+)/,/^(?:-)/,/^(?:\*)/,/^(?:>)/,/^(?:<)/,/^(?:>=)/,/^(?:<=)/,/^(?:\/)/,/^(?:\s+)/,/^(?:$)/],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],"inclusive":true}}
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