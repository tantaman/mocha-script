function Scope(parent, expressions) {
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

}

function BranchScope(parentScope, bodyExpression, resultSymbol) {
	Scope.call(this, parentScope, [bodyExpression]);
	this.resultSymbol = resultSymbol;
}
BranchScope.prototype = Object.create(Scope.prototype);