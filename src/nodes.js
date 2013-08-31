function Symbol(symbol, postfix) {
	this.id = symbol;
	this.postfix = postfix;
}

Symbol.prototype.toString = function() {
	return this.id + this.postfix;
}

function Scope(expressions) {
	this.extractedExpressions = [];
	this.symbolTable = {};
	this.expressions = expressions || [];
	this.parent = null;

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
	}
};

function LetScope() {

}

function FnScope() {

}

function LoopScope() {

}

function GlobalScope(expressions) {
	Scope.call(this);
}

GlobalScope.prototype = Object.create(Scope.prototype);

function PropAccess(property) {
	this.property = property;
}
var proto = PropAccess.prototype;
proto.toString = function() {
	return this.property;
}

function MCall(method) {
	this.method = method;
}
proto = MCall.prototype;
proto.toString = function() {
	return this.method;
}

function Id(identifier) {
	this.identifier = identifier;
}
proto = Id.prototype;
proto.toString = function() {
	return this.identifier;
}

function FnParams(param, rest) {
	if (rest) {
		rest.addParam(param);
		return rest;
	} else if (param) {
		this.params = [param];
	} else {
		this.params = [];
	}
}
proto = FnParams.prototype;
proto.addParam = function(param) {
	if (param) {
		this.params.push(param);
	}
}
proto.toString = function() {
	return this.params.join(",");
}

function SFn(params, body) {
	this.params = params;
	this.body = body;
}
proto = SFn.prototype;
proto.toString = function() {
	return "function(" + this.params + ") {" + this.body + "}";
}

function SProp(property, expression) {

}